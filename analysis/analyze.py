import os
import math
import requests
import numpy as np
import pandas as pd

BASE=os.environ["SUPABASE_URL"].rstrip("/")
KEY=os.environ["SUPABASE_SECRET_KEY"]
HEAD={"apikey":KEY,"Content-Type":"application/json"}

def get(path):
    r=requests.get(BASE+"/rest/v1/"+path,headers=HEAD,timeout=60)
    r.raise_for_status();return r.json()

def upsert(table,rows,conflict):
    if not rows:return
    h=dict(HEAD);h["Prefer"]="resolution=merge-duplicates,return=minimal"
    r=requests.post(BASE+"/rest/v1/"+table+"?on_conflict="+conflict,headers=h,json=rows,timeout=120)
    r.raise_for_status()

def ret(s,n):
    return float(s.iloc[-1]/s.iloc[-1-n]-1) if len(s)>n else None

def rsi(close,n=14):
    if len(close)<n+1:return None
    d=close.diff()
    gain=d.clip(lower=0).ewm(alpha=1/n,adjust=False).mean()
    loss=(-d.clip(upper=0)).ewm(alpha=1/n,adjust=False).mean()
    rs=gain/loss.replace(0,np.nan)
    value=100-100/(1+rs.iloc[-1])
    return None if pd.isna(value) else float(value)

def safe(v):
    if v is None or isinstance(v,str):return v
    if isinstance(v,(np.bool_,bool)):return bool(v)
    if isinstance(v,(np.integer,int)):return int(v)
    if isinstance(v,(np.floating,float)):
        return None if not math.isfinite(float(v)) else float(v)
    return v

def metric(frame):
    frame=frame.sort_values("trade_date").tail(270).copy()
    c=frame["close"].astype(float);h=frame["high"].astype(float);l=frame["low"].astype(float);v=frame["volume"].fillna(0).astype(float)
    p=float(c.iloc[-1]);ma50=float(c.tail(50).mean()) if len(c)>=50 else None;ma200=float(c.tail(200).mean()) if len(c)>=200 else None
    hi=float(h.tail(min(252,len(h))).max());lo=float(l.tail(min(252,len(l))).min())
    prev=c.shift(1);tr=pd.concat([(h-l).abs(),(h-prev).abs(),(l-prev).abs()],axis=1).max(axis=1)
    atr=float(tr.tail(20).mean()) if len(tr)>=20 else None
    adr=float(((h-l)/c.replace(0,np.nan)).tail(20).mean()) if len(c)>=20 else None
    vol20=float(v.tail(20).mean()) if len(v)>=20 else None
    return {
      "as_of":str(frame["trade_date"].iloc[-1]),"price":p,"ma50":ma50,"ma200":ma200,
      "high_52w":hi,"low_52w":lo,"return_1w":ret(c,5),"return_1m":ret(c,21),
      "return_3m":ret(c,63),"return_6m":ret(c,126),"return_12m":ret(c,252),
      "volume_ratio":float(v.iloc[-1]/vol20) if vol20 and vol20>0 else None,
      "adr20_pct":adr,"rsi14":rsi(c),"atr20_pct":float(atr/p) if atr and p else None,
      "high_52w_distance":float(p/hi-1) if hi else None,
      "atr_multiple":float(abs(p-ma50)/atr) if atr and ma50 else None,"data_days":int(len(frame))
    }

