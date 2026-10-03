"""LEADERSHIP-V2 (step 3 of the leadership review): pre-registered candidate rules and acceptance gates.

Registered 2026-10-03 by user decision, BEFORE any backtest run. Nothing here is active: the live classification stays
recalculate_market_leadership() (v1) until a reviewed change adopts a variant that passed these gates.

User decisions this encodes:
  1. Fundamentals: companies without revenue never qualify; excluding loss-making companies is a variant decided
     by the backtest.
  2. Industry group: a leader's group must be in the top 20 % / 30 % / 40 % of groups (variants compared).
  3. Large caps (proxy: 20-session average traded value in the top 10 % of its market) may qualify as 핵심 주도 with
     RS rank >= 85 instead of 95, but only if they are still stronger than others: RS score in the top 20 % of their
     own industry group AND the RS line (close / benchmark) within 5 % of its 252-session high.
Everything else is v1: 핵심 주도 = trend structure (price > MA50 > MA200, 52W high distance >= -25 %, RS rank >= 70)
and RS rank >= 95, high distance >= -15 %, RS 3M and 6M > 0; 주도 후보 = trend structure and IBD-style estimate >= 80,
high distance >= -25 %, RS 3M > 0.
"""
from __future__ import annotations

import hashlib
import json

GROUP_MIN_MEMBERS = 5

RULES = {
    "version": "leadership-v2-registration-1",
    "registered": "2026-10-03",
    "active": False,
    "fundamentals": {"exclude_no_revenue": True, "exclude_loss": "variant (False/True)",
                     "point_in_time": "annual results of year Y used from April of Y+1 (SEC frames CY{Y}, OpenDART business report Y)"},
    "group": {"min_members": GROUP_MIN_MEMBERS, "top_share": "variant (None/0.4/0.3/0.2)",
              "groups": "US industry, KR WICS industry group (sector field); ranked by median RS rank; groups under the minimum fail the gate"},
    "large_cap": {"proxy": "traded_value_20d top 10% per market and date", "core_rs_rank_min": 85,
                  "within_group_rs_top_share": .2, "rs_line_within_of_high": .05},
    "outcome": {"primary_horizon": 63, "secondary_horizon": 21, "measure": "forward close return minus benchmark (SPY / 226490)"},
    "dates": "month-end sessions with 253 sessions of history and 63 forward sessions; first 60% selection, last 40% holdout",
    "gates": {
        "G1": "mean per-date excess return at 63 sessions >= v1 (selection and holdout, each market)",
        "G2": "hit rate (share of leader picks beating the benchmark at 63 sessions) >= v1 (selection and holdout)",
        "G3": "median 63-session max drawdown no worse than v1 by more than 2 percentage points",
        "G4": "average leaders per date >= 10 (US) / >= 3 (KR)",
        "selection": "among variants passing G1-G4 in the selection period in both markets: the strictest group share; "
                     "exclude_loss only if it passes and its selection G1 is at least that of the same group share without it",
        "adoption": "the selected variant must pass G1-G3 in the holdout in both markets; otherwise v2 is not adopted",
    },
    "limits": "current universe members only (survivorship bias); Yahoo daily closes; static group membership",
    # Run 37121393290 (commit 0a9c35b, registration hash 44f969ace94d), recorded unchanged.
    "results": {"run": 37121393290, "registration_sha": "44f969ace94d", "passing_selection": [], "chosen": None, "adopted": False,
                "note": "no variant passed G1-G2 in the KR selection period; group gates lowered selection-period excess "
                        "return in both markets; loss exclusion improved US hit rate and drawdown but not KR excess return"},
}
RULES_SHA = hashlib.sha256(json.dumps({k: v for k, v in RULES.items() if k != "results"}, sort_keys=True, ensure_ascii=False).encode()).hexdigest()[:12]

GROUP_SHARES = (None, .4, .3, .2)
VARIANTS = [{"name": f"v2-g{'all' if g is None else int(g * 100)}{'-noloss' if loss else ''}", "group_top": g, "exclude_loss": loss}
            for loss in (False, True) for g in GROUP_SHARES]
MIN_LEADERS = {"US": 10, "KR": 3}
DD_TOLERANCE = .02


def v1_flags(m: dict) -> tuple[bool, bool]:
    """(핵심 주도, 주도 후보) exactly as recalculate_market_leadership(); a missing input never passes."""
    p, a, b, hd, rk = (m.get(k) for k in ("price", "ma50", "ma200", "high_52w_distance", "rs_rank"))
    up = None not in (p, a, b) and p > a > b
    structural = up and hd is not None and hd >= -.25 and rk is not None and rk >= 70
    core = structural and hd >= -.15 and rk >= 95 and (m.get("rs_3m") or -1) > 0 and (m.get("rs_6m") or -1) > 0
    cand = structural and (m.get("ibd_rs_estimate") or 0) >= 80 and (m.get("rs_3m") or -1) > 0
    return bool(core), bool(cand and not core)


