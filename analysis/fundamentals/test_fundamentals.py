"""오프라인 테스트: 네트워크 없이 누적→분기 변환과 파싱 로직을 검증한다.
실행: python -m pytest -q  (또는 python test_fundamentals.py)
"""
from datetime import date

import dart
import metrics
import methods
import reconcile
import sec
from quarters import derive_quarters


def test_ytd_to_quarter():
    d = {("2025-01-01", "2025-03-31"): 10, ("2025-01-01", "2025-06-30"): 25,
         ("2025-01-01", "2025-09-30"): 45, ("2025-01-01", "2025-12-31"): 70}
    assert derive_quarters(d) == {"2025-03-31": 10, "2025-06-30": 15, "2025-09-30": 20, "2025-12-31": 25}


def test_direct_quarter_preferred():
    d = {("2025-04-01", "2025-06-30"): 16, ("2025-01-01", "2025-06-30"): 25, ("2025-01-01", "2025-03-31"): 10}
    assert derive_quarters(d)["2025-06-30"] == 16


def _sec_fact(start, end, val, form="10-Q", filed="2025-12-01"):
    f = {"end": end, "val": val, "form": form, "filed": filed}
    if start:
        f["start"] = start
    return f


def test_sec_parse_fiscal_year_not_calendar():
    # NVDA 처럼 회계연도가 1월 말에 끝나는 경우: 현금흐름은 누적, 매출은 3개월 값
    rev = [_sec_fact("2025-01-27", "2025-04-27", 44), _sec_fact("2025-04-28", "2025-07-27", 46),
           _sec_fact("2025-07-28", "2025-10-26", 57), _sec_fact("2025-01-27", "2026-01-25", 210, "10-K", "2026-02-26")]
    ocf = [_sec_fact("2025-01-27", "2025-04-27", 27), _sec_fact("2025-01-27", "2025-07-27", 42),
           _sec_fact("2025-01-27", "2025-10-26", 66), _sec_fact("2025-01-27", "2026-01-25", 100, "10-K", "2026-02-26")]
    eq = [_sec_fact(None, e, 100) for e in ("2025-04-27", "2025-07-27", "2025-10-26", "2026-01-25")]
    facts = {"entityName": "TEST", "facts": {"us-gaap": {
        "Revenues": {"units": {"USD": rev}},
        "NetCashProvidedByUsedInOperatingActivities": {"units": {"USD": ocf}},
        "StockholdersEquity": {"units": {"USD": eq}},
    }}}
    q = sec.parse(facts)["quarters"]
    assert q["2026-01-25"]["revenue"] == 210 - 44 - 46 - 57   # 4분기 = 연간 - 1~3분기
    assert q["2025-07-27"]["operating_cash_flow"] == 15        # 42 - 27
    assert q["2026-01-25"]["operating_cash_flow"] == 34        # 100 - 66
    assert q["2025-10-26"]["equity"] == 100


def test_sec_instant_tag_switch_and_debt_total():
    ends = ["2025-04-27", "2025-07-27", "2025-10-26"]
    rev = [_sec_fact(s, e, 10) for s, e in [("2025-01-27", "2025-04-27"), ("2025-04-28", "2025-07-27"), ("2025-07-28", "2025-10-26")]]
    facts = {"facts": {"us-gaap": {
        "Revenues": {"units": {"USD": rev}},
        # 회사가 3분기부터 단기투자 태그를 바꾼 경우
        "MarketableSecuritiesCurrent": {"units": {"USD": [_sec_fact(None, e, 40) for e in ends[:2]]}},
        "DebtSecuritiesAvailableForSaleCurrent": {"units": {"USD": [_sec_fact(None, ends[2], 55)]}},
        "LongTermDebt": {"units": {"USD": [_sec_fact(None, e, 8) for e in ends]}},
        "LongTermDebtCurrent": {"units": {"USD": [_sec_fact(None, e, 1) for e in ends]}},
    }}}
    p = sec.parse(facts)
    q = p["quarters"]
    assert q["2025-07-27"]["short_term_investments"] == 40
    assert q["2025-10-26"]["short_term_investments"] == 55
    assert p["tags"]["short_term_investments"] == "DebtSecuritiesAvailableForSaleCurrent"
    assert "debt_current" not in q["2025-10-26"]      # 총액 태그라 유동성 부분 중복 제외


