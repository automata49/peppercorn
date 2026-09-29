"""Boundary, missing-data and determinism fixtures for labels.py and prices.py (offline)."""
from __future__ import annotations

import copy
from datetime import date

import pytest

import labels
import methods
import prices

RULES = labels.load_rules()
ROIC = methods.for_market("US")["roic"]


def _quarter_ends(n: int, start: str = "2020-03-31") -> list[str]:
    ends, d = [], date.fromisoformat(start)
    for _ in range(n):
        ends.append(d.isoformat())
        month = d.month + 3
        year = d.year + (month - 1) // 12
        month = (month - 1) % 12 + 1
        d = date(year, month, 30 if month in (6, 9) else 31)
    return ends


def company(n=24, growth=0.08, margin=0.25, equity=300.0, dilution=0.0, sbc=2.0, ocf_ratio=1.1, capex=4.0,
            revenue_path=None, margin_path=None):
    """Synthetic quarterly facts: annual growth rate, constant margin unless paths are given."""
    q = {}
    for k, end in enumerate(_quarter_ends(n)):
        rev = revenue_path[k] if revenue_path else 100 * (1 + growth) ** (k / 4)
        m = margin_path[k] if margin_path else margin
        op = rev * m
        ni = op * 0.79
        q[end] = {"revenue": rev, "gross_profit": rev * 0.6, "operating_income": op, "pretax_income": op,
                  "income_tax": op * 0.21, "net_income": ni, "operating_cash_flow": ni * ocf_ratio, "capex": capex,
                  "sbc": sbc, "diluted_shares": 1000 * (1 + dilution) ** (k / 4), "equity": equity, "debt": 50.0,
                  "debt_current": 0.0, "cash": 30.0, "short_term_investments": 20.0}
    return q


def price_for(market_cap: float) -> dict:
    return {"market_cap": market_cap, "price_date": "2025-12-31"}


def run(q, price=None, market="US", rules=RULES):
    return labels.evaluate(q, market, price, rules, 0.21, ROIC)


def feats(**over):
    base = {"ttm_operating_income": 10.0, "revenue_drawdown": 0.0, "operating_margin_drawdown": 0.0,
            "window_start": "2020-03-31", "revenue_cagr_3y": 0.08, "roic": 0.2, "roic_cycle_mean": 0.2,
            "roic_cycle_points": 6, "fcf_12q": 100.0, "fcf_conversion_12q": 0.9, "dilution_yoy": 0.0,
            "positive_yoy_share": 1.0, "latest_revenue_yoy": 0.08, "through_cycle_growth": 0.06,
            "ttm_fcf": 40.0, "ttm_sbc": 2.0, "sbc_12q": 6.0, "net_debt": 0.0}
    return base | over


# --- end to end

def test_steady_compounder_gets_four_labels_with_reasons():
    out = run(company(), price_for(400.0))
    assert out["status"] == "ok"
    assert out["labels"]["type"] == "Stalwart" and out["labels"]["quality"] == "High"
    assert out["labels"]["growth"] == "Durable" and out["labels"]["value"] in {"Attractive", "Fair", "Expensive"}
    assert set(out["reasons"]) == {"type", "quality", "growth", "value"} and all(out["reasons"].values())
    assert not any(k in out for k in ("score", "position_score", "composite_score", "total_score"))


def test_same_input_gives_identical_output():
    q, p = company(), price_for(400.0)
    assert run(copy.deepcopy(q), p) == run(copy.deepcopy(q), p)


def test_rules_are_inactive_until_the_backtest_passes():
    assert RULES["active"] is False and RULES["version"] == "position-rules-v1"


# --- missing data suppresses all four labels

@pytest.mark.parametrize("field", ["sbc", "operating_cash_flow", "net_income", "cash"])
def test_missing_input_in_latest_quarters_suppresses_every_label(field):
    q = company()
    q[max(q)].pop(field)
    out = run(q, price_for(400.0))
    assert out["status"] == "insufficient_data" and out["labels"] == {} and out["reasons"] == {}
    assert out["missing"]


def test_fiscal_q4_without_share_count_uses_the_previous_quarter():
    q = company()
    q[max(q)].pop("diluted_shares")
    out = run(q, price_for(400.0))
    assert out["status"] == "ok" and out["features"]["shares_quarter"] == sorted(q)[-2]


def test_two_quarters_without_share_count_is_insufficient():
    q = company()
    for end in sorted(q)[-2:]:
        q[end].pop("diluted_shares")
    assert run(q, price_for(400.0))["status"] == "insufficient_data"


