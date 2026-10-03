"""COMPOSITE-1 stage A backtest (read-only; Actions only). Gates are fixed in composite.COMPOSITE_RULES.

Population: today's active equities from the public leaderboard (survivorship bias: stocks that were delisted or
dropped are absent, which flatters every bucket alike; the gates compare Composite with RS-only on the same rows).
Prices: Yahoo daily, 6 years. Rebalance every 21 sessions from the first date with 253 sessions of history to the last
date with a full 63-session forward window. Excess return = stock forward return - benchmark (SPY / 226490) forward return.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import composite as cp
from universe_report import yahoo_symbol

BENCH = {"US": "SPY", "KR": "226490"}


def main():  # pragma: no cover - network
    import pandas as pd
    import requests
    import yfinance as yf

    functions = os.environ.get("FUNCTIONS_URL", "https://mhbcchegrbakearqptdr.supabase.co/functions/v1")
    rows = [r for r in requests.get(functions + "/leaderboard", params={"client": "peppercorn-public-read-v1"}, timeout=90).json()["rows"]
            if r.get("asset_class") == "Equity"]
    industry = {(r["market"], r["ticker"]): r.get("industry") for r in rows}
    keys = [(r["market"], r["ticker"]) for r in rows] + [("US", "SPY"), ("KR", "226490")]
    exch = {(r["market"], r["ticker"]): r.get("exchange") for r in rows}
    exch[("KR", "226490")] = "KOSPI"
    sym = {yahoo_symbol(m, t, exch.get((m, t))): (m, t) for m, t in keys}
    frames = {}
    names = list(sym)
    for i in range(0, len(names), 200):
        batch = names[i:i + 200]
        f = yf.download(batch, period="6y", interval="1d", auto_adjust=True, progress=False, threads=True, group_by="ticker")
        for s in batch:
            try:
                g = (f[s] if len(batch) > 1 else f).dropna(subset=["Close"])
                if len(g):
                    frames[sym[s]] = g
            except Exception:
                continue
        print(f"priced {len(frames)}/{len(names)}", file=sys.stderr)

    report = {"rules": cp.COMPOSITE_RULES, "population": "current active equities (survivorship-biased)", "markets": {}}
    pooled = []
    for market, bench_t in BENCH.items():
        bench = frames.get((market, bench_t))
        if bench is None:
            report["markets"][market] = {"error": "benchmark not priced"}
            continue
        cal = bench.index
        members = [k for k in frames if k[0] == market and k[1] != bench_t]
        close = {k: frames[k]["Close"].reindex(cal).tolist() for k in members}
        high = {k: frames[k]["High"].reindex(cal).tolist() for k in members}
        vol = {k: frames[k]["Volume"].reindex(cal).tolist() for k in members}
        nan = lambda x: None if x is None or x != x else float(x)
        for d in (close, high, vol):
            for k in d:
                d[k] = [nan(x) for x in d[k]]
        bc = [float(x) for x in bench["Close"].tolist()]
        dates = []
        for t in range(252, len(cal) - cp.FORWARD, 21):
            raw = {}
            for k in members:
                c = close[k]
                if c[t] is None:
                    continue
                raw[k] = cp.price_components(c, high[k], vol[k], t)
            rated = cp.rate(raw, industry)
            bf = bc[t + cp.FORWARD] / bc[t] - 1
            out = []
            for k, (comp, rs) in rated.items():
                c0, c1 = close[k][t], close[k][t + cp.FORWARD]
                ex = (c1 / c0 - 1 - bf) if c0 and c1 else None
                out.append((comp, rs, ex))
            dates.append({"date": str(cal[t].date()), "rows": out})
        res = cp.evaluate(dates)
        report["markets"][market] = res
        pooled.extend(dates)
        print(market, json.dumps({k: v for k, v in res.items() if k != "quintile_means"}, default=str), file=sys.stderr)
    report["pooled"] = cp.evaluate(sorted(pooled, key=lambda d: d["date"]))

    lines = [f"# {cp.VERSION} stage A backtest", "", "Pre-registered gates:", ""]
    lines += [f"- {k}: {v}" for k, v in cp.COMPOSITE_RULES["gates"].items()]
    for name, res in [*report["markets"].items(), ("pooled", report["pooled"])]:
        if "error" in res:
            lines += ["", f"## {name}: {res['error']}"]
            continue
        f = lambda x: "—" if x is None else (f"{x:+.2%}" if isinstance(x, float) and abs(x) < 5 else str(x))
        lines += ["", f"## {name} — {'PASS' if res['passed'] else 'FAIL'}", "",
                  f"dates {res['dates']}, avg top-decile size {f(res['avg_top_decile_size'])}",
                  f"top decile mean excess: Composite {f(res['composite_top_mean'])} vs RS-only {f(res['rs_top_mean'])}; win rate {f(res['win_rate'])}",
                  f"quintile means {[f(q) for q in res['quintile_means']]}, Spearman {res['quintile_spearman']}",
                  f"halves: {f(res['first_half_top_mean'])} / {f(res['second_half_top_mean'])}",
                  "gates: " + ", ".join(f"{k} {'✓' if v else '✗'}" for k, v in res["gates"].items())]
    md = "\n".join(lines) + "\n"
    Path("composite_report.md").write_text(md, encoding="utf-8")
    Path("composite_report.json").write_text(json.dumps(report, ensure_ascii=False, indent=1, default=str), encoding="utf-8")
    print(md)


if __name__ == "__main__":
    main()
