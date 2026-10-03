import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import leadership_report as lr

BASE = dict(asset_class="Equity", market="US", price=110, ma50=100, ma200=90, high_52w_distance=-.05, rs_rank=96, rs_3m=.1, rs_6m=.1)


def row(**k):
    return {**BASE, **k}


def test_conditions_match_core_rules_and_keep_missing_apart():
    c = lr.conditions(row())
    assert all(c.values())
    assert lr.conditions(row(high_52w_distance=-.15))["고점 -15% 이내"] is True
    assert lr.conditions(row(high_52w_distance=-.1501))["고점 -15% 이내"] is False
    assert lr.conditions(row(rs_rank=95))["RS순위 ≥95"] is True
    assert lr.conditions(row(rs_rank=94.9))["RS순위 ≥95"] is False
    assert lr.conditions(row(ma50=None))["정배열"] is None
    assert lr.conditions(row(rs_6m=0))["RS 3M·6M > 0"] is False


def test_funnel_is_cumulative_and_skips_missing():
    rows = [row(), row(rs_rank=90), row(ma50=None), row(high_52w_distance=-.3)]
    assert lr.funnel(rows) == [("전체", 4), ("정배열", 3), ("고점 -15% 이내", 2), ("RS순위 ≥95", 1), ("RS 3M·6M > 0", 1)]


def test_sector_mix_ratio():
    rows = [row(sector="Health Care", leadership_class="핵심 주도"), row(sector="Health Care", leadership_class="중립"),
            row(sector="Technology", leadership_class="중립"), row(sector="Technology", leadership_class="중립")]
    mix = {s["sector"]: s for s in lr.sector_mix(rows)}
    assert mix["Health Care"]["leaders"] == 1 and mix["Health Care"]["ratio"] == 2.0
    assert mix["Technology"]["ratio"] == 0


def test_industry_rank_uses_median_and_min_size():
    rows = [row(industry="Semis", rs_rank=r, leadership_class="중립") for r in (90, 80, 70, 60, 50)]
    rows += [row(industry="Biotech", rs_rank=r, leadership_class="핵심 주도" if r == 99 else "중립") for r in (99, 95, 40, 30, 20)]
    rows += [row(industry="Tiny", rs_rank=99, leadership_class="주도 후보")]
    ir = lr.industry_rank(rows)
    assert [g["industry"] for g in ir["groups"]] == ["Semis", "Biotech"]
    assert ir["groups"][0]["median_rs_rank"] == 70 and ir["top_cut"] == 1
    assert ir["leaders_in_top"] == 0 and ir["leaders_ranked"] == 1 and ir["leaders_unranked"] == 1


def test_single_day_share_flags_event_jumps():
    flat = [100.0] * 50 + [160.0] + [162.0] * 13
    g = lr.single_day(flat)
    assert math.isclose(g["top_day"], .6) and g["flag"]
    steady = [100 * 1.01 ** i for i in range(64)]
    s = lr.single_day(steady)
    assert not s["flag"] and s["share"] < .05
    assert lr.single_day([100.0] * 10) is None
    falling = [100.0] * 30 + [130.0] + [80.0] * 33
    assert lr.single_day(falling)["share"] is None and not lr.single_day(falling)["flag"]


def test_fundamental_flags_keep_unknown_apart_from_zero():
    assert lr.fundamental_flags("US", None)["status"] == "unknown"
    assert lr.fundamental_flags("US", {"revenue": None, "net_income": -5})["loss"] is True
    zero = lr.fundamental_flags("US", {"revenue": 0, "revenue_prev": 0, "net_income": -1e8})
    assert zero["no_revenue"] and zero["loss"] and zero["shrinking"] is None
    ok = lr.fundamental_flags("US", {"revenue": 2e9, "revenue_prev": 2.5e9, "net_income": 1e8})
    assert not ok["no_revenue"] and not ok["loss"] and ok["shrinking"]
    assert lr.fundamental_flags("KR", {"revenue": 5e9, "revenue_prev": None, "net_income": None})["no_revenue"]
    assert not lr.fundamental_flags("KR", {"revenue": 5e10})["no_revenue"]


def test_summarize_and_markdown_render():
    rows = [row(ticker="NVDA", name="NVIDIA", sector="Information Technology", industry="Semiconductors", leadership_class="중립", rs_rank=80, return_3m=.1, return_12m=.5),
            row(ticker="KOD", name="Kodiak", sector="Health Care", industry="Biotechnology", leadership_class="핵심 주도", return_3m=2.0, return_12m=3.0)]
    funda = {("US", "KOD"): {"revenue": 0, "revenue_prev": 0, "net_income": -2e8}}
    closes = {("US", "KOD"): [10.0] * 50 + [25.0] * 14}
    rep = lr.summarize(rows, funda, closes, "2026-10-02")
    us = rep["markets"]["US"]
    assert us["fundamentals"]["no_revenue"] == 1 and us["fundamentals"]["no_revenue_list"] == ["KOD Kodiak"]
    assert us["gaps"]["flagged"] == 1
    assert us["semis"]["watch"][0]["ticker"] == "NVDA" and "RS순위 ≥95" in us["semis"]["watch"][0]["fails"]
    md = lr.markdown(rep)
    assert "주도 종목 진단" in md and "KOD Kodiak" in md and "1.0배" not in md.split("### 2.")[0]


def test_files_without_revenue_counts_as_no_revenue():
    f = lr.fundamental_flags("US", {"revenue": None, "net_income": -3e8, "files_without_revenue": True})
    assert f["status"] == "known" and f["no_revenue"] and f["no_revenue_filed"] and f["loss"]


def test_latest_annual_picks_full_year_filings():
    item = lambda start, end, val, form="10-K": {"start": start, "end": end, "val": val, "form": form}
    facts = {"facts": {"us-gaap": {"Revenues": {"units": {"USD": [
        item("2024-01-01", "2024-12-31", 100.0), item("2025-01-01", "2025-12-31", 150.0),
        item("2025-10-01", "2025-12-31", 40.0), item("2026-01-01", "2026-06-30", 90.0, "10-Q")]}}}}}
    assert lr.latest_annual(facts, ("Revenues",)) == (150.0, 100.0)
    assert lr.latest_annual({"facts": {}}, ("Revenues",)) == (None, None)
