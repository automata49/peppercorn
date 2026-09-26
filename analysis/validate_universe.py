import json
import os
import sys
from pathlib import Path
from kr_classification import WICS_HIERARCHY

PATH=Path(os.environ.get("UNIVERSE_OUTPUT","universe_payload.json"))

def fail(msg):
    print("VALIDATION ERROR:",msg)
    sys.exit(1)

def main():
    payload=json.loads(PATH.read_text(encoding="utf-8"))
    instruments=payload.get("instruments") or []
    memberships=payload.get("memberships") or []
    groups={}
    statuses={}
    member_keys=set()
    by_key={(x["market"],x["ticker"]):x for x in instruments}
    for m in memberships:
        groups[m["theme_group"]]=groups.get(m["theme_group"],0)+1
        statuses.setdefault(m["theme_group"],set()).add(m.get("composition_status"))
        member_keys.add((m["market"],m["ticker"]))

    sp=groups.get("S&P500",0);k200=groups.get("KOSPI200",0);k150=groups.get("KOSDAQ150",0);nas=groups.get("NASDAQ",0)
    total=len(by_key)
    if not 490<=sp<=520:fail(f"S&P500 count out of range: {sp}")
    if not 190<=k200<=210:fail(f"KOSPI200 count out of range: {k200}")
    if not 140<=k150<=160:fail(f"KOSDAQ150 count out of range: {k150}")
    if not 1400<=total<=1600:fail(f"unique universe count out of range: {total}")
    if nas<700:fail(f"NASDAQ coverage unexpectedly small: {nas}")
    allowed_kr={"OFFICIAL_KRX","OFFICIAL_KRX_ADAPTER","MARKET_PROXY_TRADINGVIEW","PROXY_VALIDATED"}
    for group in ("KOSPI200","KOSDAQ150"):
        status=statuses.get(group) or set()
        if len(status)!=1 or not status.issubset(allowed_kr):fail(f"{group} invalid composition status: {status}")
        if status & {"MARKET_PROXY_TRADINGVIEW","PROXY_VALIDATED"}:print(f"VALIDATION WARNING: {group} uses validated market proxy because KRX anonymous access is blocked: {status}")

    missing_sector=[x for x in instruments if not x.get("sector")]
    missing_industry=[x for x in instruments if not x.get("industry")]
    missing_source=[x for x in instruments if not x.get("classification_source")]
    if missing_sector:
        by_market={}
        for x in missing_sector:by_market[x.get("market","?")]=by_market.get(x.get("market","?"),0)+1
        print("MISSING SECTOR BY MARKET:",by_market)
    if missing_industry:
        by_market={}
        for x in missing_industry:by_market[x.get("market","?")]=by_market.get(x.get("market","?"),0)+1
        print("MISSING INDUSTRY BY MARKET:",by_market)
    if len(missing_sector)/max(1,total)>.05:fail(f"missing sector >5%: {len(missing_sector)}/{total}")
    if len(missing_industry)/max(1,total)>.08:fail(f"missing industry >8%: {len(missing_industry)}/{total}")
    if missing_source:fail(f"classification provenance missing: {len(missing_source)}")

    kr=[x for x in instruments if x.get("market")=="KR"]
    invalid=[x["ticker"] for x in kr if x.get("sector") and
             x.get("sector") not in WICS_HIERARCHY.get(x.get("industry"),{})]
    if invalid:fail(f"KR WICS industry/sector hierarchy mismatch: {invalid[:15]}")
    if sum(bool(x.get("sector")) for x in kr)<len(kr)*.95:
        fail("KR WICS coverage below 95%")
    examples={"008930":("건강관리","제약과생물공학"),
              "042700":("IT","반도체와반도체장비"),
              "128940":("건강관리","제약과생물공학")}
    for ticker,category in examples.items():
        item=by_key.get(("KR",ticker))
        if item and (item.get("industry"),item.get("sector"))!=category:
            fail(f"KR WICS classification check failed for {ticker}: {item.get('industry')}/{item.get('sector')}")

    print(json.dumps({"unique_equities":total,"memberships":groups,"composition_statuses":{k:sorted(v) for k,v in statuses.items()},"missing_sector":len(missing_sector),"missing_industry":len(missing_industry),"kr_wics_classified":sum(bool(x.get("sector")) for x in kr),"kr_total":len(kr),"classification_provenance":"PASS"},ensure_ascii=False))

if __name__=="__main__":main()
