"""UNIVERSE-2 impact simulation (read-only; writes a Markdown report and JSON, never the database).

Inputs: universe_decisions.json from `PEPPERCORN_UNIVERSE_VERSION=2 python sync_universe.py` and the current active
universe from the public leaderboard function. Daily prices for every stock in either population come from Yahoo.
For each population (current v1, screened v2) it recomputes, with the live SQL definitions mirrored in Python:
RS 1W/1M/3M/6M/12M against SPY / 226490, the weighted RS score and RS rank (round(1+98*cume_dist) per market), the
IBD-style estimate (>=253 sessions), the Trend Template structure and the leadership class (핵심 주도, 주도 후보,
강세 전환). Both populations use the same prices, so differences come from the population alone.
Mirrors: recalculate_market_leadership() and recalculate_ibd_rs_estimate() in
supabase/migrations/*_kr_benchmark_kospi.sql; returns as in supabase/functions/refresh-market (n sessions back).
"""
from __future__ import annotations

import json
import math
import os
import sys
from pathlib import Path

PERIODS = {"1w": 5, "1m": 21, "3m": 63, "6m": 126, "12m": 252}
WEIGHTS = {"1m": .30, "3m": .30, "6m": .20, "12m": .20}
BENCH = {"US": "SPY", "KR": "226490"}
WATCH = [("US", "OKLO"), ("KR", "353200"), ("KR", "119850")]  # names the user reported missing


def ret(closes: list[float], n: int) -> float | None:
    return closes[-1] / closes[-1 - n] - 1 if len(closes) > n and closes[-1 - n] else None


def metrics(closes: list[float], highs: list[float], lows: list[float]) -> dict:
    """Price-derived inputs, as refresh-market computes them (52W window = last 252 sessions)."""
    c = [x for x in closes if x is not None and x > 0]
    if not c:
        return {}
    mean = lambda xs: sum(xs) / len(xs)
    hi = max(h for h in highs[-252:] if h is not None) if highs else None
    lo = min(x for x in lows[-252:] if x is not None) if lows else None
    return {
        "price": c[-1],
        "ma50": mean(c[-50:]) if len(c) >= 50 else None,
        "ma200": mean(c[-200:]) if len(c) >= 200 else None,
        "high_52w_distance": c[-1] / hi - 1 if hi else None,
        "low_52w": lo,
        "sessions": len(c),
        **{f"return_{k}": ret(c, n) for k, n in PERIODS.items()},
        "ibd_score": (.40 * (c[-1] / c[-64] - 1) + .20 * (c[-64] / c[-127] - 1) + .20 * (c[-127] / c[-190] - 1)
                      + .20 * (c[-190] / c[-253] - 1)) if len(c) >= 253 else None,
    }


def rs(m: dict, bench: dict) -> dict:
    out = {}
    for k in PERIODS:
        a, b = m.get(f"return_{k}"), bench.get(f"return_{k}")
        out[f"rs_{k}"] = a - b if a is not None and b is not None else None
    return out


def score(r: dict) -> float | None:
    w = {k: v for k, v in WEIGHTS.items() if r.get(f"rs_{k}") is not None}
    return sum(r[f"rs_{k}"] * v for k, v in w.items()) / sum(w.values()) if w else None


def cume_rank(values: dict) -> dict:
    """round(1+98*cume_dist()) over non-null values; ties share the highest cume_dist like Postgres."""
    known = sorted(v for v in values.values() if v is not None)
    n = len(known)
    out = {}
    for key, v in values.items():
        if v is None or not n:
            out[key] = None
            continue
        lo, hi = 0, n
        while lo < hi:  # bisect_right
            mid = (lo + hi) // 2
            if known[mid] <= v:
                lo = mid + 1
            else:
                hi = mid
        out[key] = int(math.floor(1 + 98 * lo / n + 0.5))
    return out


