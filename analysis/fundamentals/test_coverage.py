"""Offline tests for wider collection: EPS, total liabilities, KR share counts, display metrics, targets and units."""
from __future__ import annotations

import json

import pytest

import collect
import dart
import methods
import metrics
import persist
import sec
import targets


def _fact(start, end, val, filed="2025-11-01", accn="0001-25-000001"):
    row = {"end": end, "val": val, "form": "10-Q", "filed": filed, "accn": accn}
    if start:
        row["start"] = start
    return row


def test_sec_eps_uses_per_share_unit_and_liabilities_line():
    facts = {"facts": {"us-gaap": {
        "Revenues": {"units": {"USD": [_fact("2025-07-01", "2025-09-30", 100)]}},
        "EarningsPerShareDiluted": {"units": {"USD/shares": [_fact("2025-07-01", "2025-09-30", 1.25)]}},
        "Liabilities": {"units": {"USD": [_fact(None, "2025-09-30", 70)]}},
    }}}
    parsed = sec.parse(facts)
    row = parsed["quarters"]["2025-09-30"]
    assert row["eps_diluted"] == 1.25 and row["liabilities"] == 70
    assert parsed["source_lineage"]["2025-09-30"]["eps_diluted"]["inputs"][0]["unit"] == "USD/shares"


def test_sec_liabilities_derived_only_with_equity_including_nci():
    base = {
        "Revenues": {"units": {"USD": [_fact("2025-07-01", "2025-09-30", 100)]}},
        "LiabilitiesAndStockholdersEquity": {"units": {"USD": [_fact(None, "2025-09-30", 300)]}},
    }
    with_nci = {"facts": {"us-gaap": {**base, "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest":
                                      {"units": {"USD": [_fact(None, "2025-09-30", 120)]}}}}}
    parsed = sec.parse(with_nci)
    assert parsed["quarters"]["2025-09-30"]["liabilities"] == 180
    lineage = parsed["source_lineage"]["2025-09-30"]["liabilities"]
    assert lineage["operation"] == "subtract" and len(lineage["inputs"]) == 2 and all(i["accession"] for i in lineage["inputs"])
    parent_only = {"facts": {"us-gaap": {**base, "StockholdersEquity": {"units": {"USD": [_fact(None, "2025-09-30", 120)]}}}}}
    assert "liabilities" not in sec.parse(parent_only)["quarters"]["2025-09-30"]


def _dart_rep(rows, share_rows=None, rcp="20251114000123"):
    return {"year": 2025, "reprt_code": "11013", "fs_div": "CFS", "rcp_no": rcp, "rcept_dt": "20251114",
            "raw_sha256": "a" * 64, "rows": rows, "share_rows": share_rows or [], "share_sha256": "c" * 64}


def _r(sj, aid, nm, amt, add=None):
    return {"sj_div": sj, "account_id": aid, "account_nm": nm, "thstrm_amount": str(amt),
            "thstrm_add_amount": "" if add is None else str(add), "rcept_no": "20251114000123", "currency": "KRW"}


def test_dart_eps_prefers_diluted_and_liabilities_and_shares_are_read():
    rows = [_r("IS", "ifrs-full_Revenue", "매출액", 100, 300), _r("IS", "-", "기본주당이익", 900, 2700),
            _r("IS", "-", "희석주당이익", 880, 2640), _r("BS", "ifrs-full_Liabilities", "부채총계", 5000)]
    shares = [{"se": "보통주", "distb_stock_co": "5,919,637,922", "rcept_no": "20251114000123"},
              {"se": "우선주", "distb_stock_co": "815,974,664", "rcept_no": "20251114000123"},
              {"se": "합계", "distb_stock_co": "6,735,612,586", "rcept_no": "20251114000123"}]
    parsed = dart.parse([_dart_rep(rows, shares)])
    row = parsed["quarters"]["2025-03-31"]
    assert row["liabilities"] == 5000 and row["shares_common"] == 5_919_637_922 and row["shares_preferred"] == 815_974_664
    share_in = parsed["source_lineage"]["2025-03-31"]["shares_common"]["inputs"][0]
    assert share_in["receipt"] == "20251114000123" and share_in["filed"] == "20251114" and share_in["raw_sha256"]
    assert parsed["source_lineage"]["2025-03-31"]["eps_diluted"]["inputs"][0]["account_nm"] == "희석주당이익"


def test_dart_share_counts_from_another_filing_stay_unknown():
    rows = [_r("IS", "ifrs-full_Revenue", "매출액", 100, 300)]
    shares = [{"se": "보통주", "distb_stock_co": "100", "rcept_no": "20251201000999"}]
    assert "shares_common" not in dart.parse([_dart_rep(rows, shares)])["quarters"]["2025-03-31"]


def _quarters(n=13):
    ends = ["2023-03-31", "2023-06-30", "2023-09-30", "2023-12-31", "2024-03-31", "2024-06-30", "2024-09-30",
            "2024-12-31", "2025-03-31", "2025-06-30", "2025-09-30", "2025-12-31", "2026-03-31"][-n:]
    return {e: {"revenue": 100 + 10 * i, "operating_income": 20, "net_income": 15, "pretax_income": 20,
                "income_tax": 4, "operating_cash_flow": 18, "capex": 3, "equity": 200, "liabilities": 150,
                "debt": 50, "cash": 10, "short_term_investments": 5, "eps_diluted": 1.0 + 0.1 * i,
                "diluted_shares": 10} for i, e in enumerate(ends)}


