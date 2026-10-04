"""STOCK-FLAGS-1: display-only warning flags published with each Pages deployment (step 2 of the leadership review).

  SEC_USER_AGENT=... DART_API_KEY=... python analysis/stock_flags.py --out dist/data/stock-flags.json

Per equity, from filed annual results (SEC XBRL frames CY2025 vs CY2024, a per-company fallback for leaders; OpenDART
2025 business reports) and, for leading stocks, Yahoo daily closes:
  loss        latest annual net income < 0
  no_revenue  annual revenue under $10M / 100억원, or a loss-making filer with no revenue line at all
  shrinking   annual revenue below the prior year
  jump        one day of +25% or more that is at least 60% of the last 63 sessions' log gain (event-driven move)
GROWTH-1 / SEPA-1 (by user decision 2026-10-03, IBD/Minervini benchmark; display only):
  growth      latest reported quarter vs the same quarter a year earlier: revenue (rev) and diluted EPS (eps; KR uses
              net income because OpenDART's multi-company accounts carry no EPS). A prior value <= 0 leaves growth
              unknown. Written only when rev >= +20 % or eps >= +25 % (the SEPA thresholds), so the file stays small.
  sepa        Minervini SEPA screen: all 8 Trend Template conditions from 14 months of daily closes (price > MA150 and
              MA200, MA150 > MA200, MA200 above its value 21 sessions ago, MA50 > MA150 and MA200, price > MA50, price
              >= 1.30 x 52-week low, price >= 0.75 x 52-week high, app RS rank >= 70) AND quarterly EPS growth >= +25 %
              AND revenue growth >= +20 %. Any unknown input means no badge.
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
SEPA = {"version": "SEPA-1", "rev_growth_min": .20, "eps_growth_min": .25, "rs_rank_min": 70,
        "low_mult": 1.30, "high_mult": .75, "ma200_lookback": 21, "sessions": 252}


def growth(cur, prev) -> float | None:
    """Year-over-year growth; unknown when either value is missing or the prior value is not positive."""
    if cur is None or prev is None or prev <= 0:
        return None
    return round(cur / prev - 1, 6)  # rounded so an exact +20 % is not 19.999… %


def trend_template(closes: list[float], rs_rank) -> dict | None:
    """Minervini's 8 Trend Template conditions from daily closes (oldest first); None without 252 sessions."""
    c = [x for x in closes if x and x > 0]
    n = SEPA["sessions"]
    if len(c) < n:
        return None
    ma = lambda k, end=len(c): sum(c[end - k:end]) / k
    p, m50, m150, m200 = c[-1], ma(50), ma(150), ma(200)
    m200_then = ma(200, len(c) - SEPA["ma200_lookback"])
    year = c[-n:]
    lo, hi = min(year), max(year)
    conds = {"price_above_ma150_ma200": p > m150 and p > m200, "ma150_above_ma200": m150 > m200,
             "ma200_rising": m200 > m200_then, "ma50_above_ma150_ma200": m50 > m150 and m50 > m200,
             "price_above_ma50": p > m50, "above_52w_low": p >= SEPA["low_mult"] * lo,
             "near_52w_high": p >= SEPA["high_mult"] * hi, "rs_rank": rs_rank is not None and rs_rank >= SEPA["rs_rank_min"]}
    return {"pass": sum(conds.values()), "conditions": conds}


def sepa(tt: dict | None, g: dict | None) -> bool:
    if not tt or tt["pass"] < 8 or not g:
        return False
    rev, eps = g.get("rev"), g.get("eps")
    return rev is not None and eps is not None and rev >= SEPA["rev_growth_min"] and eps >= SEPA["eps_growth_min"]


def jump(closes: list[float]) -> dict | None:
    g = lr.single_day(closes)
    if not g or g["share"] is None or g["top_day"] < JUMP_MIN_DAY or g["share"] < JUMP_MIN_SHARE:
        return None
    return {"top_day": round(g["top_day"], 4), "share": round(g["share"], 4), "window_return": round(g["window_return"], 4)}


def flags_for(market: str, funda: dict | None, closes: list[float] | None, quarter: dict | None = None,
              tt_closes: list[float] | None = None, rs_rank=None) -> dict:
    f = lr.fundamental_flags(market, funda)
    out = {}
    for key in ("loss", "no_revenue", "shrinking"):
        if f.get(key) is True:
            out[key] = True
    if f.get("revenue_growth") is not None and f.get("shrinking"):
        out["revenue_growth"] = round(f["revenue_growth"], 4)
    j = jump((closes or [])[-64:])
    if j:
        out["jump"] = j
    if quarter:
        g = {k: round(v, 4) for k, v in quarter.items() if k in ("rev", "eps") and v is not None}
        if (g.get("rev") or -1) >= SEPA["rev_growth_min"] or (g.get("eps") or -1) >= SEPA["eps_growth_min"]:
            out["growth"] = g
    if sepa(trend_template(tt_closes or [], rs_rank), quarter):
        out["sepa"] = True
    return out


