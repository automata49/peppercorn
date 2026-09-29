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


def _samsung_capex_reports(grants_line_in_fy2025=True):
    ppe = "ifrs-full_PurchaseOfPropertyPlantAndEquipment"

    def rep(year, code, revenue, cumulative, gross, grant=None):
        rows = [_row("IS", "ifrs-full_Revenue", "매출액", revenue, cumulative),
                _row("CF", ppe, "유형자산의 취득", -gross)]
        if grant is not None:
            rows.append(_row("CF", "-표준계정코드 미사용-", "정부보조금의 수취", grant))
        return {"year": year, "reprt_code": code, "rows": rows}

    return [rep(2025, "11013", 79_140_503, 79_140_503, 12_127_934),
            rep(2025, "11012", 74_566_317, 153_706_820, 25_163_382),
            rep(2025, "11014", 86_061_747, 239_768_567, 35_972_891),
            rep(2025, "11011", 333_605_938, None, 47_522_179, 1_722_357 if grants_line_in_fy2025 else None),
            rep(2026, "11013", 133_873_444, 133_873_444, 17_127_003, 1_586_919),
            rep(2026, "11012", 171_499_470, 305_372_914, 31_234_818, 1_592_914)]


def test_dart_capex_uses_one_net_basis_across_grant_line_presentation_change():
    parsed = dart.parse(_samsung_capex_reports())
    q = parsed["quarters"]
    # Filed net through nine months; the FY2025 report is gross plus a separate grants line.
    assert q["2025-09-30"]["capex"] == 35_972_891 - 25_163_382
    assert q["2025-12-31"]["capex"] == (47_522_179 - 1_722_357) - 35_972_891 == 9_826_931
    assert q["2026-03-31"]["capex"] == 17_127_003 - 1_586_919
    assert q["2026-06-30"]["capex"] == (31_234_818 - 1_592_914) - (17_127_003 - 1_586_919) == 14_101_820
    inputs = parsed["source_lineage"]["2025-12-31"]["capex"]["inputs"]
    fy = next(item for item in inputs if item["reprt_code"] == "11011")
    assert fy["gross_value"] == 47_522_179 and fy["government_grants"]["value"] == 1_722_357
    assert fy["value"] == 45_799_822
    assert "government_grants" not in next(item for item in inputs if item["reprt_code"] == "11014")


def test_dart_grant_line_without_amount_is_zero_and_absent_line_leaves_gross_unchanged():
    reports = _samsung_capex_reports()
    reports[3]["rows"][-1]["thstrm_amount"] = "-"
    assert dart.parse(reports)["quarters"]["2025-12-31"]["capex"] == 47_522_179 - 35_972_891
    assert dart.parse(_samsung_capex_reports(False))["quarters"]["2025-12-31"]["capex"] == 47_522_179 - 35_972_891


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


def _reference_quarters(ticker):
    return {p['period_end']: dict(p['values']) for p in reconcile.REFERENCE[ticker]['periods']}


def test_official_reference_rejects_changed_value_and_missing_period():
    period = reconcile.REFERENCE['NVDA']['periods'][0]['period_end']
    result = {'ticker': 'NVDA', 'quarters': _reference_quarters('NVDA')}
    assert all(ok for _, ok, _ in reconcile.compare(result))
    result['quarters'][period]['operating_cash_flow'] += 1_000_000
    assert not all(ok for _, ok, _ in reconcile.compare(result))
    result['quarters'].pop(period)
    assert any(name == f'공식 공시 {period}' and not ok for name, ok, _ in reconcile.compare(result))
    assert not reconcile.compare({'ticker': 'NVDA', 'quarters': {}})[0][1]


def test_official_reference_periods_are_ordered_and_complete():
    for ticker, expected in reconcile.REFERENCE.items():
        ends = [p['period_end'] for p in expected['periods']]
        assert ends == sorted(set(ends))
        for p in expected['periods']:
            assert p['filed'] is None or p['filed'] > p['period_end']
            assert p['values'] and p['source'] and p['urls']
            assert set(p['methods']) == set(p['values'])
            assert all(isinstance(v, int) and v > 0 for v in p['values'].values())
    assert len(reconcile.REFERENCE['NVDA']['periods']) >= 6
    assert len(reconcile.REFERENCE['005930']['periods']) >= 8
    for p in reconcile.REFERENCE['005930']['periods']:
        assert p['filed'] and p['receipts'] and all(r[:8] <= p['filed'].replace('-', '') for r in p['receipts'])


