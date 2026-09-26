import os
import re
import uuid
from datetime import date, datetime, timezone

import FinanceDataReader as fdr
import pandas as pd
import requests

BASE=os.environ["SUPABASE_URL"].rstrip("/")
KEY=os.environ["SUPABASE_SECRET_KEY"]
HEAD={"apikey":KEY,"Authorization":"Bearer "+KEY,"Content-Type":"application/json"}
TODAY=date.today().isoformat()
NOW=datetime.now(timezone.utc).isoformat()
TARGET_EQUITIES=int(os.environ.get("PEPPERCORN_TARGET_EQUITIES","1500"))

NASDAQ_SCREENER="https://api.nasdaq.com/api/screener/stocks"
SOURCES={
    "S&P500":"FinanceDataReader S&P500 adapter; validation: S&P Dow Jones Indices",
    "NASDAQ_CORE":"Nasdaq Stock Screener",
    "KOSPI200":"KRX index constituents via FinanceDataReader",
    "KOSDAQ150":"KRX index constituents via FinanceDataReader",
}

def request(method,path,**kwargs):
    h=dict(HEAD);h.update(kwargs.pop("headers",{}))
    r=requests.request(method,BASE+"/rest/v1/"+path,headers=h,timeout=120,**kwargs)
    r.raise_for_status()
    if not r.text:return None
    return r.json()

def chunks(rows,n=400):
    for i in range(0,len(rows),n):yield rows[i:i+n]

def pick(row,*names,default=None):
    for name in names:
        if name in row and pd.notna(row[name]):
            value=str(row[name]).strip()
            if value and value.lower()!="nan": return value
    return default

def norm_us(symbol):
    return str(symbol or "").strip().upper().replace("/",".")

def norm_kr(symbol):
    s=re.sub(r"\D","",str(symbol or ""))
    return s.zfill(6) if s else ""

def market_cap(value):
    if value is None:return 0.0
    s=str(value).replace("$","").replace(",","").strip()
    mult=1.0
    if s.endswith(("T","B","M","K")):
        unit=s[-1];s=s[:-1]
        mult={"T":1e12,"B":1e9,"M":1e6,"K":1e3}[unit]
    try:return float(s)*mult
    except:return 0.0

def is_common_equity(row):
    symbol=norm_us(row.get("symbol"))
    name=str(row.get("name") or "").lower()
    if not symbol or any(x in name for x in [" warrant","warrant "," unit"," rights","right to"," preferred"," depositary"]):
        return False
    if symbol.endswith(("W","WS","U","R")) and len(symbol)>4:return False
    return True

def fetch_nasdaq():
    params={"tableonly":"true","limit":"10000","exchange":"nasdaq","download":"true"}
    headers={
        "User-Agent":"Mozilla/5.0 (Peppercorn Capital universe sync)",
        "Accept":"application/json, text/plain, */*",
        "Referer":"https://www.nasdaq.com/market-activity/stocks/screener",
    }
    r=requests.get(NASDAQ_SCREENER,params=params,headers=headers,timeout=60)
    r.raise_for_status()
    data=r.json().get("data") or {}
    rows=data.get("rows") or (data.get("table") or {}).get("rows") or []
    rows=[x for x in rows if is_common_equity(x)]
    rows.sort(key=lambda x:market_cap(x.get("marketCap")),reverse=True)
    if len(rows)<500:raise RuntimeError(f"Nasdaq screener returned only {len(rows)} equities")
    return rows

def fetch_sp500():
    df=fdr.StockListing("S&P500")
    if len(df)<480:raise RuntimeError(f"S&P500 adapter returned only {len(df)} rows")
    return df

def fetch_krx_listing():
    df=fdr.StockListing("KRX")
    if len(df)<1500:raise RuntimeError(f"KRX listing returned only {len(df)} rows")
    return df

def fetch_kr_index(code,minimum):
    df=fdr.SnapDataReader("KRX/INDEX/STOCK/"+code)
    if len(df)<minimum:raise RuntimeError(f"KRX index {code} returned only {len(df)} rows")
    return df

def frame_records(df):
    return df.where(pd.notna(df),None).to_dict("records")