def us_quarter_candidates(today: datetime.date, lag_days: int = 50, n: int = 3) -> list[tuple[int, int]]:
    """Latest calendar quarters that ended at least `lag_days` ago (10-Q deadlines are 40-45 days), newest first."""
    y, q = today.year, (today.month - 1) // 3 + 1
    out = []
    while len(out) < n:
        q -= 1
        if q == 0:
            y, q = y - 1, 4
        end = datetime.date(y, q * 3, 30 if q in (2, 3) else 31)
        if (today - end).days >= lag_days:
            out.append((y, q))
    return out


def kr_report(today: datetime.date) -> tuple[int, str, str]:
    """(business year, OpenDART reprt_code, label) of the latest periodic report due (deadlines: 45 days after a
    quarter, 90 after the year) plus a two-week margin."""
    y, md = today.year, (today.month, today.day)
    if md >= (11, 30):
        return y, "11014", f"{y} 3분기"
    if md >= (8, 31):
        return y, "11012", f"{y} 반기"
    if md >= (5, 31):
        return y, "11013", f"{y} 1분기"
    if md >= (4, 15):
        return y - 1, "11011", f"{y - 1} 사업보고서"
    return y - 1, "11014", f"{y - 1} 3분기"


def dart_pair(row: dict | None, annual: bool) -> tuple[float | None, float | None]:
    """(this period, same period a year earlier) from an OpenDART multi-company account row. Quarterly reports
    compare the cumulative amounts when both exist, else the quarter amounts."""
    if not row:
        return None, None
    v = lambda k: lr.num(str(row.get(k) or "").replace(",", ""))
    if annual:
        return v("thstrm_amount"), v("frmtrm_amount")
    if v("thstrm_add_amount") is not None and v("frmtrm_add_amount") is not None:
        return v("thstrm_add_amount"), v("frmtrm_add_amount")
    return v("thstrm_amount"), v("frmtrm_q_amount")


def us_quarter_growth(ua: str, tickers: list[str], today: datetime.date) -> tuple[dict, str]:  # pragma: no cover - network
    sys.path.insert(0, str(Path(__file__).parent / "fundamentals"))
    import targets
    ciks = targets.sec_ciks(ua)

    def revenue(period):
        out = {}
        for tag in lr.REVENUE_TAGS:
            for cik, v in lr.sec_frames(ua, tag, period).items():
                out[cik] = max(out.get(cik, v), v)
        return out

    for y, q in us_quarter_candidates(today):
        cur = revenue(f"CY{y}Q{q}")
        if len(cur) < 1500:  # quarter not yet broadly filed (or a fiscal Q4 only reported in 10-Ks)
            continue
        prev = revenue(f"CY{y - 1}Q{q}")
        eps, eps_prev = ({**lr.sec_frames(ua, "EarningsPerShareBasic", p, "USD-per-shares"), **lr.sec_frames(ua, "EarningsPerShareDiluted", p, "USD-per-shares")}
                         for p in (f"CY{y}Q{q}", f"CY{y - 1}Q{q}"))
        out = {}
        for t in tickers:
            cik = ciks.get(t.upper().replace(".", "-")) or ciks.get(t.upper())
            if cik:
                out[("US", t)] = {"rev": growth(cur.get(cik), prev.get(cik)), "eps": growth(eps.get(cik), eps_prev.get(cik))}
        return out, f"CY{y}Q{q}"
    return {}, "none"


