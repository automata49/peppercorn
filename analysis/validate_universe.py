import os
import sys
import requests

BASE=os.environ["SUPABASE_URL"].rstrip("/")
KEY=os.environ["SUPABASE_SECRET_KEY"]
HEAD={"apikey":KEY,"Authorization":"Bearer "+KEY}

def get(path):
    r=requests.get(BASE+"/rest/v1/"+path,headers=HEAD,timeout=90)
    r.raise_for_status()
    return r.json()

def fail(msg):
    print("VALIDATION ERROR:",msg)
    sys.exit(1)

def main():
    memberships=get("universe_memberships?entry_type=eq.INDEX&select=instrument_id,theme_group,as_of,source&limit=5000")
    instruments=get("instruments?select=id,market,ticker,asset_class,sector,industry,classification_scheme,classification_source,classification_as_of&limit=5000")
    by_id={x["id"]:x for x in instruments}
    groups={}
    member_ids=set()
    for m in memberships:
        groups[m["theme_group"]]=groups.get(m["theme_group"],0)+1
        member_ids.add(m["instrument_id"])

    sp=groups.get("S&P500",0)
    k200=groups.get("KOSPI200",0)
    k150=groups.get("KOSDAQ150",0)
    nas=groups.get("NASDAQ_CORE",0)
    total=len(member_ids)

    if not 490 <= sp <= 520: fail(f"S&P500 count out of range: {sp}")
    if not 190 <= k200 <= 210: fail(f"KOSPI200 count out of range: {k200}")
    if not 140 <= k150 <= 160: fail(f"KOSDAQ150 count out of range: {k150}")
    if not 1400 <= total <= 1600: fail(f"unique universe count out of range: {total}")
    if nas < 700: fail(f"NASDAQ_CORE coverage unexpectedly small: {nas}")

    selected=[by_id[i] for i in member_ids if i in by_id]
    missing_sector=[x for x in selected if not x.get("sector")]
    missing_industry=[x for x in selected if not x.get("industry")]
    missing_source=[x for x in selected if not x.get("classification_source")]
    if len(missing_sector)/max(1,len(selected)) > .05:
        fail(f"missing sector >5%: {len(missing_sector)}/{len(selected)}")
    if len(missing_industry)/max(1,len(selected)) > .08:
        fail(f"missing industry >8%: {len(missing_industry)}/{len(selected)}")
    if missing_source:
        fail(f"classification provenance missing: {len(missing_source)}")

    print({
        "unique_equities":total,
        "memberships":groups,
        "missing_sector":len(missing_sector),
        "missing_industry":len(missing_industry),
        "classification_provenance":"PASS",
    })

if __name__=="__main__":
    main()