def main():
    existing=request("GET","instruments?select=id,market,ticker,name,sector,industry,exchange,classification_source&limit=5000") or []
    existing_map={(x["market"],x["ticker"]):x for x in existing}

    sp500=fetch_sp500()
    nasdaq=fetch_nasdaq()
    krx=fetch_krx_listing()
    kospi200=fetch_kr_index("1028",180)
    kosdaq150=fetch_kr_index("2203",130)

    krx_map={}
    for r in frame_records(krx):
        ticker=norm_kr(pick(r,"Symbol","Code","단축코드","종목코드"))
        if ticker:krx_map[ticker]=r

    instruments={}
    memberships=[]

    def add_instrument(item,classification_priority=0):
        key=(item["market"],item["ticker"])
        old=instruments.get(key)
        if old is None or classification_priority>=old.pop("_classification_priority",0):
            item["_classification_priority"]=classification_priority
            instruments[key]=item
        elif old is not None:
            old["_classification_priority"]=max(old.get("_classification_priority",0),classification_priority)

    def add_membership(market,ticker,group,source,rank=None):
        stable=f"peppercorn:index:{market}:{ticker}:{group}"
        memberships.append({
            "id":str(uuid.uuid5(uuid.NAMESPACE_URL,stable)),
            "market":market,"ticker":ticker,
            "entry_type":"INDEX","theme_group":group,
            "parent_etf_ticker":None,"holding_rank":rank,"weight":None,
            "as_of":TODAY,"source":source,
            "validation_status":"AUTO_CURRENT","composition_status":"AUTO_CURRENT",
        })

    # S&P 500: use the adapter's GICS-style sector/industry fields, and keep provenance explicit.
    for rank,r in enumerate(frame_records(sp500),1):
        ticker=norm_us(pick(r,"Symbol","Ticker"))
        if not ticker:continue
        item={
            "market":"US","ticker":ticker,"name":pick(r,"Name",default=ticker),
            "asset_class":"Equity","exchange":"US",
            "sector":pick(r,"Sector"),"industry":pick(r,"Industry"),
            "benchmark_ticker":"SPY","currency":"USD","active":True,
            "classification_scheme":"GICS-compatible S&P500 adapter",
            "classification_source":"AUTO:FinanceDataReader S&P500; validated against S&P DJI",
            "classification_as_of":TODAY,"universe_updated_at":NOW,
        }
        add_instrument(item,3)
        add_membership("US",ticker,"S&P500",SOURCES["S&P500"],rank)

    # Nasdaq market universe: direct Nasdaq screener provides SIC-mapped market sector/industry.
    nasdaq_selected=[]
    for r in nasdaq:
        ticker=norm_us(r.get("symbol"))
        if not ticker:continue
        key=("US",ticker)
        if key not in instruments and len(instruments)>=TARGET_EQUITIES:
            break
        nasdaq_selected.append(r)
        item={
            "market":"US","ticker":ticker,"name":str(r.get("name") or ticker).strip(),
            "asset_class":"Equity","exchange":"NASDAQ",
            "sector":str(r.get("sector") or "").strip() or None,
            "industry":str(r.get("industry") or "").strip() or None,
            "benchmark_ticker":"SPY","currency":"USD","active":True,
            "classification_scheme":"Nasdaq SIC mapped sector/industry",
            "classification_source":"AUTO:Nasdaq Stock Screener / Quotemedia SIC mapping",
            "classification_as_of":TODAY,"universe_updated_at":NOW,
        }
        # Preserve S&P's GICS-compatible classification when already present, but improve exchange.
        if key in instruments:
            instruments[key]["exchange"]="NASDAQ"
        else:
            add_instrument(item,2)

    # KRX benchmark constituents and KRX market listing classifications.
    def add_kr_index(df,group,market_name):
        for rank,r in enumerate(frame_records(df),1):
            ticker=norm_kr(pick(r,"Code","Symbol","단축코드","종목코드"))
            if not ticker:continue
            meta=krx_map.get(ticker,{})
            existing_row=existing_map.get(("KR",ticker),{})
            sector=pick(meta,"Sector","업종","업종명") or existing_row.get("sector")
            industry=pick(meta,"Industry","주요제품","산업") or sector or existing_row.get("industry")
            name=pick(meta,"Name","종목명","한글 종목명") or pick(r,"Name","종목명") or existing_row.get("name") or ticker
            exchange=pick(meta,"Market","시장구분") or market_name
            item={
                "market":"KR","ticker":ticker,"name":name,
                "asset_class":"Equity","exchange":exchange,
                "sector":sector,"industry":industry,
                "benchmark_ticker":"069500","currency":"KRW","active":True,
                "classification_scheme":"KRX market listing classification",
                "classification_source":"AUTO:KRX market data via FinanceDataReader",
                "classification_as_of":TODAY,"universe_updated_at":NOW,
            }
            add_instrument(item,2)
            add_membership("KR",ticker,group,SOURCES[group],rank)

    add_kr_index(kospi200,"KOSPI200","KOSPI")
    add_kr_index(kosdaq150,"KOSDAQ150","KOSDAQ")

    # Fill to ~1500 unique benchmark/coverage equities with largest Nasdaq-listed equities.
    selected_keys=set(instruments)
    for r in nasdaq:
        if len(selected_keys)>=TARGET_EQUITIES:break
        ticker=norm_us(r.get("symbol"));key=("US",ticker)
        if not ticker or key in selected_keys:continue
        item={
            "market":"US","ticker":ticker,"name":str(r.get("name") or ticker).strip(),
            "asset_class":"Equity","exchange":"NASDAQ",
            "sector":str(r.get("sector") or "").strip() or None,
            "industry":str(r.get("industry") or "").strip() or None,
            "benchmark_ticker":"SPY","currency":"USD","active":True,
            "classification_scheme":"Nasdaq SIC mapped sector/industry",
            "classification_source":"AUTO:Nasdaq Stock Screener / Quotemedia SIC mapping",
            "classification_as_of":TODAY,"universe_updated_at":NOW,
        }
        add_instrument(item,2);selected_keys.add(key)

    # Nasdaq coverage membership is explicit that this is Peppercorn's market-cap coverage set, not an index.
    nasdaq_core=[r for r in nasdaq if ("US",norm_us(r.get("symbol"))) in instruments]
    for rank,r in enumerate(nasdaq_core,1):
        ticker=norm_us(r.get("symbol"))
        add_membership("US",ticker,"NASDAQ_CORE",SOURCES["NASDAQ_CORE"],rank)

    items=[]
    for item in instruments.values():
        item=dict(item);item.pop("_classification_priority",None)
        old=existing_map.get((item["market"],item["ticker"]),{})
        # Never replace a non-empty existing classification with a blank adapter value.
        for field in ("sector","industry","name","exchange"):
            if not item.get(field) and old.get(field):item[field]=old[field]
        items.append(item)

    for batch in chunks(items):
        request("POST","instruments?on_conflict=market,ticker",
                headers={"Prefer":"resolution=merge-duplicates,return=minimal"},json=batch)

    id_rows=request("GET","instruments?select=id,market,ticker&limit=5000") or []
    id_map={(x["market"],x["ticker"]):x["id"] for x in id_rows}

    request("DELETE","universe_memberships?entry_type=eq.INDEX")
    payload=[]
    for m in memberships:
        iid=id_map.get((m.pop("market"),m.pop("ticker")))
        if not iid:continue
        m["instrument_id"]=iid;payload.append(m)
    for batch in chunks(payload):
        request("POST","universe_memberships?on_conflict=id",
                headers={"Prefer":"resolution=merge-duplicates,return=minimal"},json=batch)

    counts={}
    for m in payload:counts[m["theme_group"]]=counts.get(m["theme_group"],0)+1
    print({
        "target_equities":TARGET_EQUITIES,
        "upserted_instruments":len(items),
        "memberships":counts,
        "classification_sources":{
            "US":"S&P500 adapter for S&P members; Nasdaq official screener SIC mapping for Nasdaq coverage",
            "KR":"KRX market listing via FinanceDataReader; no KRX GICS redistribution",
        },
    })

if __name__=="__main__":
    main()