def test_sec_preserves_history_across_duration_tags_and_uses_explicit_units():
    facts = {"facts": {"us-gaap": {
        "Revenues": {"units": {"EUR": [_sec_fact("2025-01-01", "2025-03-31", 999)],
                                "USD": [_sec_fact("2025-01-01", "2025-03-31", 10)]}},
        "RevenueFromContractWithCustomerExcludingAssessedTax": {"units": {"USD": [
            _sec_fact("2025-04-01", "2025-06-30", 20)]}},
        "WeightedAverageNumberOfDilutedSharesOutstanding": {"units": {"USD": [
            _sec_fact("2025-01-01", "2025-03-31", 100)],
            "shares": [_sec_fact("2025-01-01", "2025-03-31", 1000)]}},
    }}}
    parsed = sec.parse(facts)
    assert parsed["quarters"]["2025-03-31"]["revenue"] == 10
    assert parsed["quarters"]["2025-06-30"]["revenue"] == 20
    assert parsed["quarters"]["2025-03-31"]["diluted_shares"] == 1000
    assert parsed["tag_by_period"]["2025-03-31"]["revenue"] == "Revenues"
    assert parsed["tag_by_period"]["2025-06-30"]["revenue"] == "RevenueFromContractWithCustomerExcludingAssessedTax"


def test_sec_amendment_selects_latest_per_span():
    old = _sec_fact("2025-01-01", "2025-03-31", 10, filed="2025-05-01")
    new = _sec_fact("2025-01-01", "2025-03-31", 12, form="10-Q/A", filed="2025-06-01")
    old["accn"], new["accn"] = "original", "amended"
    facts = {"facts": {"us-gaap": {"Revenues": {"units": {"USD": [old, new]}}}}}
    parsed = sec.parse(facts)
    assert parsed["quarters"]["2025-03-31"]["revenue"] == 12
    assert parsed["source_lineage"]["2025-03-31"]["revenue"]["inputs"][0]["accession"] == "amended"
    earlier = sec.parse(facts, as_of="2025-05-31")
    assert earlier["quarters"]["2025-03-31"]["revenue"] == 10
    assert [r["accession"] for r in earlier["source_revisions"]["2025-03-31"]["revenue"]] == ["original"]
    assert [r["accession"] for r in parsed["source_revisions"]["2025-03-31"]["revenue"]] == ["original", "amended"]
    assert sec.parse(facts, as_of="2025-04-30")["quarters"] == {}
    import pytest
    for noncanonical in ("20250531", "2025-W22-6"):
        with pytest.raises(ValueError, match="YYYY-MM-DD"):
            sec.parse(facts, as_of=noncanonical)


def test_sec_as_of_excludes_future_instant_and_fallback_tag():
    revenue = _sec_fact("2025-01-01", "2025-03-31", 100, filed="2025-05-01")
    cash_old = _sec_fact(None, "2025-03-31", 50, filed="2025-05-01")
    cash_new = _sec_fact(None, "2025-03-31", 60, filed="2025-06-01")
    fallback = _sec_fact(None, "2025-03-31", 40, filed="2025-06-01")
    facts = {"facts": {"us-gaap": {
        "Revenues": {"units": {"USD": [revenue]}},
        "CashAndCashEquivalentsAtCarryingValue": {"units": {"USD": [cash_old, cash_new]}},
        "DebtSecuritiesAvailableForSaleCurrent": {"units": {"USD": [fallback]}}}}}
    early = sec.parse(facts, as_of="2025-05-31")
    assert early["quarters"]["2025-03-31"]["cash"] == 50
    assert "short_term_investments" not in early["quarters"]["2025-03-31"]
    late = sec.parse(facts, as_of="2025-06-01")
    assert late["quarters"]["2025-03-31"]["cash"] == 60
    assert late["quarters"]["2025-03-31"]["short_term_investments"] == 40
    assert [v["value"] for v in late["source_revisions"]["2025-03-31"]["cash"]] == [50, 60]


def test_sec_instant_tag_amendment_prefers_newer_filing_even_if_old_tag_remains():
    rev = _sec_fact("2025-01-01", "2025-03-31", 100, filed="2025-05-01")
    old = _sec_fact(None, "2025-03-31", 10, filed="2025-05-01")
    new = _sec_fact(None, "2025-03-31", 20, filed="2025-06-01")
    facts = {"facts": {"us-gaap": {
        "Revenues": {"units": {"USD": [rev]}},
        "MarketableSecuritiesCurrent": {"units": {"USD": [old]}},
        "DebtSecuritiesAvailableForSaleCurrent": {"units": {"USD": [new]}}}}}
    early = sec.parse(facts, as_of="2025-05-01")
    late = sec.parse(facts, as_of="2025-06-01")
    assert early["quarters"]["2025-03-31"]["short_term_investments"] == 10
    assert late["quarters"]["2025-03-31"]["short_term_investments"] == 20
    assert late["source_lineage"]["2025-03-31"]["short_term_investments"]["inputs"][0]["tag"] == "DebtSecuritiesAvailableForSaleCurrent"
    assert [r["value"] for r in late["source_revisions"]["2025-03-31"]["short_term_investments"]] == [10, 20]