def kr_quarter_growth(key: str, tickers: list[str], today: datetime.date) -> tuple[dict, str]:  # pragma: no cover - network
    import requests
    import time
    sys.path.insert(0, str(Path(__file__).parent / "fundamentals"))
    import targets
    year, code, label = kr_report(today)
    codes = targets.dart_codes(key)
    by_code = {codes[t]: t for t in tickers if t in codes}
    items, out = list(by_code), {}
    for i in range(0, len(items), 100):
        body = requests.get("https://opendart.fss.or.kr/api/fnlttMultiAcnt.json",
                            params={"crtfc_key": key, "corp_code": ",".join(items[i:i + 100]), "bsns_year": str(year), "reprt_code": code}, timeout=120).json()
        rows = body.get("list") or []
        for corp in {r["corp_code"] for r in rows}:
            mine = [r for r in rows if r["corp_code"] == corp]
            fs = "CFS" if any(r.get("fs_div") == "CFS" for r in mine) else "OFS"
            mine = [r for r in mine if r.get("fs_div") == fs]
            rev = next((r for r in mine if r.get("account_nm") in ("매출액", "영업수익", "수익(매출액)")), None)
            ni = next((r for r in mine if (r.get("account_nm") or "").startswith("당기순이익")), None)
            out[("KR", by_code[corp])] = {"rev": growth(*dart_pair(rev, code == "11011")), "eps": growth(*dart_pair(ni, code == "11011"))}
        time.sleep(.3)
    return out, label


def build(rows: list[dict], funda: dict, closes: dict, quarters: dict | None = None) -> dict:
    """closes: 14 months of daily closes per (market, ticker); the jump check uses the last 64 of them."""
    flags, quarters = {}, quarters or {}
    for r in rows:
        if r.get("asset_class") != "Equity" or r.get("market") not in ("US", "KR"):
            continue
        key = (r["market"], r["ticker"])
        c = closes.get(key)
        f = flags_for(r["market"], funda.get(key), c if r.get("leadership_class") in LEADING else None,
                      quarters.get(key), c, r.get("rs_rank"))
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
    today = datetime.date.today()
    quarters, periods = {}, {}
    try:
        if not ua:
            raise RuntimeError("SEC_USER_AGENT not set")
        q, periods["US"] = us_quarter_growth(ua, [r["ticker"] for r in eq if r["market"] == "US"], today)
        quarters |= q
        sources["sec_quarter"] = f"{periods['US']}: {sum(1 for v in q.values() if v['rev'] is not None)} revenue, {sum(1 for v in q.values() if v['eps'] is not None)} EPS"
    except Exception as e:
        sources["sec_quarter"] = f"failed: {e}"
    try:
        if not key:
            raise RuntimeError("DART_API_KEY not set")
        q, periods["KR"] = kr_quarter_growth(key, [r["ticker"] for r in eq if r["market"] == "KR"], today)
        quarters |= q
        sources["dart_quarter"] = f"{periods['KR']}: {sum(1 for v in q.values() if v['rev'] is not None)} revenue, {sum(1 for v in q.values() if v['eps'] is not None)} net income"
    except Exception as e:
        sources["dart_quarter"] = f"failed: {e}"
    # Daily closes for the leading stocks (jump check) and for SEPA candidates: the existing trend structure
    # (leader_tt: price > MA50 > MA200, within 25 % of the high, RS rank >= 70) with both growth thresholds met.
    grows = lambda r: sepa({"pass": 8}, quarters.get((r["market"], r["ticker"])))
    wanted = {(r["market"], r["ticker"]): r for r in eq if r.get("leadership_class") in LEADING or (r.get("leader_tt") and grows(r))}
    try:
        closes = lr.yahoo_closes(list(wanted.values()), period="14mo")
        sources["yahoo"] = f"{len(closes)} of {len(wanted)} leading stocks and SEPA candidates"
    except Exception as e:
        closes, sources["yahoo"] = {}, f"failed: {e}"
    flags = build(eq, funda, closes, quarters)
    body = {"version": VERSION, "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
            "sources": sources, "growth_period": periods, "eps_basis": {"US": "diluted EPS", "KR": "net income"},
            "thresholds": {"tiny_revenue": lr.TINY_REVENUE, "jump_min_day": JUMP_MIN_DAY, "jump_min_share": JUMP_MIN_SHARE, "sepa": SEPA},
            "flags": flags}
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out).write_text(json.dumps(body, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    counts = {k: sum(1 for f in flags.values() if k in f) for k in ("loss", "no_revenue", "shrinking", "jump", "growth", "sepa")}
    print(f"{VERSION}: {len(flags)} flagged equities {counts}; sources {sources}")
    for m in ("US", "KR"):
        hits = [k for k, f in flags.items() if f.get("sepa") and k.startswith(m)]
        print(f"SEPA {m} ({len(hits)}): {', '.join(sorted(hits)[:60])}")
    for k in ("US:NVDA", "US:MU", "US:AVGO", "US:KOD", "KR:005930", "KR:000660"):
        print(k, quarters.get(tuple(k.split(":"))), flags.get(k))


if __name__ == "__main__":  # pragma: no cover
    sys.path.insert(0, str(Path(__file__).parent))
    main()
