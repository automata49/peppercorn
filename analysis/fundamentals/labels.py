"""Deterministic Position labels (Type, Quality, Growth, Value) from quarterly facts and a versioned rule file.

The four labels are independent and never combined into a score. Any missing input leaves the whole result
insufficient_data with no labels. Code computes every quantity; the rule file holds every threshold.
"""
from __future__ import annotations

import json
from datetime import date
from pathlib import Path

import metrics
from quarters import days, ttm

RULES_DIR = Path(__file__).resolve().parent / "rules"


def load_rules(version: str = "position-rules-v1.1") -> dict:
    rules = json.loads((RULES_DIR / f"{version.replace('-', '_')}.json").read_text(encoding="utf-8"))
    if rules["version"] != version:
        raise ValueError(f"rule file version mismatch: {rules['version']}")
    return rules


def _series(q: dict, field: str) -> dict:
    return {k: v[field] for k, v in q.items() if field in v}


def _sum(q: dict, field: str, ends: list[str]):
    values = [q[e].get(field) for e in ends]
    return None if any(v is None for v in values) else sum(values)


def _drawdown(values: list[float], relative: bool) -> float:
    """Largest fall from a running peak to a later value (relative for revenue, points for margin)."""
    peak, worst = values[0], 0.0
    for v in values[1:]:
        peak = max(peak, v)
        fall = (peak - v) / peak if relative else peak - v
        worst = max(worst, fall)
    return worst


