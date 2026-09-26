import json
import os
import re
import uuid
from datetime import date, datetime, timezone
from pathlib import Path
from io import StringIO

import FinanceDataReader as fdr
import pandas as pd
import requests

TODAY=date.today().isoformat()
NOW=datetime.now(timezone.utc).isoformat()
TARGET_EQUITIES=int(os.environ.get("PEPPERCORN_TARGET_EQUITIES","1500"))
OUTPUT=Path(os.environ.get("UNIVERSE_OUTPUT","universe_payload.json"))
NASDAQ_SCREENER="https://api.nasdaq.com/api/screener/stocks"
SOURCES={
    "S&P500":"FinanceDataReader S&P500 listing; official reference: S&P Dow Jones Indices",
    "NASDAQ_CORE":"Nasdaq Stock Screener; sector/industry mapped from Quotemedia SIC",
    "KOSPI200":"Naver Finance/Koscom KOSPI200 constituents; official benchmark: KRX",
    "KOSDAQ150":"KODEX KOSDAQ150 holdings via ETFmap fallback, cross-checked with PLUS ETF; official benchmark: KRX",
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
    df=fdr.StockListing("KRX")
    if len(df)<1500:raise RuntimeError(f"KRX listing returned only {len(df)} rows")
    return df

def fetch_kospi200():
    session=requests.Session()
    session.headers.update({"User-Agent":"Mozilla/5.0 (Peppercorn Capital universe sync)"})
    session.get("https://finance.naver.com/",timeout=30)
    found={}
    for page in range(1,30):
        r=session.get("https://finance.naver.com/sise/entryJongmok.naver",params={"indCode":"KPI200","page":page},timeout=30)
        r.raise_for_status()
        r.encoding=r.apparent_encoding or "euc-kr"
        pairs=re.findall(r'item/main\\.naver\\?code=(\\d{6})[^>]*>([^<]+)',r.text,re.I)
        if not pairs:
            if page>1:break
            continue
        for code,name in pairs:
            found[code]=re.sub(r"\\s+"," ",name).strip()
    if not 190<=len(found)<=210:
        raise RuntimeError(f"Naver KOSPI200 returned {len(found)} rows")
    return pd.DataFrame([{"Code":k,"Name":v} for k,v in found.items()])

def _norm_name(value):
    s=str(value or "").strip().upper()
    s=re.sub(r"[\\s·ㆍ.,()（）㈜주식회사]+","",s)
    s=s.replace("&","AND")
    return s

def _extract_etfmap_names(html):
    names=[]
    try:
        for table in pd.read_html(StringIO(html)):
            cols=[str(c).strip() for c in table.columns]
            name_col=next((c for c in table.columns if "종목명" in str(c)),None)
            if name_col is None:continue
            vals=[str(x).strip() for x in table[name_col].tolist() if pd.notna(x)]
            if len(vals)>=100:
                names.extend(vals)
    except Exception:
        pass
    if len(set(names))<100:
        # Fallback for Next/React serialized text or server-rendered rows.
        pairs=re.findall(r'(?:rank|순위|no)["\' :=]+\\d+.*?(?:name|종목명)["\' :=]+["\']([^"\']{2,40})["\']',html,re.I|re.S)
        names.extend(pairs)
    out=[]
    seen=set()
    for n in names:
        n=re.sub(r"\\s+"," ",n).strip()
        if not n or n in seen:continue
        seen.add(n);out.append(n)
    return out

def _plus_top_codes(url):
    try:
        r=requests.get(url,headers={"User-Agent":"Mozilla/5.0"},timeout=30);r.raise_for_status()
        tables=pd.read_html(StringIO(r.text))
        codes=[]
        for table in tables:
            code_col=next((c for c in table.columns if "종목코드" in str(c)),None)
            if code_col is None:continue
            for value in table[code_col].tolist():
                code=norm_kr(value)
                if code and code not in codes:codes.append(code)
        return codes[:10]
    except Exception:
        return []

def fetch_kosdaq150(krx_df):
    r=requests.get("https://etfmap.kr/etf/229200",headers={"User-Agent":"Mozilla/5.0"},timeout=45);r.raise_for_status()
    names=_extract_etfmap_names(r.text)
    by_name={}
    for row in records(krx_df):
        code=norm_kr(pick(row,"Symbol","Code","단축코드","종목코드"))
        name=pick(row,"Name","종목명","한글 종목명")
        if code and name:by_name.setdefault(_norm_name(name),(code,name))
    matched={}
    unmatched=[]
    for name in names:
        hit=by_name.get(_norm_name(name))
        if hit:matched[hit[0]]=hit[1]
        elif len(name)>1:unmatched.append(name)
    if not 145<=len(matched)<=155:
        raise RuntimeError(f"ETFmap KOSDAQ150 matched {len(matched)} rows; raw names={len(names)}; unmatched sample={unmatched[:12]}")
    official_top=_plus_top_codes("https://www.plusetf.co.kr/product/detail?n=006318")
    if official_top:
        overlap=len(set(official_top)&set(matched))
        if overlap<8:
            raise RuntimeError(f"KOSDAQ150 PLUS cross-check failed: {overlap}/{len(official_top)} top holdings matched")
    return pd.DataFrame([{"Code":k,"Name":v} for k,v in matched.items()])

def records(df): return df.where(pd.notna(df),None).to_dict("records")

def main():
    sp500=fetch_sp500();nasdaq=fetch_nasdaq();krx=fetch_krx_listing()
    kospi200=fetch_kospi200();kosdaq150=fetch_kosdaq150(krx)

    krx_map={}
    for r in records(krx):
        ticker=norm_kr(pick(r,"Symbol","Code","단축코드","종목코드"))
        if ticker:krx_map[ticker]=r

    instruments={};memberships=[]
    def add(item,priority):
        key=(item["market"],item["ticker"]);old=instruments.get(key)
        if old is None or priority>=old.get("_priority",-1):
            item["_priority"]=priority;instruments[key]=item
    def member(market,ticker,group,source,rank):
        composition="AUTO_CURRENT_PROXY" if group=="KOSDAQ150" else "AUTO_CURRENT"
        memberships.append({"id":str(uuid.uuid5(uuid.NAMESPACE_URL,f"peppercorn:index:{market}:{ticker}:{group}")),"market":market,"ticker":ticker,"entry_type":"INDEX","theme_group":group,"parent_etf_ticker":None,"holding_rank":rank,"weight":None,"as_of":TODAY,"source":source,"validation_status":"AUTO_CURRENT","composition_status":composition})

    for rank,r in enumerate(records(sp500),1):
        ticker=norm_us(pick(r,"Symbol","Ticker"))
        if not ticker:continue
        add({"market":"US","ticker":ticker,"name":pick(r,"Name",default=ticker),"asset_class":"Equity","exchange":"US","sector":pick(r,"Sector"),"industry":pick(r,"Industry"),"benchmark_ticker":"SPY","currency":"USD","active":True,"classification_scheme":"GICS-compatible S&P500 listing","classification_source":"AUTO:FinanceDataReader S&P500 listing; official reference: S&P DJI","classification_as_of":TODAY,"universe_updated_at":NOW},3)
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
            industry=pick(meta,"Industry","주요제품","산업") or sector
            name=pick(meta,"Name","종목명","한글 종목명") or pick(r,"Name","종목명") or ticker
            exchange=pick(meta,"Market","시장구분") or market_name
            add({"market":"KR","ticker":ticker,"name":name,"asset_class":"Equity","exchange":exchange,"sector":sector,"industry":industry,"benchmark_ticker":"069500","currency":"KRW","active":True,"classification_scheme":"KRX listing 업종 / 주요제품","classification_source":"AUTO:FinanceDataReader KRX listing adapter","classification_as_of":TODAY,"universe_updated_at":NOW},2)
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
