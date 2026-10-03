"""STOCK-FLAGS-1: display-only warning flags published with each Pages deployment (step 2 of the leadership review).

  SEC_USER_AGENT=... DART_API_KEY=... python analysis/stock_flags.py --out dist/data/stock-flags.json

Per equity, from filed annual results (SEC XBRL frames CY2025 vs CY2024, a per-company fallback for leaders; OpenDART
2025 business reports) and, for leading stocks, Yahoo daily closes:
  loss        latest annual net income < 0
  no_revenue  annual revenue under $10M / 100억원, or a loss-making filer with no revenue line at all
  shrinking   annual revenue below the prior year
  jump        one day of +25% or more that is at least 60% of the last 63 sessions' log gain (event-driven move)
Only true flags are written; an unknown value is never a flag. The flags never change a classification, rank or
threshold. A failed source leaves its flags out and the file still publishes; a failed run publishes nothing.
"""
from __future__ import annotations

import argparse
import datetime
import json
import os
import sys
from pathlib import Path

import leadership_report as lr

VERSION = "STOCK-FLAGS-1"
JUMP_MIN_DAY, JUMP_MIN_SHARE = .25, .6
LEADING = ("핵심 주도", "주도 후보", "강세 전환")


def jump(closes: list[float]) -> dict | None:
    g = lr.single_day(closes)
    if not g or g["share"] is None or g["top_day"] < JUMP_MIN_DAY or g["share"] < JUMP_MIN_SHARE:
        return None
    return {"top_day": round(g["top_day"], 4), "share": round(g["share"], 4), "window_return": round(g["window_return"], 4)}


def flags_for(market: str, funda: dict | None, closes: list[float] | None) -> dict:
    f = lr.fundamental_flags(market, funda)
    out = {}
    for key in ("loss", "no_revenue", "shrinking"):
        if f.get(key) is True:
            out[key] = True
    if f.get("revenue_growth") is not None and f.get("shrinking"):
        out["revenue_growth"] = round(f["revenue_growth"], 4)
    j = jump(closes or [])
    if j:
        out["jump"] = j
    return out


def build(rows: list[dict], funda: dict, closes: dict) -> dict:
    flags = {}
    for r in rows:
        if r.get("asset_class") != "Equity" or r.get("market") not in ("US", "KR"):
            continue
        key = (r["market"], r["ticker"])
        f = flags_for(r["market"], funda.get(key), closes.get(key))
        if f:
            flags[f"{r['market']}:{r['ticker']}"] = f
    return flags


def main():  # pragma: no cover - network
    import requests
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="stock-flags.json")
    args = ap.parse_args()
    rows = requests.get(lr.LEADERBOARD_URL, params={"client": "peppercorn-public-read-v1"}, timeout=120).json()["rows"]
    eq = [r for r in rows if r.get("asset_class") == "Equity" and r.get("market") in ("US", "KR")]
    if len(eq) < 900:
        raise SystemExit(f"implausible leaderboard: {len(eq)} equities")
    leading = [r for r in eq if r.get("leadership_class") in LEADING]
    funda, sources = {}, {}
    ua, key = os.environ.get("SEC_USER_AGENT"), os.environ.get("DART_API_KEY")
    try:
        if not ua:
            raise RuntimeError("SEC_USER_AGENT not set")
        us = lr.us_fundamentals(ua, [r["ticker"] for r in eq if r["market"] == "US"],
                                fallback={r["ticker"] for r in leading if r["market"] == "US"})
        funda |= us
        sources["sec"] = f"{len(us)} US equities"
    except Exception as e:  # a failed source leaves its flags out
        sources["sec"] = f"failed: {e}"
    try:
        if not key:
            raise RuntimeError("DART_API_KEY not set")
        kr = lr.kr_fundamentals(key, [r["ticker"] for r in eq if r["market"] == "KR"])
        funda |= kr
        sources["dart"] = f"{len(kr)} KR equities"
    except Exception as e:
        sources["dart"] = f"failed: {e}"
    try:
        closes = lr.yahoo_closes(leading)
        sources["yahoo"] = f"{len(closes)} leading stocks"
    except Exception as e:
        closes, sources["yahoo"] = {}, f"failed: {e}"
    flags = build(eq, funda, closes)
    body = {"version": VERSION, "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
            "sources": sources, "thresholds": {"tiny_revenue": lr.TINY_REVENUE, "jump_min_day": JUMP_MIN_DAY, "jump_min_share": JUMP_MIN_SHARE},
            "flags": flags}
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out).write_text(json.dumps(body, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    counts = {k: sum(1 for f in flags.values() if k in f) for k in ("loss", "no_revenue", "shrinking", "jump")}
    print(f"{VERSION}: {len(flags)} flagged equities {counts}; sources {sources}")


if __name__ == "__main__":  # pragma: no cover
    sys.path.insert(0, str(Path(__file__).parent))
    main()
