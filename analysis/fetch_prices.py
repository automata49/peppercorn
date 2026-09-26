import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
import yfinance as yf

BASE=os.environ["SUPABASE_URL"].rstrip("/")
KEY=os.environ["SUPABASE_SECRET_KEY"]
HEAD={"apikey":KEY,"Authorization":"Bearer "+KEY,"Content-Type":"application/json"}
WORKERS=int(os.environ.get("PEPPERCORN_PRICE_WORKERS","8"))

def get(path):
    r=requests.get(BASE+"/rest/v1/"+path,headers=HEAD,timeout=60)
    r.raise_for_status()
    return r.json()

def upsert(table,rows,conflict):
    if not rows:return
    h=dict(HEAD);h["Prefer"]="resolution=merge-duplicates,return=minimal"
    url=BASE+"/rest/v1/"+table+"?on_conflict="+conflict
    r=requests.post(url,headers=h,json=rows,timeout=120)
    r.raise_for_status()

def symbol(item):
    if item["market"]!="KR":
        return item["ticker"].replace(".","-")
    ex=(item.get("exchange") or "").upper()
    return item["ticker"]+(".KQ" if "KOSDAQ" in ex else ".KS")

def fetch_one(item,initialized):
    s=symbol(item)
    period="3mo" if item["id"] in initialized else "18mo"
    try:
        frame=yf.download(s,period=period,interval="1d",auto_adjust=False,progress=False,threads=False)
        if frame.empty:return s,0,"empty"
        if getattr(frame.columns,"nlevels",1)>1:
            frame.columns=frame.columns.get_level_values(0)
        rows=[]
        for dt,row in frame.iterrows():
            close=row.get("Close")
            if close is None or close!=close:continue
            rows.append({
                "instrument_id":item["id"],"trade_date":dt.date().isoformat(),
                "open":float(row["Open"]) if row.get("Open")==row.get("Open") else None,
                "high":float(row["High"]) if row.get("High")==row.get("High") else None,
                "low":float(row["Low"]) if row.get("Low")==row.get("Low") else None,
                "close":float(close),
                "volume":int(row["Volume"]) if row.get("Volume")==row.get("Volume") else None
            })
        for i in range(0,len(rows),400):
            upsert("price_daily",rows[i:i+400],"instrument_id,trade_date")
        return s,len(rows),None
    except Exception as exc:
        return s,0,str(exc)

def main():
    instruments=get("instruments?select=id,market,ticker,exchange,asset_class&active=eq.true&limit=5000")
    metric_rows=get("market_metrics?select=instrument_id&limit=5000")
    initialized={x["instrument_id"] for x in metric_rows}
    failures=[];done=0;price_rows=0
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futures={pool.submit(fetch_one,item,initialized):item for item in instruments}
        for fut in as_completed(futures):
            s,n,err=fut.result();done+=1;price_rows+=n
            if err:failures.append(s+":"+err)
            if done%50==0 or done==len(instruments):
                print(f"[{done}/{len(instruments)}] price rows={price_rows} failures={len(failures)}")
            time.sleep(.02)
    if failures:
        print("Failed sample:",failures[:50])
    print({"instruments":len(instruments),"price_rows":price_rows,"failures":len(failures)})

if __name__=="__main__":main()