def classify(m: dict) -> str:
    g = lambda k, d=None: m.get(k) if m.get(k) is not None else d
    price, ma50, ma200, hd, rank = g("price"), g("ma50"), g("ma200"), g("high_52w_distance"), g("rs_rank")
    up = price is not None and ma50 is not None and ma200 is not None and price > ma50 > ma200
    structural = up and hd is not None and hd >= -.25 and rank is not None and rank >= 70
    core = up and hd is not None and hd >= -.15 and rank is not None and rank >= 95 and g("rs_3m", -1) > 0 and g("rs_6m", -1) > 0
    candidate = up and hd is not None and hd >= -.25 and g("ibd_rs_estimate", 0) >= 80 and g("rs_3m", -1) > 0
    correction = (price is not None and ma200 is not None and ma50 is not None and price > ma200 and ma50 > ma200
                  and rank is not None and rank >= 85 and hd is not None and -.40 <= hd <= -.20)
    next_leader = (not structural and not correction and price is not None and ma50 is not None and price > ma50
                   and hd is not None and hd >= -.30 and rank is not None and rank >= 70 and g("rs_1w", -1) > 0 and g("rs_1m", -1) > 0)
    if structural and core:
        return "핵심 주도"
    if structural and candidate:
        return "주도 후보"
    if next_leader:
        return "강세 전환"
    return "기타"


def evaluate(population: set, data: dict) -> dict:
    """Rank and classify one population. data: (market, ticker) -> metrics with rs_* already attached."""
    out = {}
    for market in ("US", "KR"):
        keys = [k for k in population if k[0] == market and k in data]
        ranks = cume_rank({k: score(data[k]) for k in keys})
        ibd = cume_rank({k: data[k].get("ibd_score") for k in keys})
        for k in keys:
            m = {**data[k], "rs_rank": ranks[k], "ibd_rs_estimate": ibd[k]}
            m["class"] = classify(m)
            out[k] = m
    return out


def compare(v1: dict, v2: dict) -> dict:
    report = {}
    for market in ("US", "KR"):
        a = {k: x for k, x in v1.items() if k[0] == market}
        b = {k: x for k, x in v2.items() if k[0] == market}
        both = set(a) & set(b)
        moves = sorted(b[k]["rs_rank"] - a[k]["rs_rank"] for k in both if a[k]["rs_rank"] is not None and b[k]["rs_rank"] is not None)
        q = lambda p: moves[min(len(moves) - 1, int(p * len(moves)))] if moves else None
        classes = ["핵심 주도", "주도 후보", "강세 전환"]
        report[market] = {
            "v1_count": len(a), "v2_count": len(b), "kept": len(both),
            "added": len(set(b) - set(a)), "removed": len(set(a) - set(b)),
            "rank_change_p10_p50_p90": [q(.10), q(.50), q(.90)],
            "rank_abs_change_mean": (sum(abs(x) for x in moves) / len(moves)) if moves else None,
            "class_counts_v1": {c: sum(x["class"] == c for x in a.values()) for c in classes},
            "class_counts_v2": {c: sum(x["class"] == c for x in b.values()) for c in classes},
            "kept_class_changed": sum(a[k]["class"] != b[k]["class"] for k in both),
            "new_leaders_v2": sorted(k[1] for k in set(b) - set(a) if b[k]["class"] in classes[:2])[:40],
            "lost_leaders_kept": sorted(k[1] for k in both if a[k]["class"] in classes[:2] and b[k]["class"] not in classes[:2])[:40],
        }
    return report