def test_historical_collection_rejects_dart_without_archived_snapshot():
    from collect import TARGETS, run_one
    import pytest
    with pytest.raises(ValueError, match="archived filing snapshot"):
        run_one(TARGETS[1], as_of="2025-05-15")


def test_render_historical_cutoff_with_no_filing_does_not_crash():
    from collect import TARGETS, render, results_failed
    result = {**TARGETS[0], "quarters": {}, "metrics": {}, "methodology": methods.for_market("US"),
              "tags": {}, "checks": metrics.checks({}, {}, date(2025, 1, 1))}
    assert "데이터 존재 | 실패" in render([result])
    assert results_failed([result])


def test_sec_ytd_lineage_includes_both_input_filings():
    q1 = _sec_fact("2025-01-01", "2025-03-31", 10)
    q2 = _sec_fact("2025-01-01", "2025-06-30", 30)
    q1["accn"], q2["accn"] = "first", "second"
    parsed = sec.parse({"facts": {"us-gaap": {"NetCashProvidedByUsedInOperatingActivities":
                       {"units": {"USD": [q1, q2]}}, "Revenues": {"units": {"USD": [
                           _sec_fact("2025-04-01", "2025-06-30", 100)]}}}}})
    item = parsed["source_lineage"]["2025-06-30"]["operating_cash_flow"]
    assert parsed["quarters"]["2025-06-30"]["operating_cash_flow"] == 20
    assert item["operation"] == "subtract"
    assert [entry["accession"] for entry in item["inputs"]] == ["second", "first"]


def test_sec_noncurrent_debt_without_current_portion_is_unknown():
    facts = {"facts": {"us-gaap": {
        "Revenues": {"units": {"USD": [_sec_fact("2025-01-01", "2025-03-31", 100)]}},
        "LongTermDebtNoncurrent": {"units": {"USD": [_sec_fact(None, "2025-03-31", 20)]}},
    }}}
    assert "debt" not in sec.parse(facts)["quarters"]["2025-03-31"]
    facts["facts"]["us-gaap"]["LongTermDebtCurrent"] = {"units": {"USD": [_sec_fact(None, "2025-03-31", 0)]}}
    assert sec.parse(facts)["quarters"]["2025-03-31"]["debt"] == 20


def _row(sj, aid, nm, amt, add=None):
    return {"sj_div": sj, "account_id": aid, "account_nm": nm, "thstrm_amount": str(amt),
            "thstrm_add_amount": "" if add is None else str(add)}


def test_dart_parse_cumulative():
    def rep(code, rev_q, rev_cum, cf_cum):
        return {"year": 2025, "reprt_code": code, "rows": [
            _row("IS", "ifrs-full_Revenue", "매출액", rev_q, rev_cum),
            _row("CF", "ifrs-full_CashFlowsFromUsedInOperatingActivities", "영업활동 현금흐름", cf_cum),
            _row("CF", "ifrs-full_PurchaseOfPropertyPlantAndEquipment", "유형자산의 취득", -cf_cum / 2),
            _row("BS", "ifrs-full_Equity", "자본총계", 400),
            _row("BS", "-표준계정코드 미사용-", "단기차입금", 10),
            _row("BS", "ifrs-full_CashAndCashEquivalents", "현금및현금성자산", 50),
        ]}
    reports = [rep("11013", 79, 79, 20), rep("11012", 75, 154, 40), rep("11014", 86, 240, 65),
               {"year": 2025, "reprt_code": "11011", "rows": [
                   _row("IS", "ifrs-full_Revenue", "매출액", 333),
                   _row("CF", "ifrs-full_CashFlowsFromUsedInOperatingActivities", "영업활동 현금흐름", 90)]}]
    q = dart.parse(reports)["quarters"]
    assert q["2025-06-30"]["revenue"] == 75
    assert q["2025-12-31"]["revenue"] == 333 - 240
    assert q["2025-09-30"]["operating_cash_flow"] == 25
    assert q["2025-06-30"]["capex"] == 10          # |−20| − |−10|
    assert q["2025-03-31"]["debt"] == 10