def test_unknown_is_not_treated_as_zero():
    q = company()
    q[max(q)]["sbc"] = None
    assert run(q, price_for(400.0))["status"] == "insufficient_data"


def test_short_history_is_insufficient():
    out = run(company(n=18), price_for(400.0))
    assert out["status"] == "insufficient_data" and "TTM points" in out["missing"][0]


def test_gap_inside_window_truncates_history_to_insufficient():
    q = company()
    del q[sorted(q)[10]]
    assert run(q, price_for(400.0))["status"] == "insufficient_data"


def test_missing_price_suppresses_labels():
    out = run(company(), None)
    assert out["status"] == "insufficient_data" and out["labels"] == {}
    assert any("price" in item for item in out["missing"])


def test_kr_is_not_covered_by_v1():
    out = run(company(), price_for(400.0), market="KR")
    assert out["status"] == "insufficient_data" and "not covered" in out["missing"][0]


def test_cyclical_growth_needs_24_quarters():
    path = [100 * (0.8 if 8 <= k <= 11 else 1.0) for k in range(20)]
    out = run(company(n=20, revenue_path=path), price_for(400.0))
    assert out["status"] == "insufficient_data"


# --- type boundaries

@pytest.mark.parametrize("value,expected", [(0.15, "Cyclical"), (0.1499, "Stalwart")])
def test_revenue_drawdown_boundary(value, expected):
    assert labels.classify_type(feats(revenue_drawdown=value), RULES)[0] == expected


@pytest.mark.parametrize("value,expected", [(0.15, "Cyclical"), (0.1499, "Stalwart")])
def test_margin_drawdown_boundary(value, expected):
    assert labels.classify_type(feats(operating_margin_drawdown=value), RULES)[0] == expected


@pytest.mark.parametrize("cagr,expected", [(0.15, "Fast Grower"), (0.1499, "Stalwart"), (0.05, "Stalwart"), (0.0499, "Slow Grower")])
def test_growth_class_boundaries(cagr, expected):
    assert labels.classify_type(feats(revenue_cagr_3y=cagr), RULES)[0] == expected


def test_zero_operating_income_is_unprofitable_before_cyclical():
    assert labels.classify_type(feats(ttm_operating_income=0.0, revenue_drawdown=0.5), RULES)[0] == "Unprofitable"


def test_real_downturn_is_classified_cyclical_end_to_end():
    path = [100 * (1.02 ** k) * (0.75 if 12 <= k <= 15 else 1.0) for k in range(24)]
    out = run(company(revenue_path=path), price_for(400.0))
    assert out["labels"]["type"] == "Cyclical" and "fell" in out["reasons"]["type"]


# --- quality boundaries

@pytest.mark.parametrize("roic,expected", [(0.15, "High"), (0.1499, "Average"), (0.08, "Average"), (0.0799, "Low")])
def test_roic_boundaries(roic, expected):
    assert labels.classify_quality(feats(roic=roic), "Stalwart", RULES)[0] == expected


@pytest.mark.parametrize("conv,expected", [(0.7, "High"), (0.6999, "Average"), (None, "Average")])
def test_fcf_conversion_boundary(conv, expected):
    assert labels.classify_quality(feats(fcf_conversion_12q=conv), "Stalwart", RULES)[0] == expected


@pytest.mark.parametrize("dil,expected", [(0.03, "High"), (0.0301, "Average")])
def test_dilution_boundary(dil, expected):
    assert labels.classify_quality(feats(dilution_yoy=dil), "Stalwart", RULES)[0] == expected


def test_nonpositive_fcf_is_low_even_with_high_roic():
    assert labels.classify_quality(feats(fcf_12q=0.0), "Stalwart", RULES)[0] == "Low"


def test_cyclical_quality_uses_cycle_mean_not_peak():
    label, reason = labels.classify_quality(feats(roic=0.40, roic_cycle_mean=0.10), "Cyclical", RULES)
    assert label == "Average" and "cycle mean" in reason


# --- growth boundaries

def test_negative_latest_growth_is_weak():
    assert labels.classify_growth(feats(latest_revenue_yoy=-0.001), "Stalwart", RULES)[0] == "Weak"


@pytest.mark.parametrize("share,expected", [(0.5, "Moderate"), (0.4999, "Weak"), (0.75, "Durable"), (0.7499, "Moderate")])
def test_consistency_boundaries(share, expected):
    assert labels.classify_growth(feats(positive_yoy_share=share), "Stalwart", RULES)[0] == expected


@pytest.mark.parametrize("cagr,expected", [(0.03, "Durable"), (0.0299, "Moderate")])
def test_durable_floor(cagr, expected):
    assert labels.classify_growth(feats(revenue_cagr_3y=cagr, latest_revenue_yoy=0.03), "Stalwart", RULES)[0] == expected