def main():
    instruments=get("instruments?select=*&active=eq.true")
    result={}
    for item in instruments:
        prices=get("price_daily?instrument_id=eq."+item["id"]+"&select=trade_date,open,high,low,close,volume&order=trade_date.asc&limit=400")
        if len(prices)>=22:result[item["id"]]=metric(pd.DataFrame(prices))

    bench={}
    for market,ticker in [("US","SPY"),("KR","069500")]:
        inst=next((x for x in instruments if x["market"]==market and x["ticker"]==ticker),None)
        if inst and inst["id"] in result:bench[market]=result[inst["id"]]

    for item in instruments:
        iid=item["id"]
        if iid not in result:continue
        m=result[iid];b=bench.get(item["market"],{})
        for h in ["1w","1m","3m","6m","12m"]:
            a=m.get("return_"+h);bb=b.get("return_"+h)
            m["rs_"+h]=(a-bb) if a is not None and bb is not None else None

    for market in ["US","KR"]:
        ids=[x["id"] for x in instruments if x["market"]==market and x["id"] in result]
        scores=[]
        for iid in ids:
            m=result[iid];vals=[(m.get("rs_1m"),.30),(m.get("rs_3m"),.30),(m.get("rs_6m"),.20),(m.get("rs_12m"),.20)]
            valid=[(v,w) for v,w in vals if v is not None]
            score=sum(v*w for v,w in valid)/sum(w for _,w in valid) if valid else None
            scores.append((iid,score))
        valid_scores=[s for _,s in scores if s is not None]
        for iid,score in scores:
            result[iid]["rs_rank"]=None if score is None or not valid_scores else int(round(1+98*sum(x<=score for x in valid_scores)/len(valid_scores)))

    payload=[]
    for item in instruments:
        iid=item["id"]
        if iid not in result:continue
        m=result[iid];p=m["price"];ma50=m.get("ma50");ma200=m.get("ma200");rank=m.get("rs_rank") or 0
        dist=m.get("high_52w_distance");rs1w=m.get("rs_1w");rs1m=m.get("rs_1m");atrx=m.get("atr_multiple")
        tt=sum([bool(p and ma50 and p>ma50),bool(ma50 and ma200 and ma50>ma200),bool(p and ma200 and p>ma200),bool(dist is not None and dist>=-.25),bool(rank>=70),bool(m.get("low_52w") and p>=m["low_52w"]*1.30)])
        leader=bool(p and ma50 and ma200 and p>ma50>ma200 and dist is not None and dist>=-.25 and rank>=70)
        correction=bool(p and ma50 and ma200 and p>ma200 and ma50>ma200 and rank>=70 and dist is not None and -.40<=dist<-.25)
        next_leader=bool(not leader and not correction and p and ma50 and p>ma50 and dist is not None and dist>=-.30 and (rs1w or -1)>0 and (rs1m or -1)>0)
        if leader and dist is not None and dist>=-.05:stage,verdict,guide="▲ 돌파 매수권","1. 주도","52주 고점(피벗) 돌파 + 거래량 ≥1.4배 확인"
        elif leader and atrx is not None and atrx<=2:stage,verdict,guide="● 눌림 매수권","1. 주도","MA50 지지와 거래량 회복 확인"
        elif leader and atrx is not None and atrx>=5:stage,verdict,guide="⛔ 과확장","1. 주도","추격 금지 · 신규 베이스 또는 눌림 대기"
        elif leader:stage,verdict,guide="■ 베이스 형성","1. 주도","베이스 상단 또는 피벗 확인"
        elif correction:stage,verdict,guide="◇ 조정 중 주도주","1. 주도","MA50 회복·새 베이스 형성 확인"
        elif next_leader:stage,verdict,guide="↻ 넥스트 리더","2. 강세 전환","RS순위 70↑ · 정배열 확인 시 리더 편입"
        elif p and ma200 and p<ma200:stage,verdict,guide="❌ 제외","약세","200일선 회복 및 RS 개선 대기"
        else:stage,verdict,guide="○ 관찰","중립","추세·RS 개선 대기"
        m.update({"instrument_id":iid,"tt_pass_count":tt,"leader_tt":leader,"stage":stage,"verdict":verdict,"action_guide":guide})
        payload.append({k:safe(v) for k,v in m.items()})

    for i in range(0,len(payload),400):upsert("market_metrics",payload[i:i+400],"instrument_id,as_of")
    print("upserted",len(payload),"market_metrics rows")

if __name__=="__main__":main()
