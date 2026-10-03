"""SEPA-DEFAULT backtest (read-only): what if SEPA-1 were the default leader setting instead of a badge?

  SEC_USER_AGENT=... DART_API_KEY=... python analysis/sepa_backtest.py

Registered 2026-10-03 by user request ("SEPA가 배지가 아니라 기본 셋팅으로 할 경우 결과 비교"), BEFORE any run. Nothing
here is active; the live classification stays v1 and SEPA stays a display badge/filter (LEADER-LENS-1).

At each month-end session (same dates, prices, RS rank and forward outcomes as analysis/leadership_backtest.py) every
stock is classified under v1 and the registered variants, and the leaders' forward 63/21-session excess return over the
benchmark (SPY / 226490), hit rate and 63-session max drawdown are compared with v1 by the LEADERSHIP-V2 gates G1-G4.
A composition snapshot at the latest session (no forward window needed) compares counts, industry mix and overlap.
Writes sepa_backtest.md / .json; never touches Supabase.
"""
from __future__ import annotations

import datetime
import hashlib
import json
import os
import sys
from pathlib import Path

import leadership_backtest as lb
import leadership_v2 as v2

RULES = {
    "version": "sepa-default-registration-1",
    "registered": "2026-10-03",
    "active": False,
    "sepa": "SEPA-1 as in analysis/stock_flags.py: 8 Trend Template conditions from daily closes (price > MA150 and MA200; "
            "MA150 > MA200; MA200 above its value 21 sessions earlier; MA50 > MA150 and MA200; price > MA50; price >= 1.30 x "
            "252-session closing low; price >= 0.75 x 252-session closing high; RS rank >= 70) AND latest quarterly revenue "
            "growth >= +20 % AND earnings growth >= +25 % vs the same quarter a year earlier (US diluted EPS, KR net income); "
            "a prior value <= 0 or a missing value fails",
    "point_in_time": "US SEC frames CY{Y}Q{Q} usable 50 days after the calendar quarter end; KR OpenDART Q1 from May 31, "
                     "half-year from Aug 31, Q3 from Nov 30, annual from Apr 15 of the next year; the latest usable quarter "
                     "with a revenue value, looking back at most 2 quarters (fiscal Q4s missing from quarterly frames)",
    "variants": {
        "v1-sepa": "v1 leaders (핵심 주도 + 주도 후보) that also pass SEPA-1 — SEPA filter on by default",
        "sepa": "SEPA-1 alone replaces the v1 classes",
        "tt8": "the 8 Trend Template conditions alone (no growth) — isolates the growth requirement",
        "v1-growth": "v1 leaders that pass only the growth part of SEPA-1 — isolates the Trend Template",
    },
    "gates": "LEADERSHIP-V2 G1-G4 against v1 (analysis/leadership_v2.py), 60/40 selection/holdout split; a variant passes "
             "only with G1-G4 in the selection period AND G1-G3 in the holdout, in both markets",
    "limits": "current universe members only (survivorship bias); Yahoo daily closes; SEC frames hold the latest filed value "
              "(restatements leak), DART cumulative half-year/Q3 amounts; app RS rank, not IBD's",
    "results": None,
}
RULES_SHA = hashlib.sha256(json.dumps({k: v for k, v in RULES.items() if k != "results"}, sort_keys=True, ensure_ascii=False).encode()).hexdigest()[:12]
VARIANTS = list(RULES["variants"])
REV_MIN, EPS_MIN = .20, .25
US_LAG_DAYS = 50
US_SECTOR_GICS = {"Technology": "Information Technology", "Finance": "Financials", "Basic Materials": "Materials",
                  "Telecommunications": "Communication Services", "Miscellaneous": "Other"}  # SECTOR-LABEL-1
KR_AVAILABLE = {"11013": (5, 31), "11012": (8, 31), "11014": (11, 30)}  # same year; annual "11011": Apr 15 next year


def quarter_end(y: int, q: int) -> datetime.date:
    return datetime.date(y, q * 3, 30 if q in (2, 3) else 31)


def us_available(y: int, q: int) -> datetime.date:
    return quarter_end(y, q) + datetime.timedelta(days=US_LAG_DAYS)


def kr_available(y: int, code: str) -> datetime.date:
    if code == "11011":
        return datetime.date(y + 1, 4, 15)
    m, d = KR_AVAILABLE[code]
    return datetime.date(y, m, d)


