import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import stock_flags as sf


def eq(market, ticker, **k):
    return {"asset_class": "Equity", "market": market, "ticker": ticker, **k}


def test_only_true_flags_are_written_and_unknown_is_never_a_flag():
    rows = [eq("US", "KOD", leadership_class="핵심 주도"), eq("US", "NVDA"), eq("US", "UNKNOWN"), eq("KR", "005930"), {"asset_class": "ETF", "market": "US", "ticker": "SPY"}]
    funda = {("US", "KOD"): {"revenue": None, "net_income": -2e8, "files_without_revenue": True},
             ("US", "NVDA"): {"revenue": 1.3e11, "revenue_prev": 6e10, "net_income": 7e10},
             ("KR", "005930"): {"revenue": 3.0e14, "revenue_prev": 3.2e14, "net_income": 3e13}}
    closes = {("US", "KOD"): [10.0] * 50 + [27.8] * 14}
    flags = sf.build(rows, funda, closes)
    assert flags["US:KOD"]["loss"] and flags["US:KOD"]["no_revenue"] and flags["US:KOD"]["jump"]["top_day"] == 1.78
    assert "US:NVDA" not in flags and "US:UNKNOWN" not in flags and "US:SPY" not in flags
    assert flags["KR:005930"] == {"shrinking": True, "revenue_growth": -0.0625}


def test_jump_needs_a_large_day_that_dominates_the_window():
    assert sf.jump([100.0] * 50 + [126.0] * 14)["top_day"] == 0.26
    assert sf.jump([100.0] * 50 + [118.0] * 14) is None          # +18%: below the 25% day
    steady = [100 * 1.02 ** i for i in range(50)] + [100 * 1.02 ** 49 * 1.3] * 14
    assert sf.jump(steady) is None                               # the 30% day is under 60% of a larger climb
    assert sf.jump([100.0] * 20) is None


import datetime


def rising(n=300, start=50.0, step=.004):
    return [start * (1 + step) ** i for i in range(n)]


def test_trend_template_counts_minervini_conditions_and_needs_a_year():
    tt = sf.trend_template(rising(), 90)
    assert tt["pass"] == 8 and all(tt["conditions"].values())
    assert sf.trend_template(rising(), 69)["conditions"]["rs_rank"] is False
    assert sf.trend_template(rising(), None)["pass"] == 7
    assert sf.trend_template(rising(251), 90) is None             # under 252 sessions: unknown
    falling = list(reversed(rising()))
    tt = sf.trend_template(falling, 90)
    assert not tt["conditions"]["ma200_rising"] and not tt["conditions"]["near_52w_high"]
    # 30% above the 52-week low is required: a flat year then +20% fails it.
    flat = [100.0] * 280 + [120.0] * 20
    assert sf.trend_template(flat, 90)["conditions"]["above_52w_low"] is False


def test_growth_and_sepa_boundaries():
    assert sf.growth(120, 100) == .2
    assert sf.growth(1, 0) is None and sf.growth(1, -1) is None and sf.growth(None, 1) is None
    full = {"pass": 8}
    assert sf.sepa(full, {"rev": .20, "eps": .25})
    assert not sf.sepa(full, {"rev": .199, "eps": .5})
    assert not sf.sepa(full, {"rev": .5, "eps": .249})
    assert not sf.sepa(full, {"rev": .5, "eps": None})            # unknown EPS growth (e.g. prior loss) is no badge
    assert not sf.sepa({"pass": 7}, {"rev": .5, "eps": .5})
    assert not sf.sepa(None, {"rev": .5, "eps": .5})


def test_build_publishes_growth_and_sepa_only_above_thresholds():
    rows = [eq("US", "WIN", rs_rank=95, leader_tt=True), eq("US", "SLOW", rs_rank=95, leader_tt=True), eq("KR", "000660", rs_rank=80)]
    quarters = {("US", "WIN"): {"rev": .35, "eps": .6}, ("US", "SLOW"): {"rev": .05, "eps": .1}, ("KR", "000660"): {"rev": .25, "eps": None}}
    closes = {("US", "WIN"): rising(), ("US", "SLOW"): rising(), ("KR", "000660"): rising()}
    flags = sf.build(rows, {}, closes, quarters)
    assert flags["US:WIN"] == {"growth": {"rev": .35, "eps": .6}, "sepa": True}
    assert "US:SLOW" not in flags
    assert flags["KR:000660"] == {"growth": {"rev": .25}}


def test_quarter_and_report_selection():
    assert sf.us_quarter_candidates(datetime.date(2026, 10, 3)) == [(2026, 2), (2026, 1), (2025, 4)]
    assert sf.us_quarter_candidates(datetime.date(2026, 8, 1))[0] == (2026, 1)        # Q2 10-Qs not all filed yet
    assert sf.us_quarter_candidates(datetime.date(2026, 2, 25))[0] == (2025, 4)
    assert sf.kr_report(datetime.date(2026, 10, 3)) == (2026, "11012", "2026 반기")
    assert sf.kr_report(datetime.date(2026, 4, 20))[1] == "11011"
    assert sf.kr_report(datetime.date(2026, 2, 1)) == (2025, "11014", "2025 3분기")
    assert sf.dart_pair({"thstrm_add_amount": "1,200", "frmtrm_add_amount": "1,000", "thstrm_amount": "700", "frmtrm_q_amount": "650"}, False) == (1200, 1000)
    assert sf.dart_pair({"thstrm_amount": "700", "frmtrm_q_amount": "", "frmtrm_amount": "9"}, False) == (700, None)
    assert sf.dart_pair({"thstrm_amount": "700", "frmtrm_amount": "500"}, True) == (700, 500)
