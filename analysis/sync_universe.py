import json
import os
import re
import uuid
from datetime import date, datetime, timezone
from pathlib import Path
from io import BytesIO
import FinanceDataReader as fdr
import pandas as pd
import requests

TODAY=date.today().isoformat()
NOW=datetime.now(timezone.utc).isoformat()
TARGET_EQUITIES=int(os.environ.get("PEPPERCORN_TARGET_EQUITIES","1500"))
OUTPUT=Path(os.environ.get("UNIVERSE_OUTPUT","universe_payload.json"))
NASDAQ_SCREENER="https://api.nasdaq.com/api/screener/stocks"
SOURCES={
    "S&P500":"Wikipedia S&P 500 constituent table via FinanceDataReader; benchmark owner: S&P DJI",
    "NASDAQ_CORE":"Nasdaq Stock Screener; sector/industry mapped from Quotemedia SIC",
    "KOSPI200":"KRX Data System MDCSTAT00601 official index constituents",
    "KOSDAQ150":"KRX Data System MDCSTAT00601 official index constituents",
}

def pick(row,*names,default=None):
    for name in names:
        if name in row and pd.notna(row[name]):
            value=str(row[name]).strip()
            if value and value.lower()!="nan": return value
    return default

def norm_us(symbol): return str(symbol or "").strip().upper().replace("/",".")
def norm_kr(symbol):
    s=re.sub(r"\D","",str(symbol or ""))
    return s.zfill(6) if s else ""

def market_cap(value):
    if value is None:return 0.0
    s=str(value).replace("$","").replace(",","").strip()
    mult=1.0
    if s.endswith(("T","B","M","K")):
        mult={"T":1e12,"B":1e9,"M":1e6,"K":1e3}[s[-1]];s=s[:-1]
    try:return float(s)*mult
    except:return 0.0

def is_common_equity(row):
    symbol=norm_us(row.get("symbol"));name=str(row.get("name") or "").lower()
    if not symbol or any(x in name for x in [" warrant","warrant "," unit"," rights","right to"," preferred"," depositary"]):return False
    if symbol.endswith(("W","WS","U","R")) and len(symbol)>4:return False
    return True

def fetch_nasdaq():
    params={"tableonly":"true","limit":"10000","exchange":"nasdaq","download":"true"}
    headers={"User-Agent":"Mozilla/5.0 (Peppercorn Capital universe sync)","Accept":"application/json, text/plain, */*","Referer":"https://www.nasdaq.com/market-activity/stocks/screener"}
    r=requests.get(NASDAQ_SCREENER,params=params,headers=headers,timeout=60);r.raise_for_status()
    data=r.json().get("data") or {};rows=data.get("rows") or (data.get("table") or {}).get("rows") or []
    rows=[x for x in rows if is_common_equity(x)]
    rows.sort(key=lambda x:market_cap(x.get("marketCap")),reverse=True)
    if len(rows)<500:raise RuntimeError(f"Nasdaq screener returned only {len(rows)} equities")
    return rows

def fetch_sp500():
    df=fdr.StockListing("S&P500")
    if len(df)<480:raise RuntimeError(f"S&P500 listing returned only {len(df)} rows")
    return df

def fetch_krx_listing():
    # FinanceDataReader's KRX-DESC cache is generated from KRX/KIND and includes
    # KRX Market + company 업종(Sector) + 주요제품(Industry). Reading the cache
    # directly avoids the fragile KRX resource-bundle call made by the adapter.
    base="https://raw.githubusercontent.com/FinanceData/fdr_krx_data_cache/master/data/listing/desc"
    for days_back in range(0,15):
        d=(pd.Timestamp.today()-pd.Timedelta(days=days_back)).strftime("%Y-%m-%d")
        try:
            r=requests.get(f"{base}/{d}.csv",headers={"User-Agent":"Mozilla/5.0 PeppercornCapital/1.0"},timeout=30)
            if r.status_code!=200:continue
            df=pd.read_csv(BytesIO(r.content),dtype={"Code":str})
            if len(df)>=1500:
                df["Code"]=df["Code"].astype(str).str.zfill(6)
                df.attrs["as_of"]=d
                return df
        except Exception:
            continue
    raise RuntimeError("KRX-DESC cache unavailable for the last 15 days")

KRX_HEADERS={
    "User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Referer":"https://data.krx.co.kr/contents/MDC/MDI/outerLoader/index.cmd",
}

def _krx_session():
    session=requests.Session()
    session.headers.update(KRX_HEADERS)
    # KRX requires a session cookie even for public MDC endpoints. FinanceData's
    # cache collector uses the same resource-bundle initialization before calls.
    init="https://data.krx.co.kr/comm/bldAttendant/executeForResourceBundle.cmd?baseName=krx.mdc.i18n.component&key=B128.bld"
    r=session.get(init,timeout=20)
    r.raise_for_status()
    try:r.json()
    except Exception:raise RuntimeError("KRX session initialization did not return JSON")
    return session