def v2_flags(m: dict, variant: dict) -> tuple[bool, bool]:
    """(핵심 주도, 주도 후보) under a v2 variant. m carries the v1 inputs plus:
    no_revenue / loss (True, False or None = unknown), group_top_share (0..1 rank share of its group, None = unranked),
    large_cap (bool), group_rs_share (0..1 position of the RS score inside its group, 0 = best), rs_line_gap (<= 0)."""
    if m.get("no_revenue") is True:
        return False, False
    if variant.get("exclude_loss") and m.get("loss") is True:
        return False, False
    g = variant.get("group_top")
    if g is not None:
        share = m.get("group_top_share")
        if share is None or share > g:
            return False, False
    core, cand = v1_flags(m)
    if not core and m.get("large_cap"):
        relaxed = dict(m, rs_rank=100 if (m.get("rs_rank") or 0) >= RULES["large_cap"]["core_rs_rank_min"] else m.get("rs_rank"))
        gs, gap = m.get("group_rs_share"), m.get("rs_line_gap")
        stronger = gs is not None and gs <= RULES["large_cap"]["within_group_rs_top_share"] and gap is not None and gap >= -RULES["large_cap"]["rs_line_within_of_high"]
        if stronger and v1_flags(relaxed)[0]:
            return True, False
    return core, cand and not core


def summarize(picks: list[dict]) -> dict:
    """picks: per date {"leaders": [{"excess": x, "dd": d}, ...]}. Per-date means, then averaged across dates."""
    dated = [p["leaders"] for p in picks if p["leaders"]]
    flat = [x for p in picks for x in p["leaders"]]
    mean = lambda xs: sum(xs) / len(xs) if xs else None
    dds = sorted(x["dd"] for x in flat if x.get("dd") is not None)
    return {
        "dates": len(picks), "dates_with_leaders": len(dated),
        "avg_leaders": sum(len(p["leaders"]) for p in picks) / len(picks) if picks else 0,
        "excess63": mean([mean([x["excess"] for x in d]) for d in dated]),
        "hit63": mean([x["excess"] > 0 for x in flat]) if flat else None,
        "median_dd": dds[len(dds) // 2] if dds else None,
        "excess21": mean([mean([x["excess21"] for x in d if x.get("excess21") is not None]) for d in dated if any(x.get("excess21") is not None for x in d)]),
    }


def gates(v: dict, base: dict, market: str) -> dict:
    ok = lambda a, b: a is not None and b is not None and a >= b
    return {"G1": ok(v["excess63"], base["excess63"]), "G2": ok(v["hit63"], base["hit63"]),
            "G3": v["median_dd"] is not None and base["median_dd"] is not None and v["median_dd"] >= base["median_dd"] - DD_TOLERANCE,
            "G4": v["avg_leaders"] >= MIN_LEADERS[market]}


def select(stats: dict) -> dict:
    """stats[period][variant_or_'v1'][market] -> summary. Applies the registered selection and adoption rules."""
    sel = stats["selection"]
    passing = [v for v in VARIANTS if all(all(gates(sel[v["name"]][m], sel["v1"][m], m).values()) for m in ("US", "KR"))]
    strictness = lambda v: (1.0 if v["group_top"] is None else v["group_top"])
    chosen = None
    for share in sorted({strictness(v) for v in passing}):
        plain = next((v for v in passing if strictness(v) == share and not v["exclude_loss"]), None)
        noloss = next((v for v in passing if strictness(v) == share and v["exclude_loss"]), None)
        if noloss and (plain is None or all((sel[noloss["name"]][m]["excess63"] or -9) >= (sel[plain["name"]][m]["excess63"] or -9) for m in ("US", "KR"))):
            chosen = noloss
        else:
            chosen = plain
        if chosen:
            break
    out = {"passing_selection": [v["name"] for v in passing], "chosen": chosen["name"] if chosen else None, "adopted": False, "holdout_gates": None}
    if chosen:
        hold = stats["holdout"]
        hg = {m: gates(hold[chosen["name"]][m], hold["v1"][m], m) for m in ("US", "KR")}
        out["holdout_gates"] = hg
        out["adopted"] = all(g["G1"] and g["G2"] and g["G3"] for g in hg.values())
    return out