def growth_at(history: list[tuple[datetime.date, float | None, float | None]], date: datetime.date) -> dict | None:
    """history: (available_from, rev_growth, eps_growth) per period, any order. The latest usable period with a revenue
    value, looking back at most 2 periods."""
    usable = sorted((h for h in history if h[0] <= date), key=lambda h: h[0], reverse=True)[:3]
    for avail, rev, eps in usable:
        if rev is not None:
            return {"rev": rev, "eps": eps, "from": avail}
    return None


def growth_pass(g: dict | None) -> bool:
    return bool(g) and g["rev"] is not None and g["eps"] is not None and g["rev"] >= REV_MIN and g["eps"] >= EPS_MIN


def tt8(close, i: int, t: str, rs_rank) -> bool:
    """The 8 Trend Template conditions at session i from closes (sessions x tickers DataFrame)."""
    import numpy as np
    s = close[t].iloc[max(0, i - 272): i + 1]
    if len(s) < 273 or s.isna().any():
        return False
    v = s.to_numpy(dtype=float)
    p = v[-1]
    ma = lambda n, end=len(v): v[end - n:end].mean()
    m50, m150, m200, m200_then = ma(50), ma(150), ma(200), ma(200, len(v) - 21)
    year = v[-252:]
    return bool(p > m150 and p > m200 and m150 > m200 and m200 > m200_then and m50 > m150 and m50 > m200 and p > m50
                and p >= 1.30 * np.min(year) and p >= .75 * np.max(year) and rs_rank is not None and rs_rank >= 70)


def flags(m: dict, close, i: int, t: str, g: dict | None) -> dict:
    core, cand = v2.v1_flags(m)
    lead = core or cand
    grow = growth_pass(g)
    tt = tt8(close, i, t, m.get("rs_rank")) if (lead or grow or m.get("rs_rank") is not None and m["rs_rank"] >= 70) else False
    return {"v1": lead, "v1-sepa": lead and tt and grow, "sepa": tt and grow, "tt8": tt, "v1-growth": lead and grow}


def run_market(frames: dict, groups: dict, growth: dict, market: str) -> dict:
    idx = frames["close"].index
    names = ["v1"] + VARIANTS
    picks = {n: [] for n in names}
    dates = []
    for i in lb.month_ends(idx):
        d = idx[i].date()
        snap = lb.snapshot(frames, i, groups, {}, idx[i])
        fwd = {}
        dates.append(str(d))
        day = {n: [] for n in names}
        for t, m in snap.items():
            f = flags(m, frames["close"], i, t, growth_at(growth.get(t, []), d))
            for n in names:
                if f[n]:
                    if t not in fwd:
                        fwd[t] = lb.forward(frames, i, t)
                    if fwd[t]:
                        day[n].append({"ticker": t, **fwd[t]})
        for n in names:
            picks[n].append({"date": dates[-1], "leaders": day[n]})
    return {"dates": dates, "picks": picks}


def composition(frames: dict, groups: dict, sectors: dict, growth: dict) -> dict:
    """Leaders per rule at the latest session: count, top industry groups, sector shares, overlap with v1."""
    close = frames["close"]
    i = len(close) - 1
    d = close.index[i].date()
    snap = lb.snapshot(frames, i, groups, {}, close.index[i])
    sets = {n: set() for n in ["v1"] + VARIANTS}
    for t, m in snap.items():
        for n, ok in flags(m, close, i, t, growth_at(growth.get(t, []), d)).items():
            if ok:
                sets[n].add(t)
    out = {"date": str(d), "rules": {}}
    for n, ts in sets.items():
        count = lambda key: sorted(((k, sum(1 for t in ts if key(t) == k)) for k in {key(t) for t in ts}), key=lambda x: -x[1])
        out["rules"][n] = {"n": len(ts), "groups": count(lambda t: groups.get(t) or "—")[:6], "sectors": count(lambda t: sectors.get(t) or "—")[:5],
                           "semis": sum(1 for t in ts if "semiconductor" in (groups.get(t) or "").lower() or "반도체" in (groups.get(t) or "")),
                           "both_v1": len(ts & sets["v1"]), "tickers": sorted(ts)[:40]}
    return out


