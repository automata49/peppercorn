"""오프라인 테스트: 네트워크 없이 누적→분기 변환과 파싱 로직을 검증한다.
실행: python -m pytest -q  (또는 python test_fundamentals.py)
"""
from datetime import date

import dart
import metrics
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


def test_metrics_and_checks():
    q = {}
    ends = ["2024-03-31", "2024-06-30", "2024-09-30", "2024-12-31", "2025-03-31", "2025-06-30", "2025-09-30", "2025-12-31"]
    for i, e in enumerate(ends):
        q[e] = {"revenue": 100 + 10 * i, "operating_income": 30 + 5 * i, "net_income": 25, "operating_cash_flow": 35,
                "capex": 5, "equity": 500 + 20 * i, "cash": 100, "debt": 50, "gross_profit": 60 + 5 * i}
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


def test_missing_latest_revenue_does_not_crash_growth():
    q = {e: {'revenue': 100} for e in ['2024-12-31', '2025-03-31', '2025-06-30', '2025-09-30', '2025-12-31']}
    q['2025-12-31'] = {}
    assert metrics.compute(q, .21)['revenue_yoy'] is None


def test_checks_reject_future_date_and_null_required():
    q = {'2026-12-31': {'revenue': None}}
    result = {name: passed for name, passed, _ in metrics.checks(q, {}, date(2026, 9, 28))}
    assert result['최신성'] is False
    assert result['필수 항목'] is False


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn()
            print("ok", name)
