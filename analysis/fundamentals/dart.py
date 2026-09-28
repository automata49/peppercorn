"""한국: OpenDART '단일회사 전체 재무제표' API 수집.

- 무료. https://opendart.fss.or.kr 에서 인증키(crtfc_key) 발급 필요.
- 분기/반기 보고서 금액은 연초부터의 누적값 → quarters.derive_quarters 로 3개월 값 계산.
- 12월 결산 법인을 가정한다(삼성전자 등 대부분 해당).
- 문서: https://opendart.fss.or.kr/guide/detail.do?apiGrpCd=DS003&apiId=2019020
"""
from __future__ import annotations

import os
import time
import hashlib

import requests

from quarters import derive_quarters_with_sources

URL = "https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json"
DISCLOSURES_URL = "https://opendart.fss.or.kr/api/list.json"
# 보고서 코드 → 누적 기간 종료일(월-일)
REPORTS = {"11013": "03-31", "11012": "06-30", "11014": "09-30", "11011": "12-31"}

# 손익·현금흐름: 표준 계정 ID 우선, 없으면 계정명으로 찾는다
FLOW = {
    "revenue": (["ifrs-full_Revenue"], ["매출액", "수익(매출액)", "영업수익"]),
    "gross_profit": (["ifrs-full_GrossProfit"], ["매출총이익"]),
    "operating_income": (["dart_OperatingIncomeLoss"], ["영업이익", "영업이익(손실)"]),
    "pretax_income": (["ifrs-full_ProfitLossBeforeTax"], ["법인세비용차감전순이익", "법인세비용차감전순이익(손실)"]),
    "income_tax": (["ifrs-full_IncomeTaxExpenseContinuingOperations"], ["법인세비용"]),
    "net_income": (["ifrs-full_ProfitLoss"], ["당기순이익", "당기순이익(손실)", "분기순이익", "반기순이익"]),
    "operating_cash_flow": (["ifrs-full_CashFlowsFromUsedInOperatingActivities"], ["영업활동현금흐름", "영업활동으로인한현금흐름"]),
    "capex": (["ifrs-full_PurchaseOfPropertyPlantAndEquipment"], ["유형자산의취득"]),
}
STOCK = {
    "equity": (["ifrs-full_Equity"], ["자본총계"]),
    "cash": (["ifrs-full_CashAndCashEquivalents"], ["현금및현금성자산"]),
    "short_term_investments": (["ifrs-full_ShortTermDepositsNotClassifiedAsCashEquivalents"], ["단기금융상품"]),
}
GRANT_NAME = "정부보조금의수취"
DEBT_NAMES = {"단기차입금", "유동성장기부채", "유동성장기차입금", "유동성사채", "사채", "장기차입금"}


def _num(s) -> float | None:
    if s in (None, "", "-"):
        return None
    try:
        return float(str(s).replace(",", ""))
    except ValueError:
        return None


def fetch(corp_code: str, years: list[int], fs_div: str = "CFS") -> list[dict]:
    key = os.environ.get("DART_API_KEY", "").strip()
    if not key:
        raise SystemExit("DART_API_KEY 가 필요합니다 (opendart.fss.or.kr 에서 무료 발급).")
    reports = []
    for y in years:
        annual: list[dict] = []
        for code in REPORTS:
            r = requests.get(URL, params={"crtfc_key": key, "corp_code": corp_code, "bsns_year": str(y),
                                          "reprt_code": code, "fs_div": fs_div}, timeout=60)
            r.raise_for_status()
            body = r.json()
            status = body.get("status")
            if status == "013":  # 조회된 데이터 없음 (아직 공시 전)
                continue
            if status != "000":
                raise SystemExit(f"DART 오류 {status}: {body.get('message')} (year={y}, report={code})")
            receipts = {row.get("rcept_no") for row in body["list"] if row.get("rcept_no")}
            annual.append({"year": y, "reprt_code": code, "fs_div": fs_div,
                            "rcp_no": next(iter(receipts)) if len(receipts) == 1 else None,
                            "raw_sha256": hashlib.sha256(r.content).hexdigest(), "rows": body["list"]})
            time.sleep(0.2)
        if annual:
            wanted = {rep["rcp_no"] for rep in annual if rep["rcp_no"]}
            dates = _filing_dates(corp_code, y, wanted, key) if wanted else {}
            for rep in annual:
                rep["rcept_dt"] = dates.get(rep["rcp_no"])
            reports.extend(annual)
    return reports


def _filing_dates(corp_code: str, year: int, receipts: set[str], key: str) -> dict[str, str]:
    """Resolve each receipt against its own submission date, including late amendments."""
    found: dict[str, str] = {}
    for receipt_date in sorted({r[:8] for r in receipts if len(r) == 14 and r[:8].isdigit()}):
        expected = {r for r in receipts if r.startswith(receipt_date)}
        page = 1
        while expected - found.keys():
            response = requests.get(DISCLOSURES_URL, params={"crtfc_key": key, "corp_code": corp_code,
                                    "bgn_de": receipt_date, "end_de": receipt_date,
                                    "pblntf_ty": "A", "last_reprt_at": "N",
                                    "page_count": "100", "page_no": str(page)}, timeout=60)
            response.raise_for_status()
            body = response.json()
            if body.get("status") == "013":
                break
            if body.get("status") != "000":
                raise SystemExit(f"DART 공시검색 오류 {body.get('status')} (year={year})")
            for row in body.get("list", []):
                if row.get("rcept_no") in expected:
                    found[row["rcept_no"]] = row["rcept_dt"]
            if page >= int(body.get("total_page", 1)):
                break
            page += 1
    return found


