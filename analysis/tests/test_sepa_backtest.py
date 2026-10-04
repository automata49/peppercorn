import datetime
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import sepa_backtest as sb

D = datetime.date


def test_registration_is_frozen_and_inactive():
    assert sb.RULES["active"] is False and sb.RULES["results"]["adopted"] is False and sb.RULES["results"]["passes"] == []
    assert sb.VARIANTS == ["v1-sepa", "sepa", "tt8", "v1-growth"] and len(sb.RULES_SHA) == 12


def test_point_in_time_availability():
    assert sb.us_available(2026, 2) == D(2026, 8, 19)                  # 50 days after June 30
    assert sb.kr_available(2026, "11012") == D(2026, 8, 31)
    assert sb.kr_available(2025, "11011") == D(2026, 4, 15)            # annual report of 2025 from April 2026
    h = [(D(2026, 5, 20), .30, .40), (D(2026, 8, 19), .10, .50), (D(2025, 11, 19), .50, .60)]
    assert sb.growth_at(h, D(2026, 8, 18))["rev"] == .30               # the August value is not yet public
    assert sb.growth_at(h, D(2026, 8, 19))["rev"] == .10
    assert sb.growth_at(h, D(2025, 1, 1)) is None
    # A missing latest revenue falls back to the previous quarter (a fiscal Q4 absent from quarterly frames) ...
    assert sb.growth_at([(D(2026, 2, 19), None, None), (D(2025, 11, 19), .25, .3)], D(2026, 3, 1))["rev"] == .25
    # ... but never further back than 2 quarters.
    old = [(D(2025, 5, 20), .5, .5)] + [(D(2025, 8, 19) + datetime.timedelta(days=91 * k), None, None) for k in range(3)]
    assert sb.growth_at(old, D(2026, 6, 1)) is None


def test_growth_pass_boundaries():
    assert sb.growth_pass({"rev": .20, "eps": .25})
    assert not sb.growth_pass({"rev": .19, "eps": .9}) and not sb.growth_pass({"rev": .9, "eps": .24})
    assert not sb.growth_pass({"rev": .9, "eps": None}) and not sb.growth_pass(None)


def _frames(n=420):
    idx = pd.bdate_range("2023-01-02", periods=n)
    bench = pd.Series([100.0 * 1.0005 ** i for i in range(n)], index=idx)
    cols = {"LEAD": [100.0 * 1.004 ** i for i in range(n)], "SLOW": [100.0 * 1.0025 ** i for i in range(n)], "FLAT": [100.0] * n,
            **{f"P{k}": [100.0 * (1 + .0001 * k) ** i for i in range(n)] for k in range(6)}}
    close = pd.DataFrame(cols, index=idx)
    vol = pd.DataFrame(1000.0, index=idx, columns=close.columns)
    return {"close": close, "high": close, "low": close, "volume": vol, "bench": bench}


def test_trend_template_needs_history_and_rs():
    f = _frames()
    assert sb.tt8(f["close"], 400, "LEAD", 99)
    assert not sb.tt8(f["close"], 400, "LEAD", 69)
    assert not sb.tt8(f["close"], 250, "LEAD", 99)                     # under 273 sessions
    assert not sb.tt8(f["close"], 400, "FLAT", 99)
    # C1: a missing day inside the window is skipped, not a failure.
    gap = f["close"].copy()
    gap.iloc[300, gap.columns.get_loc("LEAD")] = float("nan")
    assert sb.tt8(gap, 400, "LEAD", 99)


def test_variants_end_to_end():
    f = _frames()
    groups = {t: "Semiconductors" for t in f["close"].columns}
    d0 = f["close"].index[0].date()
    growth = {"LEAD": [(d0, .5, .6)], "SLOW": [(d0, .5, .6)], "P1": [(d0, .5, .6)]}
    r = sb.run_market(f, groups, growth, "US")
    last = {n: {x["ticker"] for x in r["picks"][n][-1]["leaders"]} for n in r["picks"]}
    assert "LEAD" in last["v1"] and "LEAD" in last["v1-sepa"] and "LEAD" in last["sepa"] and "LEAD" in last["tt8"]
    assert "P1" not in last["sepa"]                                     # growth without the Trend Template
    assert last["v1-sepa"] <= last["v1"] and last["v1-sepa"] <= last["sepa"] and last["v1-growth"] <= last["v1"]
    ev = sb.evaluate({"US": r, "KR": r})
    assert set(ev["verdict"]) == set(sb.VARIANTS) and ev["rules_sha"] == sb.RULES_SHA
    comp = sb.composition(f, groups, {t: "Information Technology" for t in groups}, growth)
    assert comp["rules"]["sepa"]["semis"] == comp["rules"]["sepa"]["n"] >= 1
    md = sb.markdown(ev, {"US": comp})
    assert "SEPA-DEFAULT" in md and "판정" in md and "최근 시점 구성" in md
