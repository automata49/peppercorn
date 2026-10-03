import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import universe_v2 as u  # noqa: E402


def us(ticker="OKLO", price=50.0, cap=8e9, tv=4e8, name="Oklo Inc. Class A Common Stock", **kw):
    return u.Candidate("US", ticker, name, "NYSE", price, cap, tv, **kw)


def kr(code="353200", price=30_000.0, cap=1.5e12, tv=1e10, name="대덕전자", **kw):
    return u.Candidate("KR", code, name, "KOSPI", price, cap, tv, **kw)


def test_thresholds_are_the_agreed_starting_point():
    assert u.THRESHOLDS == {
        "US": {"price": 5.0, "market_cap": 300e6, "traded_value": 5e6},
        "KR": {"price": 1_000.0, "market_cap": 100e9, "traded_value": 2e9},
    }
    assert u.BUFFER == 0.70


def test_nyse_and_non_index_stocks_pass():
    assert u.decide(us(), existing=False) == u.Decision(us(), True, "pass")
    assert u.decide(kr(), existing=False).included
    assert u.decide(kr("119850", 20_000.0, 6e11, 8e9, "지엔씨에너지"), existing=False).included


def test_boundaries_are_inclusive_for_new_stocks():
    assert u.decide(us(price=5.0, cap=300e6, tv=5e6), False).included
    assert u.decide(us(price=4.99), False).reason == "below:price"
    assert u.decide(us(cap=299.9e6), False).reason == "below:market_cap"
    assert u.decide(us(tv=4.99e6), False).reason == "below:traded_value"
    assert u.decide(kr(price=1_000.0, cap=100e9, tv=2e9), False).included
    assert u.decide(kr(price=999.0), False).reason == "below:price"


def test_existing_members_use_the_70_percent_buffer():
    d = u.decide(us(price=3.5, cap=210e6, tv=3.5e6), existing=True)
    assert d.included and d.reason == "buffer"
    assert u.decide(us(price=3.49), existing=True).reason == "below:price"
    assert u.decide(us(tv=3.49e6), existing=True).reason == "below:traded_value"
    assert u.decide(us(price=3.5), existing=False).reason == "below:price"


def test_missing_data_never_admits_and_never_removes_alone():
    assert u.decide(us(cap=None), existing=False).reason == "missing:market_cap"
    assert u.decide(us(tv=None), existing=False).reason == "missing:traded_value"
    assert u.decide(us(cap=None, tv=None), existing=True).included


def test_exclusions_win_over_size():
    assert not u.decide(us(flags={"non_common"}), True).included
    assert u.decide(kr(listing_days=10), False).reason == "new_listing"
    assert u.decide(kr(listing_days=30), False).included
    assert u.decide(kr(listing_days=None), False).included


def test_us_flags():
    assert u.us_flags("X", "United States Steel Corporation", "Steel") == set()
    assert u.us_flags("FDMT", "Fundamental Holdings", None) == set()
    assert "non_common" in u.us_flags("ABCU", "ABC Acquisition Corp - Units", None)
    assert "non_common" in u.us_flags("ABCDW", "ABCD Inc Warrant", None)
    assert "non_common" in u.us_flags("PFF", "Some Preferred Stock", None)
    assert "spac_or_trust" in u.us_flags("SPCX", "Spacex Holdings", "Blank Checks")
    assert "symbol" in u.us_flags("ab$", "Bad", None)
    assert u.us_flags("BRK.B", "Berkshire Hathaway Inc. Class B", None) == set()


def test_kr_flags():
    assert u.kr_flags("005930", "삼성전자", "") == set()
    assert "preferred" in u.kr_flags("005935", "삼성전자우", "")
    assert "preferred" in u.kr_flags("00088K", "한화3우B", "")
    assert "spac" in u.kr_flags("123450", "하나스팩30호", "")
    assert "reit_or_fund" in u.kr_flags("330590", "롯데리츠", "")
    assert "administrative" in u.kr_flags("123400", "가나다", "관리종목(소속부없음)")
    assert "caution" in u.kr_flags("123400", "가나다", "투자주의환기종목(소속부없음)")


def test_to_float_keeps_unknown_separate_from_zero():
    assert u.to_float("$1,234.50") == 1234.5
    assert u.to_float("1.5B") == 1.5e9
    assert u.to_float("0") == 0.0
    assert u.to_float("") is None and u.to_float("NA") is None and u.to_float(None) is None
    assert u.to_float(float("nan")) is None


def test_select_dedupes_and_summarizes():
    decisions = u.select([us(), us(), us("TINY", price=1.0), kr()], existing=set())
    assert [d.candidate.ticker for d in decisions] == ["OKLO", "TINY", "353200"]
    s = u.summarize(decisions)
    assert s["US"] == {"candidates": 2, "included": 1, "buffer": 0, "reasons": {"below:price": 1}}
    assert s["KR"]["included"] == 1
