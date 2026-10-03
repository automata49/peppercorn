import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import stock_flags as sf


def eq(market, ticker, **k):
    return {"asset_class": "Equity", "market": market, "ticker": ticker, **k}


def test_only_true_flags_are_written_and_unknown_is_never_a_flag():
    rows = [eq("US", "KOD"), eq("US", "NVDA"), eq("US", "UNKNOWN"), eq("KR", "005930"), {"asset_class": "ETF", "market": "US", "ticker": "SPY"}]
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
