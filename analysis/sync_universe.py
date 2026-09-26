import json
import os
import re
import uuid
from datetime import date, datetime, timezone
from pathlib import Path

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
    "KOSPI200":"KRX index constituent snapshot via FinanceDataReader",
    "KOSDAQ150":"KRX index constituent snapshot via FinanceDataReader",
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

def fetch_kr_index(code,minimum):
    df=fdr.SnapDataReader("KRX/INDEX/STOCK/"+code)
    if len(df)<minimum:raise RuntimeError(f"KRX index {code} returned only {len(df)} rows")
    return df

def records(df): return df.where(pd.notna(df),None).to_dict("records")

def main():
    sp500=fetch_sp500();nasdaq=fetch_nasdaq();krx=fetch_krx_listing()
    kospi200=fetch_kr_index("1028",180);kosdaq150=fetch_kr_index("2203",130)

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
        memberships.append({"id":str(uuid.uuid5(uuid.NAMESPACE_URL,f"peppercorn:index:{market}:{ticker}:{group}")),"market":market,"ticker":ticker,"entry_type":"INDEX","theme_group":group,"parent_etf_ticker":None,"holding_rank":rank,"weight":None,"as_of":TODAY,"source":source,"validation_status":"AUTO_CURRENT","composition_status":"AUTO_CURRENT"})

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