@pytest.mark.parametrize("yoy,expected", [(0.04, "Durable"), (0.0399, "Moderate")])
def test_momentum_boundary(yoy, expected):
    assert labels.classify_growth(feats(revenue_cagr_3y=0.08, latest_revenue_yoy=yoy), "Stalwart", RULES)[0] == expected


@pytest.mark.parametrize("g,expected", [(0.05, "Durable"), (0.0499, "Moderate"), (0.0, "Moderate"), (-0.0001, "Weak")])
def test_cyclical_growth_boundaries(g, expected):
    assert labels.classify_growth(feats(through_cycle_growth=g), "Cyclical", RULES)[0] == expected


# --- value

def test_dcf_round_trip_recovers_implied_growth():
    v = RULES["value"]
    ev = labels.dcf(10.0, 0.12, v)
    assert labels.implied_growth(10.0, ev, v) == pytest.approx(0.12, abs=1e-5)


def test_value_labels_follow_implied_versus_base_and_bull():
    v, f = RULES["value"], feats(ttm_fcf=12.0, ttm_sbc=2.0, revenue_cagr_3y=0.10, net_debt=0.0)
    cheap = labels.dcf(10.0, 0.10 - 0.05, v)
    rich = labels.dcf(10.0, 0.15 + 0.001, v)
    assert labels.classify_value(f, "Stalwart", price_for(cheap), RULES)[0] == "Attractive"
    assert labels.classify_value(f, "Stalwart", price_for(labels.dcf(10.0, 0.10, v)), RULES)[0] == "Fair"
    assert labels.classify_value(f, "Stalwart", price_for(rich), RULES)[0] == "Expensive"


def test_nonpositive_owner_earnings_is_speculative():
    label, reason, _ = labels.classify_value(feats(ttm_fcf=2.0, ttm_sbc=2.0), "Stalwart", price_for(100.0), RULES)
    assert label == "Speculative" and "undefined" in reason


def test_negative_base_growth_gets_a_worse_bear_case():
    _, _, detail = labels.classify_value(feats(revenue_cagr_3y=-0.04), "Stalwart", price_for(400.0), RULES)
    assert detail["growth_bear"] < detail["growth_base"] < detail["growth_bull"]


def test_base_growth_is_capped():
    _, _, detail = labels.classify_value(feats(revenue_cagr_3y=0.60), "Fast Grower", price_for(400.0), RULES)
    assert detail["growth_base"] == 0.20 and detail["growth_bull"] == 0.30


# --- prices

def _quote():
    return {"symbol": "X", "source": "yahoo-chart", "dates": ["2024-06-07", "2024-06-10", "2024-06-11"],
            "close": [100.0, 11.0, 12.0], "adjclose": [100.0, 11.0, 12.0],
            "splits": [{"date": "2024-06-10", "ratio": 10.0}], "raw_sha256": None}


def test_market_cap_moves_pre_split_share_count_to_price_basis():
    # 1,000 shares filed before a 10:1 split, priced after it at 12 (split-adjusted): real cap 12 x 10,000
    assert prices.market_cap(_quote(), "2024-06-11", 1000, "2024-05-29")["market_cap"] == 120000


def test_market_cap_with_share_count_filed_after_split_needs_no_factor():
    assert prices.market_cap(_quote(), "2024-06-11", 10000, "2024-08-28")["split_factor"] == 1.0


def test_stale_or_missing_price_gives_no_market_cap():
    assert prices.market_cap(_quote(), "2024-06-30", 1000, "2024-05-29") is None
    assert prices.market_cap(_quote(), "2024-06-11", None, "2024-05-29") is None
    assert prices.close_on(_quote(), "2024-06-01") is None


def test_total_return_uses_adjusted_close():
    assert prices.total_return(_quote(), "2024-06-10", "2024-06-11") == pytest.approx(12 / 11 - 1)


def test_parse_reads_chart_payload_and_splits():
    body = {"chart": {"result": [{"meta": {"currency": "USD"}, "timestamp": [1718026200, 1718112600],
                                  "indicators": {"quote": [{"close": [11.0, None]}], "adjclose": [{"adjclose": [10.9, None]}]},
                                  "events": {"splits": {"1718026200": {"date": 1718026200, "numerator": 10.0, "denominator": 1.0}}}}]}}
    parsed = prices.parse(body, "X")
    assert parsed["dates"] == ["2024-06-10"] and parsed["splits"] == [{"date": "2024-06-10", "ratio": 10.0}]
