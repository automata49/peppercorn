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


SOFTWARE = {"sic": 7372, "description": "Services-Prepackaged Software"}
SEMIS = {"sic": 3674, "description": "Semiconductors & Related Devices"}
RF = 0.04                     # discount rate 9%
R = labels.discount_rate(RF, RULES["value"])


def price_for(market_cap: float, risk_free: float | None = RF) -> dict:
    return {"market_cap": market_cap, "price_date": "2025-12-31", "risk_free": risk_free}


def run(q, price=None, market="US", rules=RULES, industry=SOFTWARE):
    return labels.evaluate(q, market, price, rules, 0.21, ROIC, (), industry)


def feats(**over):
    base = {"ttm_operating_income": 10.0, "revenue_drawdown": 0.0, "operating_margin_drawdown": 0.0,
            "window_start": "2020-03-31", "drawdown_since": "2021-03-31", "revenue_cagr_3y": 0.08, "roic": 0.2, "roic_cycle_mean": 0.2,
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
    assert RULES["active"] is False and RULES["version"] == "position-rules-v1.1"
    assert labels.load_rules("position-rules-v1")["active"] is False


V1 = labels.load_rules("position-rules-v1")


def test_v1_made_a_single_negative_change_weak_but_v11_does_not():
    dip = feats(latest_revenue_yoy=-0.02, revenue_cagr_3y=0.06, positive_yoy_share=0.9)
    assert labels.classify_growth(dip, "Stalwart", V1)[0] == "Weak"
    assert labels.classify_growth(dip, "Stalwart", RULES)[0] == "Moderate"


@pytest.mark.parametrize("cagr,expected", [(0.0, "Moderate"), (-0.0001, "Weak")])
def test_v11_shrinking_revenue_is_weak(cagr, expected):
    assert labels.classify_growth(feats(revenue_cagr_3y=cagr, latest_revenue_yoy=0.01), "Stalwart", RULES)[0] == expected


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


def test_missing_risk_free_suppresses_labels():
    assert run(company(), price_for(400.0, risk_free=None))["status"] == "insufficient_data"


@pytest.mark.parametrize("rf,expected", [(0.04, 0.09), (0.025, 0.075), (0.01, 0.075)])
def test_discount_rate_is_risk_free_plus_premium_with_floor(rf, expected):
    assert labels.discount_rate(rf, RULES["value"]) == pytest.approx(expected)


def test_kr_is_not_covered_by_v1():
    out = run(company(), price_for(400.0), market="KR")
    assert out["status"] == "insufficient_data" and "not covered" in out["missing"][0]


def test_cyclical_growth_needs_24_quarters():
    path = [100 * (0.8 if 8 <= k <= 11 else 1.0) for k in range(20)]
    out = run(company(n=20, revenue_path=path), price_for(400.0), industry=SEMIS)
    assert out["status"] == "insufficient_data"


# --- type boundaries

@pytest.mark.parametrize("sic,expected", [(3674, "Cyclical"), (3673, "Stalwart"), (1000, "Cyclical"), (999, "Stalwart"),
                                          (4599, "Cyclical"), (4600, "Stalwart"), (2830, "Stalwart"), (2911, "Cyclical")])
def test_cyclical_industry_boundaries(sic, expected):
    assert labels.classify_type(feats(), RULES, {"sic": sic})[0] == expected


def test_drawdown_alone_does_not_make_a_company_cyclical():
    # a divestiture or impairment: large drawdowns in a non-cyclical industry
    assert labels.classify_type(feats(revenue_drawdown=0.4, operating_margin_drawdown=0.3), RULES, SOFTWARE)[0] == "Stalwart"


@pytest.mark.parametrize("cagr,expected", [(0.15, "Fast Grower"), (0.1499, "Stalwart"), (0.05, "Stalwart"), (0.0499, "Slow Grower")])
def test_growth_class_boundaries(cagr, expected):
    assert labels.classify_type(feats(revenue_cagr_3y=cagr), RULES, SOFTWARE)[0] == expected


def test_zero_operating_income_is_unprofitable_before_cyclical():
    assert labels.classify_type(feats(ttm_operating_income=0.0), RULES, SEMIS)[0] == "Unprofitable"


def test_cyclical_industry_end_to_end_reports_drawdown_evidence():
    path = [100 * (1.02 ** k) * (0.75 if 12 <= k <= 15 else 1.0) for k in range(24)]
    out = run(company(revenue_path=path), price_for(400.0), industry=SEMIS)
    assert out["labels"]["type"] == "Cyclical" and "SIC 3674" in out["reasons"]["type"]
    assert out["features"]["revenue_drawdown"] > 0.15 and "revenue fell up to" in out["reasons"]["type"]


def test_missing_industry_suppresses_labels():
    assert run(company(), price_for(400.0), industry=None)["status"] == "insufficient_data"
    assert run(company(), price_for(400.0), industry={"sic": None})["status"] == "insufficient_data"


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

def test_negative_latest_growth_is_never_durable():
    assert labels.classify_growth(feats(latest_revenue_yoy=-0.001), "Stalwart", RULES)[0] == "Moderate"


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
    ev = labels.dcf(10.0, 0.12, v, R)
    assert labels.implied_growth(10.0, ev, v, R) == pytest.approx(0.12, abs=1e-5)


def test_value_labels_follow_implied_versus_base_and_bull():
    v, f = RULES["value"], feats(ttm_fcf=12.0, ttm_sbc=2.0, revenue_cagr_3y=0.10, net_debt=0.0)
    cheap = labels.dcf(10.0, 0.10 - 0.05, v, R)
    rich = labels.dcf(10.0, 0.15 + 0.001, v, R)
    assert labels.classify_value(f, "Stalwart", price_for(cheap), RULES)[0] == "Attractive"
    assert labels.classify_value(f, "Stalwart", price_for(labels.dcf(10.0, 0.10, v, R)), RULES)[0] == "Fair"
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


# --- backtest harness (offline pieces)

def test_backtest_universe_and_dates_are_fixed_and_disjoint():
    import backtest
    tickers = backtest.tickers()
    assert len(tickers) == len(set(tickers)) == 114
    b = backtest.tickers("B")
    assert len(b) == len(set(b)) == 118 and not set(b) & set(tickers)
    c = backtest.tickers("C")
    assert len(c) == len(set(c)) == 106 and not set(c) & (set(tickers) | set(b))
    assert not set(backtest.AS_OF) & set(backtest.HOLDOUT) and max(backtest.HOLDOUT) < min(backtest.AS_OF)


def test_backtest_acceptance_needs_every_group_ordered_with_enough_observations():
    import backtest

    def row(ticker, as_of, labels_, outcomes):
        return {"ticker": ticker, "as_of": as_of, "status": "ok", "labels": labels_, "outcomes": outcomes,
                "value_detail": {"implied_growth": 0.05}}
    rows = []
    for i in range(10):
        for label, roic, growth, ret, kind, dd in (("High", 0.3, 0.1, 0.5, "Cyclical", 0.2), ("Average", 0.15, 0.05, 0.3, "Stalwart", 0.0),
                                                  ("Low", 0.05, 0.01, 0.1, "Slow Grower", 0.0)):
            g = {"High": "Durable", "Average": "Moderate", "Low": "Weak"}[label]
            v = {"High": "Attractive", "Average": "Fair", "Low": "Expensive"}[label]
            rows.append(row(f"{label}{i}", "2019-06-30", {"type": kind, "quality": label, "growth": g, "value": v},
                            {"fwd_roic": roic, "fwd_revenue_cagr": growth, "fwd_return": ret, "fwd_revenue_drawdown": dd}))
    report = backtest.summarize(rows)
    assert report["acceptance"]["A1 quality"] and report["acceptance"]["A2 growth"] and report["acceptance"]["A3 value"]
    assert report["acceptance"]["A5 coverage"] is False            # 30 companies < 40
    assert report["activate"] is False
    report = backtest.summarize(rows[:-1])                          # Low / Weak / Expensive drop to n = 9
    assert report["acceptance"]["A1 quality"] is False


def test_v12_differs_from_v11_only_in_version_and_gate_notes():
    v11, v12 = labels.load_rules("position-rules-v1.1"), labels.load_rules("position-rules-v1.2")
    notes = {"version", "active", "active_note", "supersedes"}
    assert {k: v for k, v in v11.items() if k not in notes} == {k: v for k, v in v12.items() if k not in notes}
    assert v12["active"] is False


V2 = labels.load_rules("position-rules-v2")


def test_v2_changes_only_value_names_and_test():
    v12 = labels.load_rules("position-rules-v1.2")
    notes = {"version", "active", "active_note", "supersedes", "value"}
    assert {k: v for k, v in v12.items() if k not in notes} == {k: v for k, v in V2.items() if k not in notes}
    same = {k: v for k, v in v12["value"].items() if k not in ("labels", "labels_rule")}
    assert all(V2["value"][k] == v for k, v in same.items()) and V2["active"] is False


def test_v2_value_labels_are_expectations_not_buy_signals():
    v, f = V2["value"], feats(ttm_fcf=12.0, ttm_sbc=2.0, revenue_cagr_3y=0.10, net_debt=0.0)
    assert labels.classify_value(f, "Stalwart", price_for(labels.dcf(10.0, 0.05, v, R)), V2)[0] == "Undemanding"
    assert labels.classify_value(f, "Stalwart", price_for(labels.dcf(10.0, 0.10, v, R)), V2)[0] == "Reasonable"
    assert labels.classify_value(f, "Stalwart", price_for(labels.dcf(10.0, 0.151, v, R)), V2)[0] == "Demanding"
    assert not {"Attractive", "Expensive", "Fair"} & set(v["labels"])


def test_expectations_gate_needs_order_and_majorities():
    import backtest

    def rows(shares):
        out = []
        for label, share in zip(("Undemanding", "Reasonable", "Demanding"), shares):
            for i in range(20):
                met = i < share * 20
                out.append({"ticker": f"{label}{i}", "as_of": "2019-06-30", "status": "ok",
                            "labels": {"type": "Stalwart", "quality": "High", "growth": "Durable", "value": label},
                            "outcomes": {"fwd_revenue_cagr": 0.10 if met else 0.0, "fwd_return": 0.1,
                                         "fwd_roic": 0.2, "fwd_revenue_drawdown": 0.0},
                            "value_detail": {"implied_growth": 0.05}})
        return out
    assert backtest.summarize(rows((0.8, 0.5, 0.2)), V2)["value_expectations_pass"] is True
    assert backtest.summarize(rows((0.45, 0.4, 0.2)), V2)["value_expectations_pass"] is False   # Undemanding not a majority
    assert backtest.summarize(rows((0.8, 0.5, 0.55)), V2)["value_expectations_pass"] is False   # Demanding a majority
