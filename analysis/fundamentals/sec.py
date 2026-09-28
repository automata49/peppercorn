"""미국: SEC EDGAR XBRL companyfacts API 수집.

- 무료, 키 없음. 단 User-Agent 헤더에 연락처(이름 + 이메일)가 반드시 있어야 한다.
- 호출 한도: 초당 10회.
- 문서: https://www.sec.gov/search-filings/edgar-application-programming-interfaces
"""
from __future__ import annotations

import os

import requests

from quarters import derive_quarters, is_quarter

URL = "https://data.sec.gov/api/xbrl/companyfacts/CIK{cik:010d}.json"

# 기업마다 같은 항목을 다른 태그로 공시하므로 후보를 순서대로 둔다.
# 여러 후보가 있으면 '가장 최근 데이터가 있는 태그'를 쓴다.
DURATION_TAGS = {
    "revenue": ["Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax", "SalesRevenueNet"],
    "gross_profit": ["GrossProfit"],
    "operating_income": ["OperatingIncomeLoss"],
    "pretax_income": [
        "IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest",
        "IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments",
    ],
    "income_tax": ["IncomeTaxExpenseBenefit"],
    "net_income": ["NetIncomeLoss"],
    "rnd": ["ResearchAndDevelopmentExpense"],
    "operating_cash_flow": ["NetCashProvidedByUsedInOperatingActivities"],
    "capex": ["PaymentsToAcquirePropertyPlantAndEquipment", "PaymentsToAcquireProductiveAssets"],
    "sbc": ["ShareBasedCompensation", "AllocatedShareBasedCompensationExpense"],
    "diluted_shares": ["WeightedAverageNumberOfDilutedSharesOutstanding"],
}
INSTANT_TAGS = {
    "equity": ["StockholdersEquity"],
    "cash": ["CashAndCashEquivalentsAtCarryingValue"],
    "short_term_investments": ["AvailableForSaleSecuritiesDebtSecuritiesCurrent", "MarketableSecuritiesCurrent", "ShortTermInvestments"],
    "debt": ["LongTermDebt", "LongTermDebtNoncurrent"],
    "debt_current": ["LongTermDebtCurrent", "DebtCurrent"],
}
FORMS = {"10-Q", "10-K", "10-Q/A", "10-K/A"}


def fetch(cik: int) -> dict:
    ua = os.environ.get("SEC_USER_AGENT", "").strip()
    if "@" not in ua:
        raise SystemExit("SEC_USER_AGENT 가 필요합니다. 예: 'Peppercorn Capital your@email.com'")
    r = requests.get(URL.format(cik=cik), headers={"User-Agent": ua, "Accept-Encoding": "gzip"}, timeout=60)
    r.raise_for_status()
    return r.json()


def _entries(facts: dict, tag: str) -> list[dict]:
    node = facts.get("facts", {}).get("us-gaap", {}).get(tag)
    if not node:
        return []
    unit = next(iter(node["units"].values()))
    return [f for f in unit if f.get("form") in FORMS]


def _pick_tag(facts: dict, tags: list[str]) -> tuple[str | None, list[dict]]:
    best = (None, [])
    for t in tags:
        rows = _entries(facts, t)
        if rows and (not best[1] or max(r["end"] for r in rows) > max(r["end"] for r in best[1])):
            best = (t, rows)
    return best


def parse(facts: dict) -> dict:
    """→ {"quarters": {종료일: {항목: 값}}, "tags": {항목: 사용한 태그}}"""
    table: dict[str, dict[str, float]] = {}
    used: dict[str, str | None] = {}
    for field, tags in DURATION_TAGS.items():
        tag, rows = _pick_tag(facts, tags)
        used[field] = tag
        durations: dict[tuple[str, str], tuple[str, float]] = {}
        for r in rows:
            if "start" not in r:
                continue
            key = (r["start"], r["end"])
            # 정정 공시가 있으면 가장 늦게 제출된 값 사용
            if key not in durations or r["filed"] > durations[key][0]:
                durations[key] = (r["filed"], r["val"])
        vals = {k: v for k, (_, v) in durations.items()}
        if field == "diluted_shares":
            # 주식수는 합산값이 아니라 평균값이므로 빼기 계산을 하지 않는다
            q = {e: v for (s, e), v in vals.items() if is_quarter(s, e)}
        else:
            q = derive_quarters(vals)
        for end, v in q.items():
            table.setdefault(end, {})[field] = v
    for field, tags in INSTANT_TAGS.items():
        tag, rows = _pick_tag(facts, tags)
        used[field] = tag
        latest: dict[str, tuple[str, float]] = {}
        for r in rows:
            if "start" in r:
                continue
            if r["end"] not in latest or r["filed"] > latest[r["end"]][0]:
                latest[r["end"]] = (r["filed"], r["val"])
        for end, (_, v) in latest.items():
            if end in table:  # 손익 분기와 같은 날짜만
                table[end][field] = v
    # 매출이 있는 분기만 남긴다
    # LongTermDebt 는 유동성 부분까지 포함한 총액 → 유동성 부분을 또 더하면 이중 계산
    if used.get("debt") == "LongTermDebt":
        for v in table.values():
            v.pop("debt_current", None)
    table = {k: v for k, v in table.items() if "revenue" in v}
    return {"quarters": dict(sorted(table.items())), "tags": used, "entity": facts.get("entityName")}