def features(q: dict, rules: dict, default_tax: float, roic_method: dict, absent=()) -> tuple[dict, list[str]]:
    """Every quantity the rules read, and the list of what is missing."""
    missing: list[str] = []
    ends = sorted(q)[-rules["window"]["quarters"]:]
    gaps = [(a, b) for a, b in zip(ends, ends[1:]) if days(a, b) > 100]
    if gaps:
        ends = ends[ends.index(gaps[-1][1]):]
    rev_s, op_s = _series(q, "revenue"), _series(q, "operating_income")
    rev = {e: ttm(rev_s, e) for e in ends}
    op = {e: ttm(op_s, e) for e in ends}
    points = [e for e in ends if rev[e] is not None and rev[e] > 0 and op[e] is not None]
    f: dict = {"as_of": ends[-1] if ends else None, "window_start": ends[0] if ends else None,
               "quarters": len(ends), "ttm_points": len(points)}
    if len(points) < rules["window"]["min_ttm_points"] or not ends or points[-1] != ends[-1]:
        return f, [f"at least {rules['window']['min_ttm_points']} consecutive TTM points ending at the latest quarter"]
    latest = ends[-1]
    f["ttm_revenue"], f["ttm_operating_income"] = rev[latest], op[latest]
    recent = points[-(rules["window"]["drawdown_quarters"] - 3):]
    f["drawdown_since"] = recent[0]
    f["revenue_drawdown"] = _drawdown([rev[e] for e in recent], relative=True)
    f["operating_margin_drawdown"] = _drawdown([op[e] / rev[e] for e in recent], relative=False)
    idx = {e: i for i, e in enumerate(ends)}
    back = lambda e, n: ends[idx[e] - n] if idx[e] - n >= 0 else None  # noqa: E731
    base3 = back(latest, 12)
    f["revenue_cagr_3y"] = (rev[latest] / rev[base3]) ** (1 / 3) - 1 if base3 and rev.get(base3) and rev[base3] > 0 else None
    yoy = []
    for e in ends[-12:]:
        prior = back(e, 4)
        if prior and rev.get(prior) and rev.get(e) and rev[prior] > 0:
            yoy.append(rev[e] / rev[prior] - 1)
    f["yoy_points"] = len(yoy)
    f["latest_revenue_yoy"] = yoy[-1] if yoy else None
    f["positive_yoy_share"] = sum(1 for g in yoy if g > 0) / len(yoy) if len(yoy) == 12 else None
    if len(ends) >= 24:
        recent, prior = _sum(q, "revenue", ends[-12:]), _sum(q, "revenue", ends[-24:-12])
        f["through_cycle_growth"] = (recent / prior) ** (1 / 3) - 1 if recent and prior and prior > 0 else None
    else:
        f["through_cycle_growth"] = None

    def upto(e):
        return {k: v for k, v in q.items() if k <= e}

    m = metrics.compute(upto(latest), default_tax, roic_method, absent)
    f["roic"], f["net_debt"] = m.get("roic"), m.get("net_debt")
    # Fiscal Q4 weighted diluted shares are rarely filed (the 10-K reports the annual average), so the share
    # basis is the latest quarter within one quarter of the valuation quarter that has a filed count.
    share_end = next((e for e in ends[::-1][:2] if q[e].get("diluted_shares")), None)
    prior = back(share_end, 4) if share_end else None
    f["shares_quarter"] = share_end
    f["diluted_shares"] = q[share_end]["diluted_shares"] if share_end else None
    f["dilution_yoy"] = (q[share_end]["diluted_shares"] / q[prior]["diluted_shares"] - 1
                         if prior and q[prior].get("diluted_shares") else None)
    f["ttm_fcf"], f["ttm_sbc"] = m.get("ttm_fcf"), m.get("ttm_sbc")
    cyc_points = [e for e in ends[::-1][::4]][: len(ends) // 4 + 1]
    roics = [metrics.compute(upto(e), default_tax, roic_method, absent).get("roic") for e in cyc_points]
    roics = [r for r in roics if r is not None]
    f["roic_cycle_mean"] = sum(roics) / len(roics) if len(roics) >= 3 else None
    f["roic_cycle_points"] = len(roics)
    last12 = ends[-12:]
    ocf12, capex12 = _sum(q, "operating_cash_flow", last12), _sum(q, "capex", last12)
    f["fcf_12q"] = None if ocf12 is None or capex12 is None else ocf12 - capex12
    f["net_income_12q"] = _sum(q, "net_income", last12)
    f["sbc_12q"] = _sum(q, "sbc", last12)
    f["fcf_conversion_12q"] = (f["fcf_12q"] / f["net_income_12q"]
                               if f["fcf_12q"] is not None and f["net_income_12q"] and f["net_income_12q"] > 0 else None)
    for key in ("revenue_cagr_3y", "latest_revenue_yoy", "positive_yoy_share", "roic", "dilution_yoy",
                "net_debt", "ttm_fcf", "ttm_sbc", "fcf_12q", "net_income_12q"):
        if f[key] is None:
            missing.append(key)
    return f, missing


def is_cyclical_industry(sic: int, rules: dict) -> bool:
    return any(lo <= sic <= hi for lo, hi in rules["type"]["cyclical"]["sic_ranges"])


def classify_type(f: dict, rules: dict, industry: dict) -> tuple[str, str]:
    t = rules["type"]
    if f["ttm_operating_income"] <= t["unprofitable"]["ttm_operating_income_max"]:
        return "Unprofitable", f"TTM operating income is {f['ttm_operating_income']:,.0f}, not positive"
    if is_cyclical_industry(industry["sic"], rules):
        return "Cyclical", (f"SIC {industry['sic']} ({industry.get('description') or 'industry'}) is a cyclical industry; "
                            f"since {f['drawdown_since']} TTM revenue fell up to {f['revenue_drawdown']:.0%} and "
                            f"operating margin up to {f['operating_margin_drawdown'] * 100:.0f} points from a peak")
    g = f["revenue_cagr_3y"]
    if g >= t["growth_classes"]["fast_min_cagr"]:
        return "Fast Grower", f"3-year TTM revenue CAGR {g:.1%}"
    if g >= t["growth_classes"]["stalwart_min_cagr"]:
        return "Stalwart", f"3-year TTM revenue CAGR {g:.1%}"
    return "Slow Grower", f"3-year TTM revenue CAGR {g:.1%}"


def classify_quality(f: dict, kind: str, rules: dict) -> tuple[str | None, str]:
    r = rules["quality"]
    roic = f["roic_cycle_mean"] if kind == "Cyclical" else f["roic"]
    basis = f"{f['roic_cycle_points']}-point cycle mean ROIC" if kind == "Cyclical" else "TTM ROIC"
    if roic is None:
        return None, f"{basis} unavailable"
    fcf, conv, dil = f["fcf_12q"], f["fcf_conversion_12q"], f["dilution_yoy"]
    if roic < r["low_roic_max"] or fcf <= 0:
        why = f"{basis} {roic:.1%} is below {r['low_roic_max']:.0%}" if roic < r["low_roic_max"] else "12-quarter FCF is not positive"
        return "Low", why
    if roic >= r["high_roic_min"] and conv is not None and conv >= r["high_fcf_conversion_min"]:
        if dil > r["high_dilution_max"]:
            return "Average", f"{basis} {roic:.1%} with FCF conversion {conv:.0%}, but diluted shares grew {dil:.1%}"
        return "High", f"{basis} {roic:.1%}, 12-quarter FCF conversion {conv:.0%}, share change {dil:+.1%}"
    conv_text = "n/a" if conv is None else f"{conv:.0%}"
    return "Average", f"{basis} {roic:.1%}, 12-quarter FCF conversion {conv_text}"


def classify_growth(f: dict, kind: str, rules: dict) -> tuple[str | None, str]:
    r = rules["growth"]
    if kind == "Cyclical":
        g = f["through_cycle_growth"]
        if g is None:
            return None, "through-cycle growth needs 24 consecutive quarters"
        label = "Durable" if g >= r["cyclical_durable_min"] else "Weak" if g < r["cyclical_weak_max"] else "Moderate"
        return label, f"latest 12-quarter revenue vs the prior 12 quarters: {g:+.1%} a year"
    cagr, share, yoy = f["revenue_cagr_3y"], f["positive_yoy_share"], f["latest_revenue_yoy"]
    text = f"3-year CAGR {cagr:.1%}, latest TTM growth {yoy:+.1%}, {share:.0%} of the last 12 TTM changes positive"
    if "weak_max_cagr" in r:     # v1.1: only sustained weakness is Weak
        if cagr < r["weak_max_cagr"] or share < r["weak_min_positive_share"]:
            return "Weak", text
    elif yoy < 0 or share < r["weak_min_positive_share"]:
        return "Weak", text
    if (cagr >= r["durable_min_cagr"] and share >= r["durable_min_positive_share"] and yoy > 0
            and yoy >= r["durable_min_momentum"] * cagr):
        return "Durable", text
    return "Moderate", text


def discount_rate(risk_free: float, v: dict) -> float:
    return max(risk_free, v["risk_free_floor"]) + v["equity_risk_premium"]


def dcf(cash_flow: float, g1: float, v: dict, r: float) -> float:
    """Present value of cash_flow growing at g1 for high_growth_years, fading linearly to terminal growth."""
    gt, n1, n2 = v["terminal_growth"], v["high_growth_years"], v["fade_years"]
    value, cf = 0.0, cash_flow
    for year in range(1, n1 + n2 + 1):
        g = g1 if year <= n1 else g1 + (gt - g1) * (year - n1) / n2
        cf *= 1 + g
        value += cf / (1 + r) ** year
    return value + cf * (1 + gt) / (r - gt) / (1 + r) ** (n1 + n2)


def implied_growth(cash_flow: float, enterprise_value: float, v: dict, r: float, lo: float = -0.5, hi: float = 1.0) -> float:
    if dcf(cash_flow, lo, v, r) >= enterprise_value:
        return lo
    if dcf(cash_flow, hi, v, r) <= enterprise_value:
        return hi
    for _ in range(80):
        mid = (lo + hi) / 2
        lo, hi = (mid, hi) if dcf(cash_flow, mid, v, r) < enterprise_value else (lo, mid)
    return round((lo + hi) / 2, 6)


def classify_value(f: dict, kind: str, price: dict | None, rules: dict) -> tuple[str | None, str, dict]:
    v = rules["value"]
    if kind == "Cyclical":
        if f["fcf_12q"] is None or f["sbc_12q"] is None or f["through_cycle_growth"] is None:
            return None, "cycle-average cash flow or through-cycle growth unavailable", {}
        cash_flow, growth = (f["fcf_12q"] - f["sbc_12q"]) / 3, f["through_cycle_growth"]
    else:
        cash_flow, growth = f["ttm_fcf"] - f["ttm_sbc"], f["revenue_cagr_3y"]
    detail = {"cash_flow_base": cash_flow}
    if kind == "Unprofitable" or cash_flow <= 0:
        return "Speculative", f"cash flow base (FCF minus SBC) is {cash_flow:,.0f}; a DCF on it is undefined", detail
    if price is None or price.get("risk_free") is None:
        return None, "no price, share basis or risk-free rate on the valuation day", detail
    r = discount_rate(price["risk_free"], v)
    base = min(max(growth, v["base_growth_min"]), v["base_growth_max"])
    bear = base - abs(base) * (1 - v["bear_multiplier"])
    bull = min(base + abs(base) * (v["bull_multiplier"] - 1), v["bull_growth_max"])
    ev = price["market_cap"] + f["net_debt"]
    implied = implied_growth(cash_flow, ev, v, r)
    equity = {name: dcf(cash_flow, g, v, r) - f["net_debt"] for name, g in (("bear", bear), ("base", base), ("bull", bull))}
    detail |= {"discount_rate": r, "risk_free": price["risk_free"], "growth_bear": bear, "growth_base": base, "growth_bull": bull, "implied_growth": implied,
               "enterprise_value": ev, "market_cap": price["market_cap"],
               "equity_value": equity, "margin_of_safety": equity["base"] / price["market_cap"] - 1}
    text = (f"price implies {implied:.1%} growth vs base {base:.1%} (bear {bear:.1%}, bull {bull:.1%}) "
            f"at a {r:.1%} discount rate")
    if implied <= base - v["attractive_gap"]:
        return "Attractive", text, detail
    if implied > bull:
        return "Expensive", text, detail
    return "Fair", text, detail


def evaluate(q: dict, market: str, price: dict | None, rules: dict, default_tax: float, roic_method: dict,
             absent=(), industry: dict | None = None) -> dict:
    """Four independent labels with one reason each, or insufficient_data with no labels."""
    out = {"rules_version": rules["version"], "status": "insufficient_data", "labels": {}, "reasons": {},
           "features": {}, "value_detail": {}, "missing": []}
    if market not in rules["markets"]:
        out["missing"] = [f"market {market} is not covered by {rules['version']}"]
        return out
    f, missing = features(q, rules, default_tax, roic_method, absent)
    out["features"] = f
    if not industry or not isinstance(industry.get("sic"), int):
        missing = missing + ["industry SIC code"]
    if missing:
        out["missing"] = missing
        return out
    kind, type_reason = classify_type(f, rules, industry)
    quality, quality_reason = classify_quality(f, kind, rules)
    growth, growth_reason = classify_growth(f, kind, rules)
    value, value_reason, detail = classify_value(f, kind, price, rules)
    out["value_detail"] = detail
    reasons = {"type": type_reason, "quality": quality_reason, "growth": growth_reason, "value": value_reason}
    labels = {"type": kind, "quality": quality, "growth": growth, "value": value}
    absent = [k for k, label in labels.items() if label is None]
    if absent:
        out["missing"] = [f"{k}: {reasons[k]}" for k in absent]
        return out
    out.update(status="ok", labels=labels, reasons=reasons)
    return out


def as_of_is_fresh(latest_quarter: str, valuation_day: str, max_days: int = 200) -> bool:
    return 0 <= (date.fromisoformat(valuation_day) - date.fromisoformat(latest_quarter)).days <= max_days
