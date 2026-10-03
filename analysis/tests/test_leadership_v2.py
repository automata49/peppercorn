import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import leadership_backtest as bt
import leadership_v2 as v2

V = {v["name"]: v for v in v2.VARIANTS}
BASE = dict(price=110, ma50=100, ma200=90, high_52w_distance=-.05, rs_rank=96, rs_3m=.1, rs_6m=.1, ibd_rs_estimate=90,
            group_top_share=.1, group_rs_share=0, rs_line_gap=0, large_cap=False, no_revenue=False, loss=False)


def m(**k):
    return {**BASE, **k}


def test_registration_is_frozen_and_inactive():
    assert v2.RULES["active"] is False and v2.RULES["results"]["adopted"] is False and v2.RULES["results"]["chosen"] is None
    assert len(v2.VARIANTS) == 8 and {v["group_top"] for v in v2.VARIANTS} == {None, .4, .3, .2}
    assert len(v2.RULES_SHA) == 12


def test_v1_flags_match_live_boundaries():
    assert v2.v1_flags(m()) == (True, False)
    assert v2.v1_flags(m(rs_rank=94)) == (False, True)            # IBD 90 keeps it a candidate
    assert v2.v1_flags(m(rs_rank=94, ibd_rs_estimate=79)) == (False, False)
    assert v2.v1_flags(m(high_52w_distance=-.1501)) == (False, True)
    assert v2.v1_flags(m(high_52w_distance=-.2501)) == (False, False)
    assert v2.v1_flags(m(ma50=None)) == (False, False)            # missing input never passes
    assert v2.v1_flags(m(rs_6m=0)) == (False, True)


def test_v2_fundamental_and_group_gates():
    assert v2.v2_flags(m(no_revenue=True), V["v2-gall"]) == (False, False)
    assert v2.v2_flags(m(loss=True), V["v2-gall"]) == (True, False)
    assert v2.v2_flags(m(loss=True), V["v2-gall-noloss"]) == (False, False)
    assert v2.v2_flags(m(loss=None), V["v2-gall-noloss"]) == (True, False)      # unknown is not a loss
    assert v2.v2_flags(m(group_top_share=.35), V["v2-g40"]) == (True, False)
    assert v2.v2_flags(m(group_top_share=.35), V["v2-g30"]) == (False, False)
    assert v2.v2_flags(m(group_top_share=None), V["v2-g40"]) == (False, False)  # unranked group fails the gate
    assert v2.v2_flags(m(group_top_share=None), V["v2-gall"]) == (True, False)


def test_large_cap_needs_rs85_and_to_lead_its_group_and_rs_line():
    big = dict(large_cap=True, rs_rank=86, ibd_rs_estimate=70)
    assert v2.v2_flags(m(**big), V["v2-gall"]) == (True, False)
    assert v2.v2_flags(m(**{**big, 'rs_rank': 84}), V["v2-gall"]) == (False, False)
    assert v2.v2_flags(m(**{**big, 'group_rs_share': .25}), V["v2-gall"]) == (False, False)   # not top 20% of its group
    assert v2.v2_flags(m(**{**big, 'rs_line_gap': -.06}), V["v2-gall"]) == (False, False)     # RS line 6% below its high
    assert v2.v2_flags(m(**{**big, 'rs_line_gap': -.05}), V["v2-gall"]) == (True, False)
    assert v2.v2_flags(m(**dict(big, large_cap=False)), V["v2-gall"]) == (False, False)  # small caps keep RS 95


