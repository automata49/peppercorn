import os
import time
import requests
import yfinance as yf

BASE=os.environ["SUPABASE_URL"].rstrip("/")
KEY=os.environ["SUPABASE_SECRET_KEY"]
HEAD={"apikey":KEY,"Content-Type":"application/json"}

def get(path):
    r=requests.get(BASE+"/rest/v1/"+path,headers=HEAD,timeout=60)
    r.raise_for_status()
    return r.json()

def upsert(table,rows,conflict):
    if not rows:return
    h=dict(HEAD)
    h["Prefer"]="resolution=merge-duplicates,return=minimal"
    url=BASE+"/rest/v1/"+table+"?on_conflict="+conflict
    r=requests.post(url,headers=h,json=rows,timeout=120)
    r.raise_for_status()

def symbol(item):
    if item["market"]!="KR":return item["ticker"]
    ex=(item.get("exchange") or "").upper()
    return item["ticker"]+(".KQ" if "KOSDAQ" in ex else ".KS")

def main():
    instruments=get("instruments?select=id,market,ticker,exchange&active=eq.true")
    failures=[]
    for idx,item in enumerate(instruments,1):
        s=symbol(item)
        try:
            frame=yf.download(s,period="18mo",interval="1d",auto_adjust=False,progress=False,threads=False)
            if frame.empty:
                failures.append(s);continue
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
            print("["+str(idx)+"/"+str(len(instruments))+"] "+s+": "+str(len(rows)))
            time.sleep(.15)
        except Exception as exc:
            failures.append(s);print("ERROR",s,exc)
    if failures:print("Failed:",",".join(failures))

if __name__=="__main__":main()