def test_dart_cumulative_lineage_has_both_receipts_and_ppe_basis():
    q1 = _row("CF", "ifrs-full_PurchaseOfPropertyPlantAndEquipment", "유형자산의 취득", -10)
    q2 = _row("CF", "ifrs-full_PurchaseOfPropertyPlantAndEquipment", "유형자산의 취득", -25)
    q1["rcept_no"], q2["rcept_no"] = "receipt1", "receipt2"
    reports = [{"year": 2025, "reprt_code": "11013", "rows": [q1]},
               {"year": 2025, "reprt_code": "11012", "rows": [q2]}]
    parsed = dart.parse(reports)
    item = parsed["source_lineage"].get("2025-06-30", {}).get("capex")
    # A quarter without revenue is intentionally dropped from the output.
    assert item is None
    for rep in reports:
        rep["rows"].append(_row("IS", "ifrs-full_Revenue", "매출액", 100, 100))
    parsed = dart.parse(reports)
    item = parsed["source_lineage"]["2025-06-30"]["capex"]
    assert parsed["quarters"]["2025-06-30"]["capex"] == 15
    assert [entry["receipt"] for entry in item["inputs"]] == ["receipt2", "receipt1"]
    assert methods.for_market("KR")["version"] != methods.for_market("US")["version"]
    assert "PPE" in methods.for_market("KR")["capex_basis"]


def test_dart_filing_dates_match_receipts_and_paginate(monkeypatch):
    class Response:
        def __init__(self, body): self.body = body
        def raise_for_status(self): pass
        def json(self): return self.body
    pages = [Response({"status": "000", "total_page": 2, "list": [
        {"rcept_no": "20260928000001", "rcept_dt": "20260928"}]}),
             Response({"status": "000", "total_page": 2, "list": [
                 {"rcept_no": "20260928000002", "rcept_dt": "20260928"}]})]
    calls = []
    def get(url, params, timeout):
        calls.append((url, params["page_no"], params["bgn_de"]))
        return pages.pop(0)
    monkeypatch.setattr(dart.requests, "get", get)
    assert dart._filing_dates("00126380", 2023, {"20260928000002"}, "secret") == {"20260928000002": "20260928"}
    assert calls == [(dart.DISCLOSURES_URL, "1", "20260928"), (dart.DISCLOSURES_URL, "2", "20260928")]


def test_dart_debt_lineage_matches_deduplicated_value():
    revenue = _row("IS", "ifrs-full_Revenue", "매출액", 100, 100)
    debt = _row("BS", "x", "단기차입금", 5)
    parsed = dart.parse([{"year": 2025, "reprt_code": "11013", "rows": [revenue, debt, dict(debt)]}])
    assert parsed["quarters"]["2025-03-31"]["debt"] == 5
    inputs = parsed["source_lineage"]["2025-03-31"]["debt"]["inputs"]
    assert len(inputs) == 1 and sum(i["value"] for i in inputs) == 5


def test_lineage_gate_rejects_missing_receipt_date_or_hash():
    from collect import lineage_checks
    item = {"operation": "direct", "inputs": [{"receipt": "20250515001922", "filed": "20250515",
                                              "raw_sha256": "abc"}]}
    parsed = {"source_lineage": {"2025-03-31": {key: item for key in
              ("revenue", "operating_cash_flow", "capex")}}}
    assert lineage_checks(parsed, "KR", ["2025-03-31"])[0][1]
    del item["inputs"][0]["filed"]
    assert not lineage_checks(parsed, "KR", ["2025-03-31"])[0][1]


def test_dart_missing_or_nested_debt_does_not_create_false_zero_or_double_count():
    base = [_row("IS", "ifrs-full_Revenue", "매출액", 100, 100)]
    empty = dart.parse([{"year": 2025, "reprt_code": "11013", "rows": base}])["quarters"]["2025-03-31"]
    assert "debt" not in empty
    rows = base + [_row("BS", "x", "단기차입금", 5),
                   _row("BS", "x", "유동성장기부채", 10),
                   _row("BS", "x", "유동성장기차입금", 8),
                   _row("BS", "x", "유동성사채", 2),
                   _row("BS", "x", "장기차입금", 20)]
    nested = dart.parse([{"year": 2025, "reprt_code": "11013", "rows": rows}])["quarters"]["2025-03-31"]
    assert nested["debt"] == 35
    blank = base + [_row("BS", "x", "단기차입금", "-")]
    assert "debt" not in dart.parse([{"year": 2025, "reprt_code": "11013", "rows": blank}])["quarters"]["2025-03-31"]
    following = base + [_row("BS", "x", "단기차입금", 5)]
    reports = [{"year": 2025, "reprt_code": "11013", "rows": rows},
               {"year": 2025, "reprt_code": "11012", "rows": following}]
    assert "debt" not in dart.parse(reports)["quarters"]["2025-06-30"]