def _krx_last_working_day(session):
    date_str=pd.Timestamp.today().strftime("%Y%m%d")
    url="https://data.krx.co.kr/comm/bldAttendant/executeForResourceBundle.cmd"
    r=session.get(url,params={"baseName":"krx.mdc.i18n.component","key":"B161.bld","inDate":date_str},timeout=20)
    r.raise_for_status()
    try:
        j=r.json()
        return str(j["result"]["output"][0]["bis_work_dt"])
    except Exception as exc:
        raise RuntimeError(f"KRX working-day response invalid: {r.text[:120]}") from exc

def fetch_kr_index(code,minimum):
    session=_krx_session()
    trd_dd=_krx_last_working_day(session)
    url="https://data.krx.co.kr/comm/bldAttendant/getJsonData.cmd"
    form={
        "bld":"dbms/MDC/STAT/standard/MDCSTAT00601",
        "indIdx":code[0],
        "indIdx2":code[1:],
        "param1indIdx_finder_equidx0_1":"",
        "trdDd":trd_dd,
        "money":"1",
        "csvxls_isNo":"false",
    }
    r=session.post(url,data=form,timeout=30)
    r.raise_for_status()
    try:j=r.json()
    except Exception as exc:
        raise RuntimeError(f"KRX index {code} response was not JSON: {r.text[:160]}") from exc
    raw=j.get("output") or []
    if len(raw)<minimum:
        raise RuntimeError(f"KRX index {code} returned only {len(raw)} constituents")
    df=pd.DataFrame(raw).rename(columns={"ISU_SRT_CD":"Code","ISU_ABBRV":"Name","MKTCAP":"Marcap"})
    df["Code"]=df["Code"].astype(str).str.zfill(6)
    df.attrs["as_of"]=trd_dd
    return df

def fetch_etf_holdings_proxy(etf_code,expected,krx_df,market_name,index_name):
    # GoInsider publishes ETF holdings collected from exchange/issuer filings.
    # This is a fallback when KRX blocks anonymous constituent API access.
    url=f"https://goinsider.kr/etf/{etf_code}"
    r=requests.get(url,headers={"User-Agent":"Mozilla/5.0 PeppercornCapital/1.0"},timeout=45)
    r.raise_for_status()
    html=r.text
    krx_codes={}
    for row in records(krx_df):
        code=norm_kr(pick(row,"Code","Symbol","단축코드","종목코드"))
        market=str(pick(row,"Market","시장구분",default="") or "").upper()
        if code and (market_name.upper() in market or (market_name=="KOSPI" and market=="STK") or (market_name=="KOSDAQ" and market=="KSQ")):
            krx_codes[code]=pick(row,"Name","종목명","한글 종목명",default=code)
    # Holdings are embedded in the rendered document; restrict six-digit matches
    # to known KRX equities to avoid dates, fund codes, or navigation IDs.
    found=[]
    seen=set()
    for code in re.findall(r'(?<!\\d)(\\d{6})(?!\\d)',html):
        if code in krx_codes and code not in seen:
            seen.add(code);found.append(code)
    lower=max(expected-8,1);upper=expected+8
    if not lower<=len(found)<=upper:
        raise RuntimeError(f"GoInsider {index_name} proxy matched {len(found)} KRX equities, expected about {expected}")
    df=pd.DataFrame([{"Code":code,"Name":krx_codes[code]} for code in found])
    df.attrs.update({
        "composition_status":"PROXY_VALIDATED",
        "source":f"GoInsider {etf_code} holdings; source stated as KRX & issuer filings; benchmark owner KRX"
    })
    return df


def fetch_kr_index_with_fallback(code,minimum,proxy_fn):
    try:
        df=fetch_kr_index(code,minimum)
        df.attrs.update({"composition_status":"OFFICIAL_KRX","source":"KRX Data System MDCSTAT00601 official index constituents"})
        return df
    except Exception as exc:
        print(f"WARNING: official KRX {code} unavailable ({exc}); using validated market proxy")
        return proxy_fn()

def records(df): return df.where(pd.notna(df),None).to_dict("records")