def _find(rows: list[dict], sj: tuple[str, ...], ids: list[str], names: list[str]) -> dict | None:
    cand = [r for r in rows if r.get("sj_div") in sj]
    for i in ids:
        for r in cand:
            if r.get("account_id") == i:
                return r
    norm = {n.replace(" ", "") for n in names}
    for r in cand:
        if (r.get("account_nm") or "").replace(" ", "") in norm:
            return r
    return None


def parse(reports: list[dict]) -> dict:
    durations: dict[str, dict[tuple[str, str], float]] = {f: {} for f in FLOW}
    duration_sources: dict[str, dict[tuple[str, str], dict]] = {f: {} for f in FLOW}
    lineage: dict[str, dict[str, dict]] = {}
    stock: dict[str, dict[str, float]] = {}
    debt_names_by_end: dict[str, set[str]] = {}
    for rep in reports:
        y, rows = rep["year"], rep["rows"]
        start, end = f"{y}-01-01", f"{y}-{REPORTS[rep['reprt_code']]}"
        for field, (ids, names) in FLOW.items():
            is_cf = field in ("operating_cash_flow", "capex")
            row = _find(rows, ("CF",) if is_cf else ("IS", "CIS"), ids, names)
            if not row:
                continue
            # 손익: 분기·반기 보고서는 thstrm_add_amount 가 누적값. 현금흐름: thstrm_amount 가 누적값
            val = _num(row.get("thstrm_add_amount")) if not is_cf else None
            if val is None:
                val = _num(row.get("thstrm_amount"))
            if val is None:
                continue
            grant = None
            if field == "capex":
                gross = abs(val)
                # From FY2025 Samsung reports grants received on a separate investing line while the
                # acquisition line turns gross; earlier reports netted them. Net both to one basis.
                grant = _find(rows, ("CF",), [], [GRANT_NAME])
                grant_amount = 0.0 if not grant else (_num(grant.get("thstrm_amount")) or 0.0)
                val = gross - grant_amount
            durations[field][(start, end)] = val
            source = _input(rep, row, val, start, end)
            if grant:
                source["gross_value"] = gross
                source["government_grants"] = _input(rep, grant, grant_amount, start, end)
            duration_sources[field][(start, end)] = source
        snap = stock.setdefault(end, {})
        for field, (ids, names) in STOCK.items():
            row = _find(rows, ("BS",), ids, names)
            if row and _num(row.get("thstrm_amount")) is not None:
                snap[field] = _num(row["thstrm_amount"])
                lineage.setdefault(end, {})[field] = {"operation": "direct", "inputs": [
                    _input(rep, row, snap[field], None, end)]}
        debt_rows = [r for r in rows if r.get("sj_div") == "BS"
                     and (r.get("account_nm") or "").replace(" ", "") in DEBT_NAMES]
        debt_by_name = {}
        debt_source_by_name = {}
        ambiguous = False
        for row in debt_rows:
            name = (row.get("account_nm") or "").replace(" ", "")
            amount = _num(row.get("thstrm_amount"))
            if amount is None:
                ambiguous = True
                continue
            if name in debt_by_name and debt_by_name[name] != amount:
                ambiguous = True
            debt_by_name[name] = amount
            debt_source_by_name[name] = row
        # The balance sheet's current portion already contains its loan/bond
        # breakdown. Do not add both the parent and its components.
        if "유동성장기부채" in debt_by_name:
            debt_by_name.pop("유동성장기차입금", None)
            debt_by_name.pop("유동성사채", None)
        debt_names_by_end[end] = set(debt_by_name)
        if debt_by_name and not ambiguous:
            snap["debt"] = sum(debt_by_name.values())
            lineage.setdefault(end, {})["debt"] = {"operation": "sum", "inputs": [
                _input(rep, debt_source_by_name[name], amount, None, end)
                for name, amount in debt_by_name.items()]}

    previous_names: set[str] = set()
    for end in sorted(stock):
        names = debt_names_by_end[end]
        # A line that disappears can be a tag/account migration; do not assume zero.
        if previous_names - names:
            stock[end].pop("debt", None)
            lineage.get(end, {}).pop("debt", None)
        if names:
            previous_names = names

    table: dict[str, dict[str, float]] = {}
    for field, d in durations.items():
        for end, item in derive_quarters_with_sources(d).items():
            table.setdefault(end, {})[field] = item["value"]
            lineage.setdefault(end, {})[field] = {"operation": "direct" if len(item["spans"]) == 1 else "subtract",
                                                    "inputs": [duration_sources[field][span] for span in item["spans"]]}
    for end, snap in stock.items():
        if end in table:
            table[end].update(snap)
    table = {k: v for k, v in table.items() if "revenue" in v}
    return {"quarters": dict(sorted(table.items())), "tags": {"source": "OpenDART fnlttSinglAcntAll (CFS)"},
            "source_lineage": {k: {field: origin for field, origin in lineage.get(k, {}).items() if field in table[k]}
                               for k in table},
            "raw_sha256": {f"{rep['year']}-{rep['reprt_code']}": rep.get("raw_sha256") for rep in reports}}


def _input(rep: dict, row: dict, value: float, start: str | None, end: str) -> dict:
    return {"start": start, "end": end, "value": value, "account_id": row.get("account_id"),
            "account_nm": row.get("account_nm"), "sj_div": row.get("sj_div"),
            "unit": row.get("currency") or "KRW", "fs_div": rep.get("fs_div", "CFS"),
            "year": rep["year"], "reprt_code": rep["reprt_code"],
            "receipt": row.get("rcept_no") or rep.get("rcp_no"), "filed": rep.get("rcept_dt"),
            "raw_sha256": rep.get("raw_sha256")}
