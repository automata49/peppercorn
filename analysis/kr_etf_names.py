"""Official Korean short names (KRX ISU_ABBRV) for the KR ETFs in the universe snapshot.

The snapshot that created the ETF instruments has no name column, so the app would otherwise show a
ticker or a non-Korean label. This writes a ticker -> name map that the web app applies to KR ETFs only.
Run where KRX is reachable (GitHub Actions): python analysis/kr_etf_names.py [output.json]
"""
import csv
import json
import sys
from pathlib import Path

import requests

ROOT=Path(__file__).resolve().parents[1]
SNAPSHOT=ROOT/"migration"/"universe_snapshot_2026-09-26.csv"
OUTPUT=Path(sys.argv[1]) if len(sys.argv)>1 else ROOT/"src"/"data"/"krEtfNames.json"
HEADERS={
    "User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Referer":"https://data.krx.co.kr/contents/MDC/MDI/outerLoader/index.cmd",
}
BUNDLE="https://data.krx.co.kr/comm/bldAttendant/executeForResourceBundle.cmd"
DATA="https://data.krx.co.kr/comm/bldAttendant/getJsonData.cmd"


def snapshot_tickers():
    with SNAPSHOT.open(encoding="utf-8-sig",newline="") as f:
        rows=list(csv.DictReader(f))
    return sorted({r["Ticker"].strip() for r in rows if r.get("Asset Class")=="ETF" and r.get("시장(자동)")=="KR" and r.get("Ticker")})


def last_working_day(session):
    from datetime import date
    r=session.get(BUNDLE,params={"baseName":"krx.mdc.i18n.component","key":"B161.bld","inDate":date.today().strftime("%Y%m%d")},timeout=20)
    r.raise_for_status()
    return str(r.json()["result"]["output"][0]["bis_work_dt"])


def krx_etf_names():
    session=requests.Session();session.headers.update(HEADERS)
    # KRX requires a session cookie even for public MDC endpoints (same as sync_universe.py).
    session.get(BUNDLE,params={"baseName":"krx.mdc.i18n.component","key":"B128.bld"},timeout=20).raise_for_status()
    trd_dd=last_working_day(session)
    errors=[]
    # MDCSTAT04301: 전종목 ETF 시세; MDCSTAT04601: 전종목 ETF 기본정보. Both carry ISU_SRT_CD and ISU_ABBRV.
    for bld in ("dbms/MDC/STAT/standard/MDCSTAT04301","dbms/MDC/STAT/standard/MDCSTAT04601"):
        r=session.post(DATA,data={"bld":bld,"locale":"ko_KR","trdDd":trd_dd,"share":"1","money":"1","csvxls_isNo":"false"},timeout=30)
        if not r.ok:errors.append(f"{bld} {r.status_code} {r.text[:120]}");continue
        rows=r.json().get("output") or []
        if len(rows)<500:errors.append(f"{bld} returned {len(rows)} rows");continue
        print(f"source: KRX {bld} trdDd={trd_dd} ({len(rows)} ETFs)")
        return {str(x["ISU_SRT_CD"]).strip().upper():str(x["ISU_ABBRV"]).strip() for x in rows if x.get("ISU_SRT_CD") and x.get("ISU_ABBRV")}
    raise RuntimeError("KRX ETF listing unavailable: "+" | ".join(errors))


def naver_etf_names():
    # Naver Finance ETF list (same source as FinanceDataReader StockListing("ETF/KR")).
    r=requests.get("https://finance.naver.com/api/sise/etfItemList.nhn",headers={"User-Agent":HEADERS["User-Agent"]},timeout=30)
    r.raise_for_status()
    rows=((r.json().get("result") or {}).get("etfItemList")) or []
    if len(rows)<500:raise RuntimeError(f"Naver ETF list returned only {len(rows)} rows")
    print(f"source: Naver Finance etfItemList ({len(rows)} ETFs)")
    return {str(x["itemcode"]).strip().upper():str(x["itemname"]).strip() for x in rows if x.get("itemcode") and x.get("itemname")}


def pykrx_names(tickers):
    from pykrx import stock
    out={}
    for t in tickers:
        try:
            name=str(stock.get_etf_ticker_name(t) or "").strip()
            if name:out[t.upper()]=name
        except Exception as exc:
            print(f"pykrx {t}: {exc}")
    print(f"source: pykrx get_etf_ticker_name ({len(out)} names)")
    return out


def main():
    tickers=snapshot_tickers()
    listing={}
    for label,source in (("KRX",krx_etf_names),("Naver",naver_etf_names),("pykrx",lambda:pykrx_names(tickers))):
        try:listing=source()
        except Exception as exc:
            print(f"WARNING: {label} unavailable: {str(exc)[:300]}");continue
        if sum(t.upper() in listing for t in tickers)>=len(tickers)*0.9:break
    names={t:listing[t.upper()] for t in tickers if t.upper() in listing}
    missing=[t for t in tickers if t not in names]
    OUTPUT.parent.mkdir(parents=True,exist_ok=True)
    OUTPUT.write_text(json.dumps(names,ensure_ascii=False,indent=1,sort_keys=True)+"\n",encoding="utf-8")
    print(json.dumps(names,ensure_ascii=False,sort_keys=True))
    print(f"KR ETF names: {len(names)}/{len(tickers)} matched; missing: {' '.join(missing) or 'none'}")
    # A delisted ETF keeps its existing label; an empty result means the source changed.
    if len(names)<len(tickers)*0.9:raise SystemExit("too few KR ETF names matched")


if __name__=="__main__":main()
