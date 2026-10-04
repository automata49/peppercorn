"""LEADERSHIP-V2 backtest (read-only): v1 vs the pre-registered v2 variants in analysis/leadership_v2.py.

  SEC_USER_AGENT=... DART_API_KEY=... python analysis/leadership_backtest.py

At each month-end session it recomputes, per market and from daily prices only, the inputs of
recalculate_market_leadership() (MA50/MA200, 52W high distance, RS 1W-12M vs SPY / 226490, RS rank, IBD-style
estimate), the 20-session traded value, the RS line gap and industry-group ranks, classifies every stock under v1 and
each v2 variant, and records the leaders' forward 63/21-session excess return and 63-session max drawdown.
Fundamentals are point-in-time by year (see RULES). Writes leadership_backtest.md / .json; never touches Supabase.
"""
from __future__ import annotations

import json
import math
import os
import sys
from pathlib import Path

import leadership_v2 as v2

PERIODS = {"1w": 5, "1m": 21, "3m": 63, "6m": 126, "12m": 252}
WEIGHTS = {"1m": .30, "3m": .30, "6m": .20, "12m": .20}
H, H2 = 63, 21


def cume_rank(values: dict) -> dict:
    known = sorted(v for v in values.values() if v is not None)
    n, out = len(known), {}
    import bisect
    for k, v in values.items():
        out[k] = None if v is None or not n else int(math.floor(1 + 98 * bisect.bisect_right(known, v) / n + .5))
    return out


def share_rank(values: dict) -> dict:
    """0 = best (highest value) .. 1 = worst; None for missing."""
    known = sorted((v for v in values.values() if v is not None), reverse=True)
    n = len(known)
    return {k: None if v is None or not n else known.index(v) / n for k, v in values.items()}


def fundamentals_year(date) -> int:
    """Annual results of year Y count from April of Y+1."""
    return date.year - 1 if date.month >= 4 else date.year - 2


