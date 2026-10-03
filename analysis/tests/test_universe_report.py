import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import universe_report as r  # noqa: E402


def test_cume_rank_matches_postgres_round_cume_dist():
    ranks = r.cume_rank({"a": 1.0, "b": 2.0, "c": 2.0, "d": 3.0, "e": None})
    # cume_dist: a .25, b/c .75 (ties share the highest), d 1.0 -> round(1+98x)
    assert ranks == {"a": 26, "b": 75, "c": 75, "d": 99, "e": None}
    assert r.cume_rank({"x": None}) == {"x": None}


def test_score_reweights_over_available_periods():
    assert r.score({"rs_1m": .1, "rs_3m": .1, "rs_6m": None, "rs_12m": None}) == .1
    assert abs(r.score({"rs_1m": .3, "rs_3m": 0, "rs_6m": 0, "rs_12m": 0}) - .09) < 1e-12
    assert r.score({}) is None


def test_metrics_returns_and_ibd_need_history():
    closes = [100 + i for i in range(260)]
    m = r.metrics(closes, closes, closes)
    assert m["return_1w"] == closes[-1] / closes[-6] - 1
    assert m["return_12m"] == closes[-1] / closes[-253] - 1
    assert m["ibd_score"] is not None and m["ma200"] is not None
    short = r.metrics(closes[:100], closes[:100], closes[:100])
    assert short["ibd_score"] is None and short["return_12m"] is None and short["ma200"] is None


def test_classify_mirrors_sql_precedence():
    base = {"price": 110, "ma50": 100, "ma200": 90, "high_52w_distance": -.05, "rs_rank": 96, "ibd_rs_estimate": 90,
            "rs_3m": .1, "rs_6m": .1, "rs_1w": .01, "rs_1m": .01}
    assert r.classify(base) == "핵심 주도"
    assert r.classify({**base, "rs_rank": 90}) == "주도 후보"
    assert r.classify({**base, "rs_rank": 90, "ibd_rs_estimate": 70}) == "기타"
    # not structural (MA50 below MA200), above MA50, RS improving -> 강세 전환
    assert r.classify({**base, "ma50": 95, "ma200": 100, "price": 99, "rs_rank": 75}) == "강세 전환"
    assert r.classify({**base, "rs_rank": None}) == "기타"


def test_population_change_moves_ranks_and_classes():
    data = {}
    for i in range(10):
        data[("US", f"S{i}")] = {"price": 110, "ma50": 100, "ma200": 90, "high_52w_distance": -.05, "ibd_score": i,
                                 "rs_1m": i / 100, "rs_3m": .1, "rs_6m": .1, "rs_12m": i / 100, "rs_1w": .01}
    small = {("US", f"S{i}") for i in range(5, 10)}
    big = set(data)
    a, b = r.evaluate(small, data), r.evaluate(big, data)
    assert a[("US", "S5")]["rs_rank"] < b[("US", "S5")]["rs_rank"]
    rep = r.compare(a, b)["US"]
    assert rep["v1_count"] == 5 and rep["v2_count"] == 10 and rep["added"] == 5 and rep["removed"] == 0


def test_yahoo_symbols():
    assert r.yahoo_symbol("US", "BRK.B", "NYSE") == "BRK-B"
    assert r.yahoo_symbol("KR", "119850", "KOSDAQ") == "119850.KQ"
    assert r.yahoo_symbol("KR", "353200", "KOSPI") == "353200.KS"
