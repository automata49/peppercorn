"""COMPOSITE-1 (by user decision 2026-10-03, option B): an IBD Composite-style reference rating, pre-registered here.

Option B: a separate reference indicator. It never feeds the leadership class, the Trend Template, stage/verdict, or the
Position labels, and it is not shown in the app until its pre-registered backtest gates pass (COMPOSITE_RULES below).
CONTRACT records this as the single, explicit exception to "Swing and Position are never combined into one score".

Components (each a 1-99 percentile within the market's population on the same date):
  rs      IBD-style RS estimate score (.40/.20/.20/.20 quarterly, >=253 sessions)    weight .30
  group   industry median of the RS score (>=3 members), mapped to members         weight .15
  high    distance from the 52-week high (closer = higher)                         weight .15
  ad      accumulation/distribution: up-day volume / down-day volume, 50 sessions  weight .10
  eps     filed EPS growth (quarter YoY and 3y CAGR, mean)                         weight .20   (stage B)
  smr     filed sales growth q, operating margin, ROE (mean of percentiles)        weight .10   (stage B)
Composite = weighted mean of the available components, re-weighted over those present; needs rs and at least three
components; then ranked 1-99 within the market. Missing inputs stay missing (never zero).

Stage A tests the price-only subset (rs, group, high, ad) because point-in-time filed facts exist only for the US
Position backtest path; stage B adds eps/smr later through that path. KR stays price-only until DART point-in-time data.
"""
from __future__ import annotations

import math
import statistics

VERSION = "COMPOSITE-1"
WEIGHTS = {"rs": .30, "group": .15, "high": .15, "ad": .10, "eps": .20, "smr": .10}
STAGE_A = ("rs", "group", "high", "ad")
MIN_COMPONENTS = 3
FORWARD = 63  # sessions (~3 months)

# Pre-registered gates (fixed before any run). Compared on the same dates, population and forward window.
COMPOSITE_RULES = {
    "version": VERSION,
    "active": False,
    "stage": "A",
    "gates": {
        "A1": "Composite top decile mean forward 63-session excess return > RS-rank-only top decile mean, pooled over dates",
        "A2": "Composite top decile beats RS-only top decile on >= 55% of rebalance dates",
        "A3": "Composite quintile mean excess returns are monotonic increasing (Spearman rho >= 0.9 over the 5 quintiles)",
        "A4": "Composite top decile has positive mean excess return in both halves of the period (stability)",
        "A5": ">= 24 rebalance dates and >= 30 stocks in each top decile on average",
    },
}


def cume_rank(values: dict) -> dict:
    """round(1+98*cume_dist()) over non-null values, ties share the highest cume_dist (as Postgres)."""
    known = sorted(v for v in values.values() if v is not None)
    n = len(known)
    out = {}
    for key, v in values.items():
        if v is None or not n:
            out[key] = None
            continue
        lo, hi = 0, n
        while lo < hi:
            mid = (lo + hi) // 2
            if known[mid] <= v:
                lo = mid + 1
            else:
                hi = mid
        out[key] = int(math.floor(1 + 98 * lo / n + 0.5))
    return out


def price_components(closes: list, highs: list, volumes: list, t: int) -> dict:
    """Raw price-only inputs at index t (inclusive) using only data up to t."""
    c = closes[: t + 1]
    if len(c) < 253 or any(x is None or x <= 0 for x in (c[-1], c[-64], c[-127], c[-190], c[-253])):
        rs = None
    else:
        rs = .40 * (c[-1] / c[-64] - 1) + .20 * (c[-64] / c[-127] - 1) + .20 * (c[-127] / c[-190] - 1) + .20 * (c[-190] / c[-253] - 1)
    h = [x for x in highs[max(0, t - 251): t + 1] if x is not None]
    high = c[-1] / max(h) - 1 if h and c and c[-1] else None
    up = down = 0.0
    if len(c) > 50:
        for i in range(len(c) - 50, len(c)):
            v = volumes[i] if i < len(volumes) else None
            if v is None or c[i] is None or c[i - 1] is None:
                continue
            if c[i] > c[i - 1]:
                up += v
            elif c[i] < c[i - 1]:
                down += v
    ad = (up / down if down > 0 else None) if len(c) > 50 else None
    return {"rs": rs, "high": high, "ad": ad}