def snapshot(frames: dict, i: int, groups: dict, funda: dict, date) -> dict:
    """Per-stock inputs at session i. frames: close/high/low/volume DataFrames (sessions x tickers) and bench Series."""
    import numpy as np
    close, high, low, vol, bench = frames["close"], frames["high"], frames["low"], frames["volume"], frames["bench"]
    c = close.iloc[: i + 1]
    price = c.iloc[-1]
    valid = price.notna()
    out = {}
    tv = (close * vol).iloc[max(0, i - 19): i + 1]
    tv_mean = tv.mean().where(tv.count() >= 20)
    big_cut = tv_mean.dropna().quantile(.9) if tv_mean.notna().any() else None
    rsline = (close.iloc[max(0, i - 251): i + 1].div(bench.iloc[max(0, i - 251): i + 1], axis=0))
    rs_gap = rsline.iloc[-1] / rsline.max() - 1
    bret = {k: (bench.iloc[i] / bench.iloc[i - n] - 1) if i - n >= 0 else None for k, n in PERIODS.items()}
    yr = fundamentals_year(date)
    for t in close.columns[valid.values]:
        s = c[t]
        n_valid = int(s.notna().sum())
        p = float(price[t])
        ma = lambda n: float(s.iloc[-n:].mean()) if s.iloc[-n:].notna().sum() == n else None
        hi = high[t].iloc[max(0, i - 251): i + 1].max()
        lo = low[t].iloc[max(0, i - 251): i + 1].min()
        m = {"price": p, "ma50": ma(50), "ma200": ma(200), "high_52w_distance": (p / hi - 1) if hi and not np.isnan(hi) else None,
             "low_52w": None if np.isnan(lo) else float(lo)}
        for k, n in PERIODS.items():
            prev = s.iloc[-1 - n] if len(s) > n else None
            r = (p / prev - 1) if prev is not None and not np.isnan(prev) and prev else None
            m[f"rs_{k}"] = r - bret[k] if r is not None and bret[k] is not None else None
        if n_valid >= 253 and not np.isnan(s.iloc[-253]) and not np.isnan(s.iloc[-190]) and not np.isnan(s.iloc[-127]) and not np.isnan(s.iloc[-64]):
            m["ibd_score"] = .4 * (p / s.iloc[-64] - 1) + .2 * (s.iloc[-64] / s.iloc[-127] - 1) + .2 * (s.iloc[-127] / s.iloc[-190] - 1) + .2 * (s.iloc[-190] / s.iloc[-253] - 1)
        w = {k: wt for k, wt in WEIGHTS.items() if m.get(f"rs_{k}") is not None}
        m["score"] = sum(m[f"rs_{k}"] * wt for k, wt in w.items()) / sum(w.values()) if w else None
        tvm = tv_mean.get(t)
        m["large_cap"] = bool(big_cut is not None and tvm is not None and not np.isnan(tvm) and tvm >= big_cut)
        g = rs_gap.get(t)
        m["rs_line_gap"] = None if g is None or np.isnan(g) else float(g)
        m["group"] = groups.get(t)
        f = funda.get((t, yr)) or {}
        m["no_revenue"], m["loss"] = f.get("no_revenue"), f.get("loss")
        out[t] = m
    ranks = cume_rank({t: m["score"] for t, m in out.items()})
    ibd = cume_rank({t: m.get("ibd_score") for t, m in out.items()})
    for t, m in out.items():
        m["rs_rank"], m["ibd_rs_estimate"] = ranks[t], ibd[t]
    # Group ranks by median RS rank (groups with >= GROUP_MIN_MEMBERS ranked members), and RS position inside a group.
    members: dict[str, list[str]] = {}
    for t, m in out.items():
        if m["group"] and m["rs_rank"] is not None:
            members.setdefault(m["group"], []).append(t)
    ranked = sorted(((g, sorted(out[t]["rs_rank"] for t in ts)[len(ts) // 2] if len(ts) % 2 else
                      (sorted(out[t]["rs_rank"] for t in ts)[len(ts) // 2 - 1] + sorted(out[t]["rs_rank"] for t in ts)[len(ts) // 2]) / 2)
                     for g, ts in members.items() if len(ts) >= v2.GROUP_MIN_MEMBERS), key=lambda x: -x[1])
    pos = {g: (k + 1) / len(ranked) for k, (g, _) in enumerate(ranked)}
    for g, ts in members.items():
        inside = share_rank({t: out[t]["score"] for t in ts}) if len(ts) >= v2.GROUP_MIN_MEMBERS else {}
        for t in ts:
            out[t]["group_top_share"] = pos.get(g)
            out[t]["group_rs_share"] = inside.get(t)
    return out


def forward(frames: dict, i: int, t: str) -> dict | None:
    import numpy as np
    close, bench = frames["close"], frames["bench"]
    if i + H >= len(close):
        return None
    p0, p1 = close[t].iloc[i], close[t].iloc[i + H]
    if np.isnan(p0) or np.isnan(p1):
        return None
    path = close[t].iloc[i: i + H + 1]
    b0 = bench.iloc[i]
    p21 = close[t].iloc[i + H2]
    return {"excess": (p1 / p0 - 1) - (bench.iloc[i + H] / b0 - 1),
            "excess21": None if np.isnan(p21) else (p21 / p0 - 1) - (bench.iloc[i + H2] / b0 - 1),
            "dd": float(path.min() / p0 - 1)}


def month_ends(index) -> list[int]:
    out = []
    for k in range(253, len(index) - H):
        if index[k].month != index[k + 1].month:
            out.append(k)
    return out


def run_market(frames: dict, groups: dict, funda: dict) -> dict:
    """Returns {"dates": [...], "picks": {variant_or_v1: [{"date", "leaders": [...]}, ...]}}."""
    idx = frames["close"].index
    names = ["v1"] + [v["name"] for v in v2.VARIANTS]
    picks = {n: [] for n in names}
    dates = []
    for i in month_ends(idx):
        snap = snapshot(frames, i, groups, funda, idx[i])
        fwd = {}
        dates.append(str(idx[i].date()))
        for n in names:
            leaders = []
            for t, m in snap.items():
                core, cand = v2.v1_flags(m) if n == "v1" else v2.v2_flags(m, next(v for v in v2.VARIANTS if v["name"] == n))
                if core or cand:
                    if t not in fwd:
                        fwd[t] = forward(frames, i, t)
                    if fwd[t]:
                        leaders.append({"ticker": t, **fwd[t]})
            picks[n].append({"date": dates[-1], "leaders": leaders})
    return {"dates": dates, "picks": picks}


def evaluate(results: dict) -> dict:
    """results[market] = run_market output. Splits dates 60/40 and applies the registered gates."""
    stats = {"selection": {}, "holdout": {}}
    for market, r in results.items():
        cut = int(len(r["dates"]) * .6)
        for n, ps in r["picks"].items():
            stats["selection"].setdefault(n, {})[market] = v2.summarize(ps[:cut])
            stats["holdout"].setdefault(n, {})[market] = v2.summarize(ps[cut:])
    return {"stats": stats, "decision": v2.select(stats), "rules_sha": v2.RULES_SHA,
            "periods": {m: {"selection": [r["dates"][0], r["dates"][int(len(r["dates"]) * .6) - 1]],
                            "holdout": [r["dates"][int(len(r["dates"]) * .6)], r["dates"][-1]]} for m, r in results.items() if r["dates"]}}


def markdown(ev: dict, latest: dict) -> str:
    pct = lambda x: "—" if x is None else f"{x * 100:+.1f}%"
    L = ["# 주도 종목 v2 백테스트 (LEADERSHIP-V2)", "", f"사전등록 규칙 해시 `{ev['rules_sha']}` · 기간 " +
         ", ".join(f"{m}: 선택 {p['selection'][0]}~{p['selection'][1]}, 검증 {p['holdout'][0]}~{p['holdout'][1]}" for m, p in ev["periods"].items()), ""]
    for period, label in (("selection", "선택 구간"), ("holdout", "검증 구간")):
        L += [f"## {label}", "", "| 규칙 | 시장 | 평균 종목 수 | 63일 초과수익 | 21일 초과수익 | 63일 승률 | 63일 최대낙폭 중앙값 | G1 | G2 | G3 | G4 |", "|---|---|---:|---:|---:|---:|---:|:-:|:-:|:-:|:-:|"]
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
    d = ev["decision"]
    L += ["## 판정", "", f"- 선택 구간 통과: {', '.join(d['passing_selection']) or '없음'}", f"- 선택된 규칙: {d['chosen'] or '없음'}",
          f"- 검증 구간: {json.dumps(d['holdout_gates'], ensure_ascii=False) if d['holdout_gates'] else '—'}",
          f"- 채택 여부: {'채택 가능 (검토 후 반영)' if d['adopted'] else '채택 안 함'}", ""]
    L += ["## 최근 시점 비교 (참고)", "", "| 시장 | 날짜 | v1 주도 | 선택 규칙 주도 | 공통 |", "|---|---|---:|---:|---:|"]
    for m, x in latest.items():
        L.append(f"| {m} | {x['date']} | {x['v1']} | {x['chosen']} | {x['both']} |")
    L += ["", "한계: 현재 유니버스 종목만 사용(상장폐지 종목 제외로 생존 편향), Yahoo 일봉 종가, 업종 소속은 현재 기준 고정, 공시 실적은 연 단위."]
    return "\n".join(L) + "\n"


# ---- network (not unit tested) -------------------------------------------------------------------------------
def load_prices(rows: list[dict], market: str):  # pragma: no cover - network
    import pandas as pd
    import yfinance as yf
    bench = {"US": "SPY", "KR": "226490.KS"}[market]
    sym = {}
    for r in rows:
        s = r["ticker"].replace(".", "-") if market == "US" else r["ticker"] + (".KQ" if (r.get("exchange") or "").upper().startswith("KOSDAQ") else ".KS")
        sym[s] = r["ticker"]
    frames = {k: {} for k in ("Close", "High", "Low", "Volume")}
    keys = list(sym)
    for i in range(0, len(keys), 200):
        batch = keys[i:i + 200]
        data = yf.download(batch, period="5y", interval="1d", auto_adjust=False, progress=False, threads=True, group_by="ticker")
        for s in batch:
            try:
                f = data[s] if len(batch) > 1 else data
                for k in frames:
                    frames[k][sym[s]] = f[k]
            except Exception:
                continue
        print(f"{market}: priced {len(frames['Close'])}/{len(keys)}", file=sys.stderr)
    b = yf.download(bench, period="5y", interval="1d", auto_adjust=False, progress=False)["Close"]
    b = b.iloc[:, 0] if hasattr(b, "columns") else b
    b = b.dropna()
    out = {k.lower(): pd.DataFrame(v).reindex(b.index) for k, v in frames.items()}
    out["bench"] = b
    return out


def load_fundamentals(rows: list[dict], ua: str | None, key: str | None, years: range) -> dict:  # pragma: no cover - network
    import leadership_report as lr
    out = {}
    us = [r["ticker"] for r in rows if r["market"] == "US"]
    kr = [r["ticker"] for r in rows if r["market"] == "KR"]
    if ua:
        sys.path.insert(0, str(Path(__file__).parent / "fundamentals"))
        import targets
        ciks = targets.sec_ciks(ua)
        for y in years:
            rev = {}
            for tag in lr.REVENUE_TAGS:
                for cik, val in lr.sec_frames(ua, tag, f"CY{y}").items():
                    rev[cik] = max(rev.get(cik, val), val)
            ni = lr.sec_frames(ua, "NetIncomeLoss", f"CY{y}")
            for t in us:
                cik = ciks.get(t.upper().replace(".", "-")) or ciks.get(t.upper())
                if not cik:
                    continue
                r, n = rev.get(cik), ni.get(cik)
                out[(t, y)] = {"loss": None if n is None else n < 0,
                               "no_revenue": (r < lr.TINY_REVENUE["US"]) if r is not None else (True if n is not None and n < 0 else None)}
    if key:
        import requests
        sys.path.insert(0, str(Path(__file__).parent / "fundamentals"))
        import targets
        codes = targets.dart_codes(key)
        by_code = {codes[t]: t for t in kr if t in codes}
        items = list(by_code)
        for y in years:
            for i in range(0, len(items), 100):
                body = requests.get("https://opendart.fss.or.kr/api/fnlttMultiAcnt.json", params={"crtfc_key": key, "corp_code": ",".join(items[i:i + 100]), "bsns_year": str(y), "reprt_code": "11011"}, timeout=120).json()
                rows_ = body.get("list") or []
                for corp in {x["corp_code"] for x in rows_}:
                    mine = [x for x in rows_ if x["corp_code"] == corp]
                    fs = "CFS" if any(x.get("fs_div") == "CFS" for x in mine) else "OFS"
                    mine = [x for x in mine if x.get("fs_div") == fs]
                    num = lambda x: lr.num(str(x.get("thstrm_amount") or "").replace(",", "")) if x else None
                    rv = num(next((x for x in mine if x.get("account_nm") in ("매출액", "영업수익", "수익(매출액)")), None))
                    nv = num(next((x for x in mine if (x.get("account_nm") or "").startswith("당기순이익")), None))
                    out[(by_code[corp], y)] = {"loss": None if nv is None else nv < 0, "no_revenue": None if rv is None else rv < lr.TINY_REVENUE["KR"]}
    return out


def main():  # pragma: no cover - network
    import requests
    import leadership_report as lr
    rows = requests.get(lr.LEADERBOARD_URL, params={"client": "peppercorn-public-read-v1"}, timeout=120).json()["rows"]
    eq = [r for r in rows if r.get("asset_class") == "Equity" and r.get("market") in ("US", "KR")]
    funda = load_fundamentals(eq, os.environ.get("SEC_USER_AGENT"), os.environ.get("DART_API_KEY"), range(2020, 2026))
    print(f"fundamentals: {len(funda)} company-years", file=sys.stderr)
    results, latest = {}, {}
    for market in ("US", "KR"):
        mrows = [r for r in eq if r["market"] == market]
        groups = {r["ticker"]: (r.get("sector") if market == "KR" else r.get("industry")) for r in mrows}
        frames = load_prices(mrows, market)
        results[market] = run_market(frames, groups, funda)
        print(f"{market}: {len(results[market]['dates'])} dates", file=sys.stderr)
    ev = evaluate(results)
    chosen = ev["decision"]["chosen"]
    for m, r in results.items():
        a = {x["ticker"] for x in r["picks"]["v1"][-1]["leaders"]}
        b = {x["ticker"] for x in r["picks"][chosen][-1]["leaders"]} if chosen else set()
        latest[m] = {"date": r["dates"][-1], "v1": len(a), "chosen": len(b), "both": len(a & b)}
    md = markdown(ev, latest)
    Path("leadership_backtest.md").write_text(md, encoding="utf-8")
    Path("leadership_backtest.json").write_text(json.dumps({"evaluation": ev, "latest": latest}, ensure_ascii=False, indent=1, default=str), encoding="utf-8")
    print(md)


if __name__ == "__main__":  # pragma: no cover
    sys.path.insert(0, str(Path(__file__).parent))
    main()