def test_official_reference_skips_quarters_not_yet_filed_at_as_of():
    periods = reconcile.REFERENCE['NVDA']['periods']
    only_first = {'ticker': 'NVDA', 'quarters': {periods[0]['period_end']: dict(periods[0]['values'])}}
    assert not all(ok for _, ok, _ in reconcile.compare(only_first))
    assert all(ok for _, ok, _ in reconcile.compare(only_first, as_of=periods[0]['filed']))
    assert reconcile.compare(only_first, as_of='2000-01-01') == []


def test_official_reference_with_unknown_filing_date_is_only_checked_without_as_of(monkeypatch):
    period = {'period_end': '2025-06-30', 'filed': None, 'values': {'revenue': 5}}
    monkeypatch.setattr(reconcile, 'REFERENCE', {'X': {'currency': 'KRW', 'periods': [period]}})
    result = {'ticker': 'X', 'quarters': {'2025-06-30': {'revenue': 6}}}
    assert not reconcile.compare(result)[0][1]
    assert reconcile.compare(result, as_of='2030-01-01') == []


def test_reconcile_cli_rejects_mislabeled_artifact(tmp_path):
    import json
    import subprocess
    import sys
    script = reconcile.__file__
    for ticker, expected in reconcile.REFERENCE.items():
        (tmp_path / f'{ticker}.json').write_text(json.dumps({
            'ticker': 'NVDA', 'currency': expected['currency'],
            'quarters': _reference_quarters(ticker)}), encoding='utf-8')
    result = subprocess.run([sys.executable, script, str(tmp_path)], capture_output=True, text=True)
    assert result.returncode == 1
    assert '005930: artifact identity' in result.stdout


def _acc(fact, accn):
    return {**fact, "accn": accn}


def test_sec_same_day_conflict_is_order_independent_and_recorded():
    first = _acc(_sec_fact("2025-01-01", "2025-03-31", 10, filed="2025-05-01"), "0000000001-25-000010")
    second = _acc(_sec_fact("2025-01-01", "2025-03-31", 12, form="10-Q/A", filed="2025-05-01"), "0000000001-25-000011")
    for rows in ([first, second], [second, first]):
        parsed = sec.parse({"facts": {"us-gaap": {"Revenues": {"units": {"USD": rows}}}}})
        assert parsed["quarters"]["2025-03-31"]["revenue"] == 12
        record = parsed["source_conflicts"]["2025-03-31"]["revenue"][0]
        assert record["selected"]["accession"] == "0000000001-25-000011"
        assert [c["value"] for c in record["competing"]] == [10]


def test_sec_same_day_agreeing_or_amended_later_is_not_a_conflict():
    same = [_acc(_sec_fact("2025-01-01", "2025-03-31", 10, filed="2025-05-01"), "a-1"),
            _acc(_sec_fact("2025-01-01", "2025-03-31", 10, filed="2025-05-01"), "a-2")]
    later = [_acc(_sec_fact("2025-01-01", "2025-03-31", 10, filed="2025-05-01"), "a-1"),
             _acc(_sec_fact("2025-01-01", "2025-03-31", 12, form="10-Q/A", filed="2025-06-01"), "a-2")]
    for rows in (same, later):
        parsed = sec.parse({"facts": {"us-gaap": {"Revenues": {"units": {"USD": rows}}}}})
        assert parsed["source_conflicts"] == {}
    # The competing same-day filing is invisible before its filing date.
    clash = [_acc(_sec_fact("2025-01-01", "2025-03-31", 10, filed="2025-05-01"), "a-1"),
             _acc(_sec_fact("2025-01-01", "2025-03-31", 12, filed="2025-06-01"), "a-2"),
             _acc(_sec_fact("2025-01-01", "2025-03-31", 13, filed="2025-06-01"), "a-3")]
    facts = {"facts": {"us-gaap": {"Revenues": {"units": {"USD": clash}}}}}
    assert sec.parse(facts, as_of="2025-05-31")["source_conflicts"] == {}
    assert sec.parse(facts, as_of="2025-06-01")["source_conflicts"]