def group_scores(raw_rs: dict, industry: dict, min_members: int = 3) -> dict:
    """Industry median RS score mapped back to each member (None for small or unclassified groups)."""
    groups: dict = {}
    for k, v in raw_rs.items():
        if v is not None and industry.get(k):
            groups.setdefault(industry[k], []).append(v)
    med = {g: statistics.median(vs) for g, vs in groups.items() if len(vs) >= min_members}
    return {k: med.get(industry.get(k)) for k in raw_rs}


def composite(percentiles: dict, weights: dict = WEIGHTS) -> float | None:
    """percentiles: component -> 1..99 or None. Needs rs and MIN_COMPONENTS components."""
    have = {c: p for c, p in percentiles.items() if p is not None and c in weights}
    if "rs" not in have or len(have) < MIN_COMPONENTS:
        return None
    return sum(p * weights[c] for c, p in have.items()) / sum(weights[c] for c in have)


def rate(raw: dict, industry: dict, components=STAGE_A) -> dict:
    """raw: key -> {'rs','high','ad', optional 'eps','smr'} for one market and date -> key -> (composite 1-99, rs pct)."""
    raw_rs = {k: v.get("rs") for k, v in raw.items()}
    grp = group_scores(raw_rs, industry)
    pct = {
        "rs": cume_rank(raw_rs),
        "group": cume_rank(grp),
        "high": cume_rank({k: v.get("high") for k, v in raw.items()}),
        "ad": cume_rank({k: v.get("ad") for k, v in raw.items()}),
    }
    for extra in ("eps", "smr"):
        if extra in components:
            pct[extra] = cume_rank({k: v.get(extra) for k, v in raw.items()})
    comp = {k: composite({c: pct[c][k] for c in components}) for k in raw}
    ranked = cume_rank(comp)
    return {k: (ranked[k], pct["rs"][k]) for k in raw}


def spearman(xs: list, ys: list) -> float | None:
    if len(xs) < 3:
        return None
    rx = {i: r for r, i in enumerate(sorted(range(len(xs)), key=lambda i: xs[i]))}
    ry = {i: r for r, i in enumerate(sorted(range(len(ys)), key=lambda i: ys[i]))}
    n = len(xs)
    d2 = sum((rx[i] - ry[i]) ** 2 for i in range(n))
    return 1 - 6 * d2 / (n * (n * n - 1))


def evaluate(dates: list) -> dict:
    """dates: list of {'date', 'rows': [(composite, rs_pct, excess_return)]}. Applies the pre-registered gates."""
    comp_top, rs_top, wins, quint = [], [], 0, [[] for _ in range(5)]
    per_date = []
    sizes = []
    for d in dates:
        rows = [r for r in d["rows"] if r[2] is not None]
        ct = [r[2] for r in rows if r[0] is not None and r[0] >= 90]
        rt = [r[2] for r in rows if r[1] is not None and r[1] >= 90]
        if not ct or not rt:
            continue
        sizes.append(len(ct))
        cm, rm = sum(ct) / len(ct), sum(rt) / len(rt)
        comp_top.extend(ct)
        rs_top.extend(rt)
        wins += cm > rm
        per_date.append((d["date"], cm, rm))
        for r in rows:
            if r[0] is not None:
                quint[min(4, (r[0] - 1) * 5 // 99)].append(r[2])
    mean = lambda xs: sum(xs) / len(xs) if xs else None
    n = len(per_date)
    qmeans = [mean(q) for q in quint]
    half = n // 2
    first = [x[1] for x in per_date[:half]]
    second = [x[1] for x in per_date[half:]]
    res = {
        "dates": n,
        "avg_top_decile_size": mean(sizes),
        "composite_top_mean": mean(comp_top),
        "rs_top_mean": mean(rs_top),
        "win_rate": wins / n if n else None,
        "quintile_means": qmeans,
        "quintile_spearman": spearman(list(range(5)), qmeans) if all(q is not None for q in qmeans) else None,
        "first_half_top_mean": mean(first),
        "second_half_top_mean": mean(second),
    }
    res["gates"] = {
        "A1": res["composite_top_mean"] is not None and res["rs_top_mean"] is not None and res["composite_top_mean"] > res["rs_top_mean"],
        "A2": res["win_rate"] is not None and res["win_rate"] >= .55,
        "A3": res["quintile_spearman"] is not None and res["quintile_spearman"] >= .9,
        "A4": (res["first_half_top_mean"] or 0) > 0 and (res["second_half_top_mean"] or 0) > 0,
        "A5": n >= 24 and (res["avg_top_decile_size"] or 0) >= 30,
    }
    res["passed"] = all(res["gates"].values())
    return res
