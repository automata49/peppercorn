"""Offline tests for the walk-forward protocol: sealing, evaluation windows, retirement and proposals."""
from __future__ import annotations

import json

import pytest

import backtest
import forward
import labels

SEED = labels.load_rules(forward.SEED)


def test_quarter_ends_and_maturity():
    assert forward.quarter_ends("2023-03-31", "2023-12-31") == ["2023-03-31", "2023-06-30", "2023-09-30", "2023-12-31"]
    assert forward.maturity("2023-06-30") == "2026-10-28"


def test_candidate_id_ignores_version_notes_but_not_thresholds():
    a = forward.as_candidate(SEED, "2026-09-30", None, "seed")
    renamed = {**SEED, "version": "x", "active_note": "y"}
    assert forward.candidate_id(renamed) == a["id"] and a["rules"]["version"] == a["id"]
    assert forward.candidate_id(forward._set(SEED, ("quality", "high_roic_min"), 0.18)) != a["id"]
    assert a["rules"]["active"] is False


def test_neighbours_move_one_parameter_one_step():
    steps = forward.neighbours(SEED)
    assert len(steps) == 2 * len(forward.MUTATION_SPACE)       # every v2 value sits in the middle of its grid
    for change, rules in steps:
        diffs = [p for p in forward.MUTATION_SPACE if forward._get(rules, p) != forward._get(SEED, p)]
        assert len(diffs) == 1 and "->" in change


def test_seal_is_write_once(tmp_path):
    ledger = forward.Ledger(tmp_path)
    row = {"ticker": "X", "status": "ok", "labels": {"type": "Stalwart"}, "value_detail": {"implied_growth": 0.05}}
    assert ledger.seal("c1", "2023-06-30", "2026-09-30", [row]) is True
    changed = {**row, "labels": {"type": "Cyclical"}}
    assert ledger.seal("c1", "2023-06-30", "2026-10-30", [changed]) is False
    sealed = ledger.prediction("c1", "2023-06-30")
    assert sealed["labels"]["X"] == {"type": "Stalwart", "implied_growth": 0.05} and sealed["sealed_at"] == "2026-09-30"


def _panel(dates):
    return [{"ticker": "X", "as_of": d, "status": "panel", "outcomes": {"fwd_roic": 0.2}} for d in dates]


def test_forward_rows_only_count_dates_maturing_after_freeze(tmp_path):
    ledger = forward.Ledger(tmp_path)
    dates = forward.quarter_ends(forward.FORWARD_START, "2024-06-30")
    for d in dates:
        ledger.seal("c1", d, "2026-09-30", [{"ticker": "X", "status": "ok", "labels": {"value": "Reasonable"},
                                            "value_detail": {"implied_growth": 0.04}}])
    candidate = {"id": "c1", "frozen_at": "2026-09-30"}
    rows, used = forward.forward_rows(_panel(dates), ledger, candidate, "2027-08-01")
    # 2023-03-31 matured on 2026-07-29, before the freeze; 2023-06-30 .. 2024-03-31 matured by 2027-07-29
    assert used == ["2023-06-30", "2023-09-30", "2023-12-31", "2024-03-31"]
    assert [r["as_of"] for r in rows] == used and rows[0]["value_detail"] == {"implied_growth": 0.04}
    assert "implied_growth" not in rows[0]["labels"]


def _report(passes: bool):
    acceptance = {k: passes for k in ("A1 quality", "A2 growth", "A3 value", "A4 type", "A5 coverage")}
    groups = {"n": 20, "median": 0.1, "tickers": []}
    return {"acceptance": acceptance, "activate": passes, "type_stability": 0.9,
            "tests": {"quality": {"order": ["High", "Average", "Low"], "groups": {k: groups for k in ("High", "Average", "Low")}}},
            "value_expectations": {"Undemanding": {"n": 20, "met_share": 0.7}, "Reasonable": {"n": 20, "met_share": 0.5},
                                   "Demanding": {"n": 20, "met_share": 0.2}}}


@pytest.fixture
def stubbed(monkeypatch):
    """Label and summarize stubs: forward reports pass or fail on demand; in-sample fitness favours high_roic_min 0.18."""
    state = {"forward_passes": False}
    monkeypatch.setattr(forward, "_labelled", lambda panel, rules, dates: [
        {"ticker": "X", "as_of": d, "status": "ok", "labels": {"quality": "High"}, "value_detail": {"implied_growth": 0.05},
         "_roic": rules["quality"]["high_roic_min"]} for d in sorted(dates)])

    def summarize(rows, rules):
        if rows and "_roic" not in rows[0]:
            return _report(state["forward_passes"])
        report = _report(False)
        report["acceptance"]["A1 quality"] = rules["quality"]["high_roic_min"] >= 0.18
        return report
    monkeypatch.setattr(backtest, "summarize", summarize)
    return state


def test_first_step_seeds_seals_and_proposes(tmp_path, stubbed):
    ledger = forward.Ledger(tmp_path)
    result = forward.step(_panel([]), ledger, "2026-09-30", SEED)
    ids = [c["id"] for c in ledger.candidates()]
    assert len(ids) == 1 + forward.PROPOSE_PER_STEP
    assert result["proposed"][0]["change"] == "quality.high_roic_min 0.15 -> 0.18"
    seed_id = forward.candidate_id(SEED)
    assert sorted(p.name for p in (tmp_path / "predictions" / seed_id).iterdir())[0] == "2023-03-31.json"
    assert (tmp_path / "STATUS.md").exists() and json.loads((tmp_path / "scoreboard.json").read_text())["today"] == "2026-09-30"


def test_candidate_failing_forward_gate_is_retired_and_passing_one_is_only_flagged(tmp_path, stubbed):
    ledger = forward.Ledger(tmp_path)
    forward.step(_panel([]), ledger, "2026-09-30", SEED)
    dates = forward.quarter_ends(forward.FORWARD_START, "2024-03-31")
    result = forward.step(_panel(dates), ledger, "2027-08-01", SEED)
    assert all(e["retired"] == "2027-08-01" for e in result["candidates"] if e["frozen_at"] == "2026-09-30")
    assert result["ready_for_review"] == []

    stubbed["forward_passes"] = True
    ledger2 = forward.Ledger(tmp_path / "second")
    forward.step(_panel([]), ledger2, "2026-09-30", SEED)
    result = forward.step(_panel(dates), ledger2, "2027-08-01", SEED)
    assert result["ready_for_review"] and all(c["rules"]["active"] is False for c in ledger2.candidates())


def test_live_candidates_are_capped(tmp_path, stubbed):
    ledger = forward.Ledger(tmp_path)
    for day in ("2026-09-30", "2026-10-30", "2026-11-30", "2026-12-30"):
        forward.step(_panel([]), ledger, day, SEED)
    assert len([c for c in ledger.candidates() if not c["retired"]]) == forward.MAX_LIVE