def test_metrics_and_checks():
    q = {}
    ends = ["2024-03-31", "2024-06-30", "2024-09-30", "2024-12-31", "2025-03-31", "2025-06-30", "2025-09-30", "2025-12-31"]
    for i, e in enumerate(ends):
        q[e] = {"revenue": 100 + 10 * i, "operating_income": 30 + 5 * i, "net_income": 25, "operating_cash_flow": 35,
                "capex": 5, "equity": 500 + 20 * i, "cash": 100, "short_term_investments": 0,
                "debt": 50, "gross_profit": 60 + 5 * i}
    m = metrics.compute(q, 0.21)
    assert round(m["fcf_margin"], 4) == round(120 / sum(100 + 10 * i for i in range(4, 8)), 4)
    assert m["roic"] and m["roic"] > 0
    assert all(p for _, p, _ in metrics.checks(q, m, date(2026, 3, 1)))




def test_quality_failure_fails_run():
    from collect import results_failed
    assert results_failed([{'checks': [('freshness', False, 'stale')]}])
    assert results_failed([{'error': 'network'}])
    assert results_failed([])
    assert not results_failed([{'checks': [('freshness', True, 'fresh')]}])


def test_ttm_rejects_missing_end_and_irregular_quarters():
    from quarters import ttm
    q = {'2025-03-31': 10, '2025-06-30': 20, '2025-09-30': 30, '2025-12-31': 40}
    assert ttm(q, '2025-12-31') == 100
    assert ttm(q, '2026-01-31') is None
    assert ttm({**q, '2025-10-31': 99}, '2025-12-31') is None
    assert ttm({**q, '2025-12-31': None}, '2025-12-31') is None


def test_missing_sbc_is_unknown_not_zero():
    q = {e: {'revenue': 100, 'operating_income': 20, 'net_income': 10,
             'operating_cash_flow': 30, 'capex': 5}
         for e in ['2025-03-31', '2025-06-30', '2025-09-30', '2025-12-31']}
    assert metrics.compute(q, .21)['owner_earnings'] is None
    for row in q.values(): row['sbc'] = 0
    assert metrics.compute(q, .21)['owner_earnings'] == 100


def test_missing_balance_sheet_fields_suppress_roic_and_net_debt():
    q = {e: {'revenue': 100, 'operating_income': 20, 'net_income': 10,
             'operating_cash_flow': 30, 'capex': 5, 'equity': 100, 'cash': 30,
             'short_term_investments': 10, 'debt': 20}
         for e in ['2024-12-31', '2025-03-31', '2025-06-30', '2025-09-30', '2025-12-31']}
    m = metrics.compute(q, .21)
    assert m['roic'] is not None and m['net_debt'] == -20
    del q['2025-12-31']['debt']
    m = metrics.compute(q, .21)
    assert m['roic'] is None and m['net_debt'] is None


def test_missing_latest_revenue_does_not_crash_growth():
    q = {e: {'revenue': 100} for e in ['2024-12-31', '2025-03-31', '2025-06-30', '2025-09-30', '2025-12-31']}
    q['2025-12-31'] = {}
    assert metrics.compute(q, .21)['revenue_yoy'] is None


def test_checks_reject_future_date_and_null_required():
    q = {'2026-12-31': {'revenue': None}}
    result = {name: passed for name, passed, _ in metrics.checks(q, {}, date(2026, 9, 28))}
    assert result['최신성'] is False
    assert result['필수 항목'] is False


def test_official_reference_rejects_changed_value_and_missing_period():
    expected = reconcile.REFERENCE['NVDA']
    result = {'ticker': 'NVDA', 'quarters': {expected['period_end']: dict(expected['values'])}}
    assert all(ok for _, ok, _ in reconcile.compare(result))
    result['quarters'][expected['period_end']]['operating_cash_flow'] += 1_000_000
    assert not all(ok for _, ok, _ in reconcile.compare(result))
    assert not reconcile.compare({'ticker': 'NVDA', 'quarters': {}})[0][1]


def test_reconcile_cli_rejects_mislabeled_artifact(tmp_path):
    import json
    import subprocess
    import sys
    script = reconcile.__file__
    for ticker, expected in reconcile.REFERENCE.items():
        (tmp_path / f'{ticker}.json').write_text(json.dumps({
            'ticker': 'NVDA', 'currency': expected['currency'],
            'quarters': {expected['period_end']: dict(expected['values'])}}), encoding='utf-8')
    result = subprocess.run([sys.executable, script, str(tmp_path)], capture_output=True, text=True)
    assert result.returncode == 1
    assert '005930: artifact identity' in result.stdout


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn()
            print("ok", name)