def main():
    sp500=fetch_sp500();nasdaq=fetch_nasdaq();krx=fetch_krx_listing()
    kospi200=fetch_kr_index_with_fallback("1028",190,lambda:fetch_etf_holdings_proxy("069500",200,krx,"KOSPI","KOSPI200"))
    kosdaq150=fetch_kr_index_with_fallback("2203",145,lambda:fetch_etf_holdings_proxy("229200",150,krx,"KOSDAQ","KOSDAQ150"))

    krx_map={}
    for r in records(krx):
        ticker=norm_kr(pick(r,"Symbol","Code","단축코드","종목코드"))
        if ticker:krx_map[ticker]=r

    instruments={};memberships=[]
    def add(item,priority):
        key=(item["market"],item["ticker"]);old=instruments.get(key)
        if old is None or priority>=old.get("_priority",-1):
            item["_priority"]=priority;instruments[key]=item
    kr_index_meta={
        "KOSPI200":{"source":kospi200.attrs.get("source",SOURCES["KOSPI200"]),"status":kospi200.attrs.get("composition_status","UNKNOWN")},
        "KOSDAQ150":{"source":kosdaq150.attrs.get("source",SOURCES["KOSDAQ150"]),"status":kosdaq150.attrs.get("composition_status","UNKNOWN")},
    }
    def member(market,ticker,group,source,rank):
        if group in kr_index_meta:
            source=kr_index_meta[group]["source"];composition=kr_index_meta[group]["status"]
        else:
            composition="REFERENCE_TABLE" if group=="S&P500" else "NASDAQ_MARKET_COVERAGE"
        memberships.append({"id":str(uuid.uuid5(uuid.NAMESPACE_URL,f"peppercorn:index:{market}:{ticker}:{group}")),"market":market,"ticker":ticker,"entry_type":"INDEX","theme_group":group,"parent_etf_ticker":None,"holding_rank":rank,"weight":None,"as_of":TODAY,"source":source,"validation_status":"AUTO_CURRENT","composition_status":composition})

    for rank,r in enumerate(records(sp500),1):
        ticker=norm_us(pick(r,"Symbol","Ticker"))
        if not ticker:continue
        add({"market":"US","ticker":ticker,"name":pick(r,"Name",default=ticker),"asset_class":"Equity","exchange":"US","sector":pick(r,"Sector"),"industry":pick(r,"Industry"),"benchmark_ticker":"SPY","currency":"USD","active":True,"classification_scheme":"GICS sector · sub-industry","classification_source":"AUTO:Wikipedia S&P 500 table via FinanceDataReader; benchmark reference: S&P DJI","classification_as_of":TODAY,"universe_updated_at":NOW},3)
        member("US",ticker,"S&P500",SOURCES["S&P500"],rank)

    for r in nasdaq:
        ticker=norm_us(r.get("symbol"));key=("US",ticker)
        if ticker and key in instruments:instruments[key]["exchange"]="NASDAQ"

    def add_kr_index(df,group,market_name):
        for rank,r in enumerate(records(df),1):
            ticker=norm_kr(pick(r,"Code","Symbol","단축코드","종목코드"))
            if not ticker:continue
            meta=krx_map.get(ticker,{})
            sector=pick(meta,"Sector","업종","업종명")
            industry=sector
            name=pick(meta,"Name","종목명","한글 종목명") or pick(r,"Name","종목명") or ticker
            exchange=pick(meta,"Market","시장구분") or market_name
            add({"market":"KR","ticker":ticker,"name":name,"asset_class":"Equity","exchange":exchange,"sector":sector,"industry":industry,"benchmark_ticker":"069500","currency":"KRW","active":True,"classification_scheme":"KRX/KIND 업종","classification_source":"AUTO:FinanceData KRX-DESC cache (source: KRX/KIND company 업종)","classification_as_of":TODAY,"universe_updated_at":NOW},2)
            member("KR",ticker,group,SOURCES[group],rank)

    add_kr_index(kospi200,"KOSPI200","KOSPI");add_kr_index(kosdaq150,"KOSDAQ150","KOSDAQ")

    selected=set(instruments)
    for r in nasdaq:
        if len(selected)>=TARGET_EQUITIES:break
        ticker=norm_us(r.get("symbol"));key=("US",ticker)
        if not ticker or key in selected:continue
        add({"market":"US","ticker":ticker,"name":str(r.get("name") or ticker).strip(),"asset_class":"Equity","exchange":"NASDAQ","sector":str(r.get("sector") or "").strip() or None,"industry":str(r.get("industry") or "").strip() or None,"benchmark_ticker":"SPY","currency":"USD","active":True,"classification_scheme":"Nasdaq SIC mapped sector/industry","classification_source":"AUTO:Nasdaq Stock Screener / Quotemedia SIC mapping","classification_as_of":TODAY,"universe_updated_at":NOW},2)
        selected.add(key)

    for rank,r in enumerate([x for x in nasdaq if ("US",norm_us(x.get("symbol"))) in instruments],1):
        member("US",norm_us(r.get("symbol")),"NASDAQ_CORE",SOURCES["NASDAQ_CORE"],rank)

    items=[]
    for item in instruments.values():
        item=dict(item);item.pop("_priority",None);items.append(item)

    payload={"generated_at":NOW,"target_equities":TARGET_EQUITIES,"instruments":items,"memberships":memberships}
    OUTPUT.write_text(json.dumps(payload,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
    print(json.dumps({"output":str(OUTPUT),"instruments":len(items),"memberships":len(memberships)},ensure_ascii=False))

if __name__=="__main__":main()