def test_selection_picks_strictest_passing_and_checks_holdout():
    def s(ex, hit=.6, dd=-.1, n=20):
        return {"excess63": ex, "hit63": hit, "median_dd": dd, "avg_leaders": n, "excess21": 0}
    def stats(fn):
        return {"v1": {"US": s(.02), "KR": s(.02)}, **{v["name"]: {"US": fn(v), "KR": fn(v)} for v in v2.VARIANTS}}
    sel = stats(lambda v: s(.03 if v["group_top"] in (None, .4, .3) else .01))
    hold = stats(lambda v: s(.025))
    d = v2.select({"selection": sel, "holdout": hold})
    assert d["chosen"] == "v2-g30-noloss" and d["adopted"] is True
    hold_bad = stats(lambda v: s(.01))
    assert v2.select({"selection": sel, "holdout": hold_bad})["adopted"] is False
    none = stats(lambda v: s(.0))
    assert v2.select({"selection": none, "holdout": none}) == {"passing_selection": [], "chosen": None, "adopted": False, "holdout_gates": None}


def test_gates_drawdown_tolerance_and_minimum_leaders():
    base = {"excess63": .01, "hit63": .5, "median_dd": -.10, "avg_leaders": 30, "excess21": 0}
    g = v2.gates({**base, "median_dd": -.12}, base, "US")
    assert g["G3"] is True
    assert v2.gates({**base, "median_dd": -.121}, base, "US")["G3"] is False
    assert v2.gates({**base, "avg_leaders": 9}, base, "US")["G4"] is False
    assert v2.gates({**base, "avg_leaders": 3}, base, "KR")["G4"] is True


def test_fundamentals_year_is_point_in_time():
    assert bt.fundamentals_year(pd.Timestamp("2025-03-31")) == 2023
    assert bt.fundamentals_year(pd.Timestamp("2025-04-30")) == 2024


def _frames(n=330):
    idx = pd.bdate_range("2024-01-01", periods=n)
    bench = pd.Series([100.0 * 1.0005 ** i for i in range(n)], index=idx)
    lead = [100.0 * 1.004 ** i for i in range(n)]
    flat = [100.0] * n
    close = pd.DataFrame({"LEAD": lead, "FLAT": flat, **{f"P{k}": [100.0 * (1 + .0001 * k) ** i for i in range(n)] for k in range(6)}}, index=idx)
    vol = pd.DataFrame(1000.0, index=idx, columns=close.columns)
    vol["LEAD"] = 1e6
    return {"close": close, "high": close, "low": close, "volume": vol, "bench": bench}


def test_snapshot_and_run_market_end_to_end():
    f = _frames()
    groups = {t: "Semis" for t in f["close"].columns}
    i = 300
    snap = bt.snapshot(f, i, groups, {}, f["close"].index[i])
    lead = snap["LEAD"]
    assert lead["rs_rank"] == 99 and lead["large_cap"] and lead["rs_line_gap"] == 0 and lead["group_top_share"] == 1.0
    assert lead["group_rs_share"] == 0 and v2.v1_flags(lead)[0]
    assert snap["FLAT"]["rs_rank"] == snap["P0"]["rs_rank"] < 30   # two flat series tie at the bottom
    r = bt.run_market(f, groups, {})
    assert r["dates"] and all(any(x["ticker"] == "LEAD" for x in p["leaders"]) for p in r["picks"]["v1"])
    first = r["picks"]["v1"][0]["leaders"][0]
    assert first["excess"] > 0 and first["dd"] == 0
    ev = bt.evaluate({"US": r, "KR": r})
    assert set(ev["stats"]) == {"selection", "holdout"} and ev["rules_sha"] == v2.RULES_SHA
    md = bt.markdown(ev, {"US": {"date": r["dates"][-1], "v1": 1, "chosen": 1, "both": 1}})
    assert "LEADERSHIP-V2" in md and "판정" in md


def test_point_in_time_fundamentals_exclude_by_year():
    f = _frames()
    groups = {t: "Semis" for t in f["close"].columns}
    yr = bt.fundamentals_year(f["close"].index[300])
    snap = bt.snapshot(f, 300, groups, {("LEAD", yr): {"no_revenue": True, "loss": True}}, f["close"].index[300])
    assert v2.v2_flags(snap["LEAD"], V["v2-gall"]) == (False, False) and v2.v1_flags(snap["LEAD"])[0]
