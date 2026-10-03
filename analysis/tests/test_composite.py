import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import composite as cp  # noqa: E402


def test_rules_are_inactive_and_preregistered():
    assert cp.COMPOSITE_RULES["active"] is False
    assert set(cp.COMPOSITE_RULES["gates"]) == {"A1", "A2", "A3", "A4", "A5"}
    assert abs(sum(cp.WEIGHTS.values()) - 1) < 1e-12


def test_price_components_need_history_and_use_only_the_past():
    closes = [100 * 1.001 ** i for i in range(300)]
    vols = [1000] * 300
    c = cp.price_components(closes, closes, vols, 260)
    assert c["rs"] is not None and c["high"] == 0 and c["ad"] is None  # every day up -> no down volume
    later = closes[:261] + [1.0] * 39  # a crash after t must not change the value at t
    assert cp.price_components(later, later, vols, 260) == c
    assert cp.price_components(closes, closes, vols, 200)["rs"] is None


def test_ad_ratio_counts_up_and_down_volume():
    closes = [100, 101, 100] * 30
    vols = [10, 30, 10] * 30
    c = cp.price_components(closes, closes, vols, 89)
    assert c["ad"] is not None and c["ad"] > 1  # up days carry 30, down days 10


def test_group_needs_three_members():
    g = cp.group_scores({"a": 1, "b": 2, "c": 3, "d": 9, "e": None}, {"a": "X", "b": "X", "c": "X", "d": "Y", "e": "X"})
    assert g == {"a": 2, "b": 2, "c": 2, "d": None, "e": 2}


def test_composite_reweights_and_requires_rs():
    assert abs(cp.composite({"rs": 90, "group": 60, "high": None, "ad": 30}) - (90 * .30 + 60 * .15 + 30 * .10) / .55) < 1e-9
    assert cp.composite({"rs": None, "group": 90, "high": 90, "ad": 90}) is None
    assert cp.composite({"rs": 90, "group": None, "high": None, "ad": 90}) is None  # fewer than 3 components


def test_rate_returns_market_percentiles():
    raw = {i: {"rs": i / 10, "high": -i / 100, "ad": 1 + i / 10} for i in range(10)}
    rated = cp.rate(raw, {i: "X" for i in range(10)})
    assert rated[9][1] == 99 and rated[0][1] == 11


def test_evaluate_applies_gates():
    dates = []
    for d in range(30):
        rows = []
        for i in range(400):
            comp = 1 + i * 98 // 399
            rs = 99 - comp + 1  # RS-only ranks the opposite way
            rows.append((comp, rs, comp / 1000 - .03))
        dates.append({"date": f"2020-{d:02d}", "rows": rows})
    res = cp.evaluate(dates)
    assert res["gates"] == {"A1": True, "A2": True, "A3": True, "A4": True, "A5": True} and res["passed"]
    worse = [{"date": d["date"], "rows": [(r[1], r[0], r[2]) for r in d["rows"]]} for d in dates]
    assert not cp.evaluate(worse)["passed"]
    assert not cp.evaluate(dates[:10])["gates"]["A5"]