def markdown(report: dict, decisions: dict, watch: list) -> str:
    lines = [f"# UNIVERSE-2 simulation", "", f"Thresholds {json.dumps(decisions['thresholds'])}, buffer {decisions['buffer']}, KR source: {decisions['kr_source']}", ""]
    lines += ["| | US | KR |", "|---|---|---|"]
    rows = [("current (v1) stocks priced", "v1_count"), ("UNIVERSE-2 stocks priced", "v2_count"), ("in both", "kept"),
            ("added", "added"), ("removed", "removed"), ("RS rank change p10/p50/p90 (kept)", "rank_change_p10_p50_p90"),
            ("mean |RS rank change| (kept)", "rank_abs_change_mean"), ("kept stocks whose class changes", "kept_class_changed")]
    for label, key in rows:
        val = lambda m: report[m][key] if not isinstance(report[m][key], float) else round(report[m][key], 2)
        lines.append(f"| {label} | {val('US')} | {val('KR')} |")
    for c in ("핵심 주도", "주도 후보", "강세 전환"):
        lines.append(f"| {c} v1 → v2 | {report['US']['class_counts_v1'][c]} → {report['US']['class_counts_v2'][c]} | {report['KR']['class_counts_v1'][c]} → {report['KR']['class_counts_v2'][c]} |")
    lines += ["", "## Reported names", ""]
    for w in watch:
        lines.append(f"- {w}")
    for m in ("US", "KR"):
        lines += ["", f"## {m}: new 핵심 주도/주도 후보 (first 40)", ", ".join(report[m]["new_leaders_v2"]) or "—",
                  "", f"## {m}: kept stocks that leave 핵심 주도/주도 후보 (first 40)", ", ".join(report[m]["lost_leaders_kept"]) or "—"]
    return "\n".join(lines) + "\n"


def yahoo_symbol(market: str, ticker: str, exchange: str | None) -> str:
    if market == "US":
        return ticker.replace(".", "-")
    return ticker + (".KQ" if (exchange or "").upper().startswith("KOSDAQ") else ".KS")


def main():  # pragma: no cover - network
    import requests
    import yfinance as yf

    decisions = json.loads(Path(os.environ.get("UNIVERSE_DECISIONS_OUTPUT", "universe_decisions.json")).read_text(encoding="utf-8"))
    functions = os.environ.get("FUNCTIONS_URL", "https://mhbcchegrbakearqptdr.supabase.co/functions/v1")
    current = requests.get(functions + "/leaderboard", params={"client": "peppercorn-public-read-v1"}, timeout=90).json()["rows"]
    v1 = {(x["market"], x["ticker"]) for x in current if x.get("asset_class") == "Equity"}
    exch = {(x["market"], x["ticker"]): x.get("exchange") for x in current}
    v2 = set()
    for d in decisions["decisions"]:
        exch.setdefault((d["market"], d["ticker"]), d.get("exchange"))
        if d["included"]:
            v2.add((d["market"], d["ticker"]))
    keys = sorted(v1 | v2 | {("US", "SPY"), ("KR", "226490")})
    exch[("KR", "226490")] = "KOSPI"
    symbols = {yahoo_symbol(m, t, exch.get((m, t))): (m, t) for m, t in keys}
    data = {}
    syms = list(symbols)
    for i in range(0, len(syms), 200):
        batch = syms[i:i + 200]
        frame = yf.download(batch, period="14mo", interval="1d", auto_adjust=False, progress=False, threads=True, group_by="ticker")
        for s in batch:
            try:
                f = frame[s] if len(batch) > 1 else frame
                f = f.dropna(subset=["Close"])
                data[symbols[s]] = metrics(f["Close"].tolist(), f["High"].tolist(), f["Low"].tolist())
            except Exception:
                continue
        print(f"priced {len(data)}/{len(syms)}", file=sys.stderr)
    bench = {m: data.get((m, t), {}) for m, t in BENCH.items()}
    for k, m in data.items():
        m.update(rs(m, bench[k[0]]))
    a, b = evaluate(v1, data), evaluate(v2, data)
    report = compare(a, b)
    by = {(d["market"], d["ticker"]): d for d in decisions["decisions"]}
    watch = []
    for k in WATCH:
        d = by.get(k)
        cls = b.get(k, {}).get("class")
        watch.append(f"{k[0]} {k[1]} {d['name'] if d else ''}: "
                     + (f"{'included' if d['included'] else 'excluded'} ({d['reason']}), cap {d['market_cap']}, value {d['traded_value']} [{d['traded_value_source']}]" if d else "not in listing")
                     + (f", v2 RS rank {b[k]['rs_rank']}, class {cls}" if k in b else ""))
    md = markdown(report, decisions, watch)
    Path(os.environ.get("UNIVERSE_REPORT", "universe_report.md")).write_text(md, encoding="utf-8")
    Path("universe_report.json").write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")
    print(md)


if __name__ == "__main__":
    main()
