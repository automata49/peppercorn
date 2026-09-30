"""Collection targets: the dashboard's leading stocks from the public leaderboard, plus the reference companies.

  SEC_USER_AGENT=... DART_API_KEY=... python targets.py --out targets.json

Only public market data selects targets; a user's watchlist or portfolio never does (docs/harness/CONTRACT.md).
US tickers map to SEC CIKs through the SEC ticker list; KR stock codes map to OpenDART corporation codes through
OpenDART's corpCode.xml. A ticker that cannot be mapped is listed with its reason and skipped.
"""
from __future__ import annotations

import argparse
import io
import json
import os
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

import requests

import collect

LEADERBOARD_URL = "https://mhbcchegrbakearqptdr.supabase.co/functions/v1/leaderboard?client=peppercorn-public-read-v1"
SEC_TICKERS_URL = "https://www.sec.gov/files/company_tickers.json"
DART_CORP_URL = "https://opendart.fss.or.kr/api/corpCode.xml"
LEADING = {"핵심 주도", "주도 후보", "강세 전환"}
MAX_TARGETS = 160


def leaders(rows: list[dict]) -> list[dict]:
    """Equities the dashboard treats as leading or turning up, strongest RS first."""
    picked = [r for r in rows if r.get("asset_class") == "Equity" and r.get("leadership_class") in LEADING
              and r.get("market") in ("US", "KR") and r.get("ticker")]
    return sorted(picked, key=lambda r: (-(r.get("rs_rank") or 0), r["market"], r["ticker"]))


def sec_ciks(user_agent: str) -> dict[str, int]:
    body = requests.get(SEC_TICKERS_URL, headers={"User-Agent": user_agent}, timeout=60).json()
    return {row["ticker"].upper(): int(row["cik_str"]) for row in body.values()}


def dart_codes(key: str) -> dict[str, str]:
    response = requests.get(DART_CORP_URL, params={"crtfc_key": key}, timeout=120)
    response.raise_for_status()
    with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
        root = ET.fromstring(archive.read(archive.namelist()[0]))
    return {(item.findtext("stock_code") or "").strip(): item.findtext("corp_code").strip()
            for item in root.iter("list") if (item.findtext("stock_code") or "").strip()}


def build(rows: list[dict], ciks: dict[str, int], codes: dict[str, str], limit: int = MAX_TARGETS) -> tuple[list[dict], list[str]]:
    targets = {(t["market"], t["ticker"]): dict(t) for t in collect.TARGETS}
    skipped = []
    for row in leaders(rows):
        key = (row["market"], row["ticker"])
        if key in targets or len(targets) >= limit:
            continue
        base = {"ticker": row["ticker"], "market": row["market"], "name": row.get("name") or row["ticker"]}
        if row["market"] == "US":
            cik = ciks.get(row["ticker"].upper().replace(".", "-")) or ciks.get(row["ticker"].upper())
            if not cik:
                skipped.append(f"US:{row['ticker']}: not in the SEC ticker list")
                continue
            targets[key] = {**base, "source": "SEC", "cik": cik, "currency": "USD"}
        else:
            code = codes.get(row["ticker"])
            if not code:
                skipped.append(f"KR:{row['ticker']}: no OpenDART corporation code")
                continue
            targets[key] = {**base, "source": "DART", "corp_code": code, "currency": "KRW"}
    return list(targets.values()), skipped


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--out", default="targets.json")
    ap.add_argument("--limit", type=int, default=MAX_TARGETS)
    a = ap.parse_args()
    rows = requests.get(LEADERBOARD_URL, timeout=60).json()["rows"]
    ua, key = os.environ.get("SEC_USER_AGENT", ""), os.environ.get("DART_API_KEY", "")
    if "@" not in ua or not key:
        raise SystemExit("SEC_USER_AGENT and DART_API_KEY are required")
    targets, skipped = build(rows, sec_ciks(ua), dart_codes(key), a.limit)
    Path(a.out).write_text(json.dumps({"targets": targets, "skipped": skipped}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"{len(targets)} targets ({sum(t['market'] == 'US' for t in targets)} US, "
          f"{sum(t['market'] == 'KR' for t in targets)} KR); skipped {len(skipped)}")
    for line in skipped:
        print("  skipped", line)


if __name__ == "__main__":
    main()
