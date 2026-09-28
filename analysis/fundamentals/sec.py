"""미국: SEC EDGAR XBRL companyfacts API 수집.

- 무료, 키 없음. 단 User-Agent 헤더에 연락처(이름 + 이메일)가 반드시 있어야 한다.
- 호출 한도: 초당 10회.
- 문서: https://www.sec.gov/search-filings/edgar-application-programming-interfaces
"""
from __future__ import annotations

import os
import re

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
    "short_term_investments": ["MarketableSecuritiesCurrent", "AvailableForSaleSecuritiesDebtSecuritiesCurrent", "ShortTermInvestments", "OtherShortTermInvestments"],
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
    # 재무상태표 항목: 날짜마다 후보 태그를 순서대로 확인 (회사가 중간에 태그를 바꿔도 이어지도록)
    all_tags = facts.get("facts", {}).get("us-gaap", {})
    for field, tags in INSTANT_TAGS.items():
        per_tag: dict[str, dict[str, float]] = {}
        for t in tags:
            latest: dict[str, tuple[str, float]] = {}
            for r in _entries(facts, t):
                if "start" in r:
                    continue
                if r["end"] not in latest or r["filed"] > latest[r["end"]][0]:
                    latest[r["end"]] = (r["filed"], r["val"])
            per_tag[t] = {e: v for e, (_, v) in latest.items()}
        hits: dict[str, str] = {}
        for end, row in table.items():
            for t in tags:
                if end in per_tag[t]:
                    row[field] = per_tag[t][end]
                    hits[end] = t
                    break
        rev_ends = [e for e, r in table.items() if "revenue" in r]
        latest_end = max(rev_ends) if rev_ends else None
        # 최신 분기에 값이 없으면 비슷한 이름의 태그를 자동 탐색 (단기투자만)
        if field == "short_term_investments" and latest_end and latest_end not in hits:
            pat = re.compile(r"(MarketableSecurities|ShortTermInvestments|AvailableForSale\w*|DebtSecurities\w*)Current$")
            for t in sorted(all_tags):
                if t in tags or not pat.search(t):
                    continue
                vals = {r["end"]: r["val"] for r in _entries(facts, t) if "start" not in r}
                if latest_end in vals:
                    for end, row in table.items():
                        if end not in hits and end in vals:
                            row[field] = vals[end]
                            hits[end] = t
                    break
        used[field] = hits.get(latest_end) if latest_end else None
        if field == "debt":
            # LongTermDebt 는 유동성 부분까지 포함한 총액 → 유동성 부분을 또 더하면 이중 계산
            for end, t in hits.items():
                if t == "LongTermDebt":
                    table[end]["_debt_total"] = True
    for row in table.values():
        if row.pop("_debt_total", False):
            row.pop("debt_current", None)
    table = {k: v for k, v in table.items() if "revenue" in v}
    return {"quarters": dict(sorted(table.items())), "tags": used, "entity": facts.get("entityName")}