def test_sec_same_day_instant_conflict_is_order_independent_and_recorded():
    rev = _sec_fact("2025-01-01", "2025-03-31", 100, filed="2025-05-01")
    cash = [_acc(_sec_fact(None, "2025-03-31", 50, filed="2025-06-01"), "b-1"),
            _acc(_sec_fact(None, "2025-03-31", 60, filed="2025-06-01"), "b-2")]
    for rows in (cash, cash[::-1]):
        parsed = sec.parse({"facts": {"us-gaap": {
            "Revenues": {"units": {"USD": [rev]}},
            "CashAndCashEquivalentsAtCarryingValue": {"units": {"USD": rows}}}}})
        assert parsed["quarters"]["2025-03-31"]["cash"] == 60
        assert parsed["source_conflicts"]["2025-03-31"]["cash"][0]["selected"]["accession"] == "b-2"


def test_conflict_check_fails_recent_periods_only():
    from collect import conflict_checks
    parsed = {"source_conflicts": {"2023-03-31": {"revenue": [{}]}, "2025-06-30": {"capex": [{}]}}}
    assert conflict_checks(parsed, ["2025-03-31", "2025-06-30"])[0][1] is False
    assert "2025-06-30/capex" in conflict_checks(parsed, ["2025-06-30"])[0][2]
    assert conflict_checks(parsed, ["2025-03-31"])[0][1] is True
    assert conflict_checks({}, ["2025-03-31"])[0][1] is True


def _roic_quarters(lease_by_end=None, pretax=None, tax=None):
    ends = ["2024-06-30", "2024-09-30", "2024-12-31", "2025-03-31", "2025-06-30", "2025-09-30"]
    q = {}
    for i, e in enumerate(ends):
        q[e] = {"revenue": 100, "operating_income": 40, "net_income": 30, "operating_cash_flow": 35, "capex": 5,
                "equity": 500 + 10 * i, "cash": 100, "short_term_investments": 0, "debt": 50}
        if pretax is not None:
            q[e]["pretax_income"], q[e]["income_tax"] = pretax, tax
        if lease_by_end and e in lease_by_end:
            q[e]["lease_liabilities"] = lease_by_end[e]
    return q


def test_statutory_tax_schedule_only_returns_reviewed_years():
    assert methods.statutory_tax_rate("US", 2026) == 0.21
    assert methods.statutory_tax_rate("KR", 2025) == 0.264
    assert methods.statutory_tax_rate("KR", 2026) == 0.275
    import pytest
    for market, year in (("US", 2017), ("KR", 2022), ("KR", 2023), ("KR", 2024), ("XX", 2026)):
        with pytest.raises(ValueError, match="reviewed statutory"):
            methods.statutory_tax_rate(market, year)


def test_roic_tax_uses_effective_rate_in_band_else_statutory_and_reports_source():
    method = methods.for_market("KR")["roic"]
    inside = metrics.compute(_roic_quarters(pretax=100, tax=20), 0.275, method)
    assert inside["tax_rate_used"] == 0.2 and inside["tax_rate_source"] == "effective"
    for pretax, tax in ((100, 60), (100, -5), (None, None)):
        outside = metrics.compute(_roic_quarters(pretax=pretax, tax=tax), 0.275, method)
        assert outside["tax_rate_used"] == 0.275 and outside["tax_rate_source"] == "statutory_fallback"


def test_kr_roic_adds_leases_only_when_presented_at_both_dates():
    method = methods.for_market("KR")["roic"]
    plain = metrics.compute(_roic_quarters(), 0.264, method)
    assert plain["roic_lease_basis"] == "excluded_not_presented" and plain["roic"]
    both = {"2024-09-30": 60, "2025-09-30": 80}
    included = metrics.compute(_roic_quarters(both), 0.264, method)
    assert included["roic_lease_basis"] == "included"
    assert included["roic_method"] == "KR-ROIC-1"
    assert 0 < included["roic"] < plain["roic"]        # leases enlarge invested capital
    one_date = metrics.compute(_roic_quarters({"2025-09-30": 80}), 0.264, method)
    assert one_date["roic_lease_basis"] == "inconsistent"
    assert one_date["roic"] is None and one_date["incremental_roic"] is None


