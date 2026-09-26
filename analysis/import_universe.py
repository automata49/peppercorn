import csv
import os
import uuid
from pathlib import Path
import requests

BASE=os.environ["SUPABASE_URL"].rstrip("/")
KEY=os.environ["SUPABASE_SECRET_KEY"]
HEAD={"apikey":KEY,"Content-Type":"application/json"}
SOURCE=Path(__file__).resolve().parents[1]/"migration"/"universe_snapshot_2026-09-26.csv"

def request(method,path,**kwargs):
    h=dict(HEAD)
    h.update(kwargs.pop("headers",{}))
    r=requests.request(method,BASE+"/rest/v1/"+path,headers=h,timeout=120,**kwargs)
    r.raise_for_status()
    if not r.text:return None
    return r.json()

def as_int(value):
    try:return int(float(str(value).replace(",","")))
    except:return None

def as_num(value):
    try:
        s=str(value).replace("%","").replace(",","").strip()
        if not s:return None
        n=float(s)
        return n/100 if "%" in str(value) else n
    except:return None

def as_date(value):
    s=str(value or "").strip()
    if not s:return None
    return s[:10].replace(".","-").replace("/","-")

def main():
    with SOURCE.open(encoding="utf-8-sig",newline="") as f:
        rows=list(csv.DictReader(f))

    instruments={}
    for r in rows:
        market=(r.get("시장(자동)") or "").strip()
        ticker=(r.get("Ticker") or "").strip()
        if market not in {"US","KR"} or not ticker:continue
        key=(market,ticker)
        item={
            "market":market,
            "ticker":ticker,
            "name":(r.get("종목명") or ticker).strip() or ticker,
            "asset_class":(r.get("Asset Class") or "Equity").strip() or "Equity",
            "exchange":(r.get("Exchange") or "").strip() or None,
            "sector":(r.get("Sector") or "").strip() or None,
            "industry":(r.get("Industry") or "").strip() or None,
            "role":(r.get("Role") or "").strip() or None,
            "priority":(r.get("Priority") or "").strip() or None,
            "theme":(r.get("Theme / Group") or "").strip() or None,
            "benchmark_ticker":"SPY" if market=="US" else "069500",
            "currency":"USD" if market=="US" else "KRW",
            "active":True
        }
        old=instruments.get(key)
        if old is None or (not old.get("name") and item.get("name")):
            instruments[key]=item

    items=list(instruments.values())
    h={"Prefer":"resolution=merge-duplicates,return=representation"}
    out=[]
    for i in range(0,len(items),400):
        result=request("POST","instruments?on_conflict=market,ticker",headers=h,json=items[i:i+400]) or []
        out.extend(result)

    id_map={(x["market"],x["ticker"]):x["id"] for x in request("GET","instruments?select=id,market,ticker") or []}

    memberships=[]
    for idx,r in enumerate(rows,1):
        market=(r.get("시장(자동)") or "").strip()
        ticker=(r.get("Ticker") or "").strip()
        instrument_id=id_map.get((market,ticker))
        if not instrument_id:continue
        stable="|".join([
            market,ticker,(r.get("구분") or ""),(r.get("Theme / Group") or ""),
            (r.get("상위 ETF") or ""),str(r.get("편입 순위") or ""),
            str(r.get("기준일") or ""),str(idx)
        ])
        memberships.append({
            "id":str(uuid.uuid5(uuid.NAMESPACE_URL,"peppercorn:"+stable)),
            "instrument_id":instrument_id,
            "entry_type":(r.get("구분") or "").strip() or None,
            "theme_group":(r.get("Theme / Group") or "").strip() or None,
            "parent_etf_ticker":(r.get("상위 ETF") or "").strip() or None,
            "holding_rank":as_int(r.get("편입 순위")),
            "weight":as_num(r.get("비중")),
            "as_of":as_date(r.get("기준일")),
            "source":(r.get("출처") or "").strip() or None,
            "gf_symbol":(r.get("GF Symbol 수동") or "").strip() or None,
            "validation_status":(r.get("가격·시장 검증") or "").strip() or None,
            "composition_status":(r.get("구성 기준일 상태") or "").strip() or None
        })

    hm={"Prefer":"resolution=merge-duplicates,return=minimal"}
    for i in range(0,len(memberships),400):
        request("POST","universe_memberships?on_conflict=id",headers=hm,json=memberships[i:i+400])

    print(f"Imported {len(items)} unique instruments and {len(memberships)} Universe membership rows.")

if __name__=="__main__":
    main()