def test_display_metrics_and_unknowns():
    q = _quarters()
    m = metrics.compute(q, 0.21, methods.for_market("US")["roic"])
    assert m["revenue_yoy_q"] == pytest.approx(220 / 180 - 1) and m["debt_ratio"] == 0.75
    assert m["eps_ttm"] == pytest.approx(2.2 + 2.1 + 2.0 + 1.9) and m["eps_yoy_q"] == pytest.approx(2.2 / 1.8 - 1)
    assert m["eps_cagr_3y"] is None      # 13 quarters cannot form the TTM three years earlier
    assert m["ttm_operating_cash_flow"] == 72 and m["diluted_shares_latest"] == 10
    q[max(q)].pop("liabilities")
    q[max(q)].pop("eps_diluted")
    m = metrics.compute(q, 0.21, methods.for_market("US")["roic"])
    assert m["debt_ratio"] is None and m["eps_yoy_q"] is None and m["eps_ttm"] is None


def test_display_metrics_carry_no_score_key():
    m = metrics.compute(_quarters(), 0.21, methods.for_market("US")["roic"])
    assert not {"score", "position_score", "composite_score", "total_score"} & set(m)


def test_units_per_field():
    assert persist.unit_for("eps_diluted", "KRW") == "KRW/share" and persist.unit_for("shares_common", "KRW") == "shares"
    assert persist.unit_for("revenue", "USD") == "USD" and persist.unit_for("diluted_shares", "USD") == "shares"
    assert set(persist.EXPECTED_BY_MARKET["KR"]) - set(persist.EXPECTED_BY_MARKET["US"]) == {"shares_common", "shares_preferred"}


def _board():
    return [
        {"market": "US", "ticker": "AAA", "name": "A", "asset_class": "Equity", "leadership_class": "핵심 주도", "rs_rank": 99},
        {"market": "US", "ticker": "BRK.B", "name": "B", "asset_class": "Equity", "leadership_class": "주도 후보", "rs_rank": 90},
        {"market": "US", "ticker": "ZZZ", "name": "Z", "asset_class": "Equity", "leadership_class": "주도 후보", "rs_rank": 80},
        {"market": "KR", "ticker": "000660", "name": "SK", "asset_class": "Equity", "leadership_class": "강세 전환", "rs_rank": 95},
        {"market": "KR", "ticker": "111111", "name": "X", "asset_class": "Equity", "leadership_class": "주도 후보", "rs_rank": 85},
        {"market": "US", "ticker": "SPY", "name": "ETF", "asset_class": "ETF", "leadership_class": "핵심 주도", "rs_rank": 99},
        {"market": "US", "ticker": "WEAK", "name": "W", "asset_class": "Equity", "leadership_class": "약세", "rs_rank": 10},
    ]


def test_targets_are_public_leaders_mapped_to_filers():
    built, skipped = targets.build(_board(), {"AAA": 1, "BRK-B": 2}, {"000660": "00164779"})
    keys = [(t["market"], t["ticker"]) for t in built]
    assert keys[:2] == [(t["market"], t["ticker"]) for t in collect.TARGETS]
    assert ("US", "AAA") in keys and ("US", "BRK.B") in keys and ("KR", "000660") in keys
    assert ("US", "SPY") not in keys and ("US", "WEAK") not in keys
    assert any("ZZZ" in s for s in skipped) and any("111111" in s for s in skipped)
    assert next(t for t in built if t["ticker"] == "000660")["corp_code"] == "00164779"


def test_targets_limit_includes_reference_companies():
    built, _ = targets.build(_board(), {"AAA": 1, "BRK-B": 2}, {"000660": "00164779"}, limit=3)
    assert len(built) == 3 and {t["ticker"] for t in built} >= {"NVDA", "005930"}


def _result(ticker):
    return {"ticker": ticker, "market": "US", "error": "boom"}


def test_tolerate_refusals_fails_only_for_reference_companies(monkeypatch, tmp_path, capsys):
    (tmp_path / "ZZZ.json").write_text(json.dumps(_result("ZZZ")), encoding="utf-8")
    monkeypatch.setattr("sys.argv", ["persist.py", str(tmp_path), "--tolerate-refusals"])
    persist.main()
    assert "REFUSED ZZZ" in capsys.readouterr().out
    (tmp_path / "NVDA.json").write_text(json.dumps(_result("NVDA")), encoding="utf-8")
    with pytest.raises(SystemExit):
        persist.main()
    monkeypatch.setattr("sys.argv", ["persist.py", str(tmp_path)])
    (tmp_path / "NVDA.json").unlink()
    with pytest.raises(SystemExit):
        persist.main()


def test_edge_client_requests_a_fresh_oidc_token_per_company(monkeypatch):
    monkeypatch.setenv("ACTIONS_ID_TOKEN_REQUEST_URL", "https://oidc.example/token?x=1")
    monkeypatch.setenv("ACTIONS_ID_TOKEN_REQUEST_TOKEN", "req")
    issued = iter(["t1", "t2"])
    seen = []

    class R:
        def __init__(self, body, status=200):
            self._body, self.status_code, self.text = body, status, ""

        def json(self):
            return self._body

        def raise_for_status(self):
            pass
    monkeypatch.setattr(persist.requests, "get", lambda url, **kw: (seen.append(url), R({"value": next(issued)}))[1])
    posted = []
    monkeypatch.setattr(persist.requests, "post", lambda url, **kw: (posted.append(kw["headers"]["Authorization"]), R({"ok": True}))[1])
    client = persist.EdgeClient("https://f.example/position-ingest", audience="peppercorn-supabase")
    planned = {"market": "US", "ticker": "A", "facts": [], "snapshot": None}
    client.send(planned)
    client.send(planned)
    assert posted == ["Bearer t1", "Bearer t2"] and seen[0].endswith("&audience=peppercorn-supabase")