def test_us_roic_never_adds_leases_and_declares_its_basis():
    method = methods.for_market("US")["roic"]
    q = _roic_quarters({"2024-09-30": 60, "2025-09-30": 80})
    result = metrics.compute(q, 0.21, method)
    assert result["roic_lease_basis"] == "excluded" and result["roic_method"] == "US-ROIC-2"
    assert result["roic"] == metrics.compute(_roic_quarters(), 0.21, method)["roic"]
    assert metrics.compute(_roic_quarters(), 0.21)["roic_method"] is None


def test_sec_equity_prefers_total_including_noncontrolling_interest():
    rev = _sec_fact("2025-01-01", "2025-03-31", 100, filed="2025-05-01")
    def parse(units):
        return sec.parse({"facts": {"us-gaap": {"Revenues": {"units": {"USD": [rev]}}, **units}}})
    both = parse({"StockholdersEquity": {"units": {"USD": [_sec_fact(None, "2025-03-31", 80, filed="2025-05-01")]}},
                  "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest": {"units": {"USD": [
                      _sec_fact(None, "2025-03-31", 95, filed="2025-05-01")]}}})
    assert both["quarters"]["2025-03-31"]["equity"] == 95
    only_parent = parse({"StockholdersEquity": {"units": {"USD": [_sec_fact(None, "2025-03-31", 80, filed="2025-05-01")]}}})
    assert only_parent["quarters"]["2025-03-31"]["equity"] == 80


def test_dart_lease_lines_need_both_halves_or_one_total():
    def reps(*lines):
        rows = [_row("IS", "ifrs-full_Revenue", "매출액", 100, 100)]
        rows += [_row("BS", aid, name, amount) for aid, name, amount in lines]
        return dart.parse([{"year": 2025, "reprt_code": "11013", "rows": rows}])["quarters"]["2025-03-31"]
    both = reps(("ifrs-full_CurrentLeaseLiabilities", "유동리스부채", 30), ("x", "비유동리스부채", 70))
    assert both["lease_liabilities"] == 100
    assert reps(("x", "리스부채", 120))["lease_liabilities"] == 120
    assert "lease_liabilities" not in reps(("ifrs-full_CurrentLeaseLiabilities", "유동리스부채", 30))
    assert "lease_liabilities" not in reps(("x", "리스부채", 5), ("y", "리스부채", 7))
    assert "lease_liabilities" not in reps(("x", "유동리스부채", "-"), ("y", "비유동리스부채", 7))
    assert "lease_liabilities" not in reps(("x", "기타유동부채", 9))


def test_kr_collection_requests_five_prior_years_and_reports_roic_basis(monkeypatch):
    import collect
    seen = {}
    ends = ["2025-03-31", "2025-06-30", "2025-09-30", "2025-12-31", "2026-03-31", "2026-06-30"]
    quarters = {e: {"revenue": 100, "operating_income": 40, "net_income": 30, "operating_cash_flow": 35, "capex": 5,
                    "equity": 500, "cash": 100, "short_term_investments": 0, "debt": 50} for e in ends}
    monkeypatch.setattr(collect.dart, "fetch", lambda corp, years: seen.setdefault("years", years))
    monkeypatch.setattr(collect.dart, "parse", lambda reports: {"quarters": quarters, "tags": {}})
    result = collect.run_one(collect.TARGETS[1])
    this_year = date.today().year
    assert seen["years"] == list(range(this_year - 5, this_year + 1))
    assert result["metrics"]["roic_method"] == "KR-ROIC-1"
    assert result["metrics"]["tax_rate_used"] == 0.275     # latest quarter is in 2026
    assert result["methodology"]["roic"]["lease_liabilities"] == "included_if_presented"
    assert "ROIC 기준: KR-ROIC-1" in collect.render([result])


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn()
            print("ok", name)


# --- SEC fallback tags and sustained non-presentation (US-ROIC-2)

_QENDS = ["2023-03-31", "2023-06-30", "2023-09-30", "2023-12-31", "2024-03-31", "2024-06-30", "2024-09-30", "2024-12-31"]
_QSTARTS = ["2023-01-01", "2023-04-01", "2023-07-01", "2023-10-01", "2024-01-01", "2024-04-01", "2024-07-01", "2024-10-01"]