def evaluate(results: dict) -> dict:
    stats = {"selection": {}, "holdout": {}}
    for market, r in results.items():
        cut = int(len(r["dates"]) * .6)
        for n, ps in r["picks"].items():
            stats["selection"].setdefault(n, {})[market] = v2.summarize(ps[:cut])
            stats["holdout"].setdefault(n, {})[market] = v2.summarize(ps[cut:])
    verdict = {}
    for n in VARIANTS:
        sel = {m: v2.gates(stats["selection"][n][m], stats["selection"]["v1"][m], m) for m in results}
        hold = {m: v2.gates(stats["holdout"][n][m], stats["holdout"]["v1"][m], m) for m in results}
        verdict[n] = {"selection": sel, "holdout": hold,
                      "passes": all(all(g.values()) for g in sel.values()) and all(g["G1"] and g["G2"] and g["G3"] for g in hold.values())}
    return {"stats": stats, "verdict": verdict, "rules_sha": RULES_SHA,
            "periods": {m: {"selection": [r["dates"][0], r["dates"][int(len(r["dates"]) * .6) - 1]],
                            "holdout": [r["dates"][int(len(r["dates"]) * .6)], r["dates"][-1]]} for m, r in results.items() if r["dates"]}}


def markdown(ev: dict, comp: dict) -> str:
    pct = lambda x: "—" if x is None else f"{x * 100:+.1f}%"
    L = ["# SEPA 기본 설정 백테스트 (SEPA-DEFAULT)", "", f"사전등록 해시 `{ev['rules_sha']}` · " +
         ", ".join(f"{m}: 선택 {p['selection'][0]}~{p['selection'][1]}, 검증 {p['holdout'][0]}~{p['holdout'][1]}" for m, p in ev["periods"].items()), ""]
    for period, label in (("selection", "선택 구간"), ("holdout", "검증 구간")):
        L += [f"## {label}", "", "| 규칙 | 시장 | 평균 종목 수 | 63일 초과수익 | 21일 초과수익 | 63일 승률 | 낙폭 중앙값 | G1 | G2 | G3 | G4 |",
              "|---|---|---:|---:|---:|---:|---:|:-:|:-:|:-:|:-:|"]
        st = ev["stats"][period]
        for n in st:
            for m in ("US", "KR"):
                s = st[n].get(m)
                if not s:
                    continue
                g = v2.gates(s, st["v1"][m], m) if n != "v1" else {}
                mark = lambda k: "—" if n == "v1" else ("✅" if g[k] else "❌")
                L.append(f"| {n} | {m} | {s['avg_leaders']:.0f} | {pct(s['excess63'])} | {pct(s['excess21'])} | {pct(s['hit63'])} | {pct(s['median_dd'])} | {mark('G1')} | {mark('G2')} | {mark('G3')} | {mark('G4')} |")
        L.append("")
    L += ["## 판정", ""] + [f"- {n}: {'통과' if v['passes'] else '미통과'}" for n, v in ev["verdict"].items()] + [""]
    L += ["## 최근 시점 구성 (참고)", ""]
    for m, c in comp.items():
        L += [f"### {m} · {c['date']}", "", "| 규칙 | 종목 수 | v1과 공통 | 반도체 | 상위 업종 | 상위 섹터 |", "|---|---:|---:|---:|---|---|"]
        for n, r in c["rules"].items():
            L.append(f"| {n} | {r['n']} | {r['both_v1']} | {r['semis']} | {', '.join(f'{g} {k}' for g, k in r['groups'][:4])} | {', '.join(f'{g} {k}' for g, k in r['sectors'][:3])} |")
        L.append("")
    L += ["한계: " + RULES["limits"]]
    return "\n".join(L) + "\n"