def _revenue(tag="Revenues", val=100):
    return {tag: {"units": {"USD": [_sec_fact(s, e, val) for s, e in zip(_QSTARTS, _QENDS)]}}}


def test_sec_fallback_fills_only_spans_the_primary_tag_lacks():
    facts = {"facts": {"us-gaap": {
        **_revenue("Revenues", 100),
        "SalesRevenueGoodsNet": {"units": {"USD": [_sec_fact("2023-01-01", "2023-03-31", 60, filed="2026-01-01"),
                                                    _sec_fact("2022-10-01", "2022-12-31", 55)]}},
    }}}
    q = sec.parse(facts)["quarters"]
    assert q["2023-03-31"]["revenue"] == 100      # a later-filed narrower concept never replaces the primary
    assert q["2022-12-31"]["revenue"] == 55       # but fills a period the primary does not cover


def test_sec_instant_fallback_only_without_primary():
    facts = {"facts": {"us-gaap": {
        **_revenue(),
        "CashAndCashEquivalentsAtCarryingValue": {"units": {"USD": [_sec_fact(None, "2024-12-31", 10)]}},
        "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents": {"units": {"USD": [
            _sec_fact(None, "2024-12-31", 12, filed="2026-01-01"), _sec_fact(None, "2024-09-30", 11)]}},
    }}}
    q = sec.parse(facts)["quarters"]
    assert q["2024-12-31"]["cash"] == 10 and q["2024-09-30"]["cash"] == 11


def test_sec_total_debt_fallback_drops_current_portion():
    facts = {"facts": {"us-gaap": {
        **_revenue(),
        "LongTermDebtAndCapitalLeaseObligationsIncludingCurrentMaturities": {"units": {"USD": [_sec_fact(None, "2024-12-31", 50)]}},
        "LongTermDebtCurrent": {"units": {"USD": [_sec_fact(None, "2024-12-31", 5)]}},
    }}}
    row = sec.parse(facts)["quarters"]["2024-12-31"]
    assert row["debt"] == 50 and "debt_current" not in row


def test_sec_lines_absent_for_eight_quarters_are_not_presented():
    facts = {"facts": {"us-gaap": {**_revenue()}}}
    assert sec.parse(facts)["not_presented"] == ["short_term_investments", "debt", "debt_current"]


def test_sec_line_present_within_eight_quarters_is_not_zeroed():
    facts = {"facts": {"us-gaap": {
        **_revenue(),
        "ShortTermInvestments": {"units": {"USD": [_sec_fact(None, "2023-03-31", 7)]}},
        "LongTermDebtNoncurrent": {"units": {"USD": [_sec_fact(None, e, 20) for e in _QENDS]}},
        "LiabilitiesOtherThanLongtermDebtNoncurrent": {"units": {"USD": [_sec_fact(None, "2024-12-31", 3)]}},
    }}}
    parsed = sec.parse(facts)
    assert parsed["not_presented"] == ["debt_current"]
    assert parsed["quarters"]["2024-12-31"]["debt"] == 20     # noncurrent debt kept: no current portion for 8 quarters


def test_sec_short_history_never_counts_as_not_presented():
    facts = {"facts": {"us-gaap": {"Revenues": {"units": {"USD": [_sec_fact("2025-01-01", "2025-03-31", 100)]}}}}}
    assert sec.parse(facts)["not_presented"] == []


def test_metrics_zero_only_for_declared_not_presented_lines():
    q = {e: {"revenue": 100, "operating_income": 20, "pretax_income": 20, "income_tax": 4, "net_income": 16,
             "operating_cash_flow": 18, "capex": 2, "equity": 100, "debt": 10, "cash": 5} for e in _QENDS}
    method = methods.for_market("US")["roic"]
    assert metrics.compute(q, 0.21, method)["roic"] is None
    filled = metrics.compute(q, 0.21, method, ["short_term_investments"])
    assert filled["roic"] is not None and filled["roic_zero_not_presented"] == ["short_term_investments"]
    kr = metrics.compute(q, 0.264, methods.for_market("KR")["roic"], ["short_term_investments"])
    assert kr["roic"] is None     # KR declares no zero-if-not-presented lines