# ---- network (not unit tested) -------------------------------------------------------------------------------
def load_us_growth(ua: str, tickers: list[str], years: range) -> dict:  # pragma: no cover - network
    import leadership_report as lr
    import stock_flags as sf
    sys.path.insert(0, str(Path(__file__).parent / "fundamentals"))
    import targets
    ciks = targets.sec_ciks(ua)
    rev, eps = {}, {}
    for y in years:
        for q in (1, 2, 3, 4):
            p = f"CY{y}Q{q}"
            r = {}
            for tag in lr.REVENUE_TAGS:
                for cik, v in lr.sec_frames(ua, tag, p).items():
                    r[cik] = max(r.get(cik, v), v)
            rev[(y, q)] = r
            eps[(y, q)] = {**lr.sec_frames(ua, "EarningsPerShareBasic", p, "USD-per-shares"), **lr.sec_frames(ua, "EarningsPerShareDiluted", p, "USD-per-shares")}
    out = {}
    for t in tickers:
        cik = ciks.get(t.upper().replace(".", "-")) or ciks.get(t.upper())
        if not cik:
            continue
        h = []
        for (y, q) in rev:
            if (y - 1, q) in rev and cik in rev[(y, q)]:
                h.append((us_available(y, q), sf.growth(rev[(y, q)].get(cik), rev[(y - 1, q)].get(cik)),
                          sf.growth(eps[(y, q)].get(cik), eps[(y - 1, q)].get(cik))))
        out[t] = h
    return out


def load_kr_growth(key: str, tickers: list[str], years: range) -> dict:  # pragma: no cover - network
    import time
    import requests
    import stock_flags as sf
    sys.path.insert(0, str(Path(__file__).parent / "fundamentals"))
    import targets
    codes = targets.dart_codes(key)
    by_code = {codes[t]: t for t in tickers if t in codes}
    items, out = list(by_code), {}
    for y in years:
        for code in ("11013", "11012", "11014", "11011"):
            for i in range(0, len(items), 100):
                body = requests.get("https://opendart.fss.or.kr/api/fnlttMultiAcnt.json",
                                    params={"crtfc_key": key, "corp_code": ",".join(items[i:i + 100]), "bsns_year": str(y), "reprt_code": code}, timeout=120).json()
                rows = body.get("list") or []
                for corp in {r["corp_code"] for r in rows}:
                    mine = [r for r in rows if r["corp_code"] == corp]
                    fs = "CFS" if any(r.get("fs_div") == "CFS" for r in mine) else "OFS"
                    mine = [r for r in mine if r.get("fs_div") == fs]
                    rv = next((r for r in mine if r.get("account_nm") in ("매출액", "영업수익", "수익(매출액)")), None)
                    ni = next((r for r in mine if (r.get("account_nm") or "").startswith("당기순이익")), None)
                    out.setdefault(by_code[corp], []).append((kr_available(y, code), sf.growth(*sf.dart_pair(rv, code == "11011")),
                                                             sf.growth(*sf.dart_pair(ni, code == "11011"))))
                time.sleep(.2)
    return out


def main():  # pragma: no cover - network
    import requests
    import leadership_report as lr
    rows = requests.get(lr.LEADERBOARD_URL, params={"client": "peppercorn-public-read-v1"}, timeout=120).json()["rows"]
    eq = [r for r in rows if r.get("asset_class") == "Equity" and r.get("market") in ("US", "KR")]
    ua, key = os.environ.get("SEC_USER_AGENT"), os.environ.get("DART_API_KEY")
    years = range(2021, 2027)
    growth = {"US": load_us_growth(ua, [r["ticker"] for r in eq if r["market"] == "US"], years) if ua else {},
              "KR": load_kr_growth(key, [r["ticker"] for r in eq if r["market"] == "KR"], years) if key else {}}
    print(f"growth histories: US {len(growth['US'])}, KR {len(growth['KR'])}", file=sys.stderr)
    results, comp = {}, {}
    for market in ("US", "KR"):
        mrows = [r for r in eq if r["market"] == market]
        groups = {r["ticker"]: (r.get("sector") if market == "KR" else r.get("industry")) for r in mrows}
        sectors = {r["ticker"]: (r.get("industry") if market == "KR" else US_SECTOR_GICS.get(r.get("sector"), r.get("sector"))) for r in mrows}
        frames = lb.load_prices(mrows, market)
        results[market] = run_market(frames, groups, growth[market], market)
        comp[market] = composition(frames, groups, sectors, growth[market])
        print(f"{market}: {len(results[market]['dates'])} dates", file=sys.stderr)
    ev = evaluate(results)
    md = markdown(ev, comp)
    Path("sepa_backtest.md").write_text(md, encoding="utf-8")
    Path("sepa_backtest.json").write_text(json.dumps({"evaluation": ev, "composition": comp}, ensure_ascii=False, indent=1, default=str), encoding="utf-8")
    print(md)


if __name__ == "__main__":  # pragma: no cover
    sys.path.insert(0, str(Path(__file__).parent))
    main()
