"""미국: SEC EDGAR XBRL companyfacts API 수집.

- 무료, 키 없음. 단 User-Agent 헤더에 연락처(이름 + 이메일)가 반드시 있어야 한다.
- 호출 한도: 초당 10회.
- 문서: https://www.sec.gov/search-filings/edgar-application-programming-interfaces
"""
from __future__ import annotations

import os
import re
import hashlib
from datetime import date

import requests

from quarters import derive_quarters_with_sources, is_quarter

URL = "https://data.sec.gov/api/xbrl/companyfacts/CIK{cik:010d}.json"

# 기업마다 같은 항목을 다른 태그로 공시하므로 후보를 순서대로 둔다.
# 같은 기간의 후보가 겹치면 공시일을 우선하고, 동률일 때 아래 태그 순서를 사용한다.
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
    body = r.json()
    body["_raw_sha256"] = hashlib.sha256(r.content).hexdigest()
    return body


def _entries(facts: dict, tag: str, unit: str = "USD", as_of: str | None = None) -> list[dict]:
    node = facts.get("facts", {}).get("us-gaap", {}).get(tag)
    if not node:
        return []
    return [f for f in node.get("units", {}).get(unit, [])
            if f.get("form") in FORMS and (as_of is None or (f.get("filed") and f["filed"] <= as_of))]


def _rank(row: dict) -> tuple[str, str]:
    """Amendment order: filing date, then accession (its yearly sequence breaks same-day ties)."""
    return (row.get("filed") or "", row.get("accn") or "")


def _same_day_conflicts(candidates: list[dict], chosen: dict) -> list[dict]:
    """Facts filed the same day under another accession with a different amount."""
    return [c for c in candidates
            if c["filed"] == chosen.get("filed") and c["accession"] != chosen.get("accn") and c["value"] != chosen["val"]]


def _latest_rows(facts: dict, tags: list[str], unit: str, as_of: str | None = None) -> dict[tuple[str, str], tuple[str, dict]]:
    """Select latest amendment for each span, retaining historical tag changes."""
    selected = {}
    for tag in tags:
        for row in _entries(facts, tag, unit, as_of):
            if "start" not in row:
                continue
            span = (row["start"], row["end"])
            prior = selected.get(span)
            if prior is None or _rank(row) > _rank(prior[1]):
                selected[span] = (tag, row)
    return selected


def validate_as_of(as_of: str) -> None:
    """Only canonical dates compare safely against SEC's YYYY-MM-DD filed dates."""
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", as_of):
        raise ValueError("as_of must be YYYY-MM-DD")
    date.fromisoformat(as_of)


def parse(facts: dict, as_of: str | None = None) -> dict:
    """→ {"quarters": {종료일: {항목: 값}}, "tags": {항목: 사용한 태그}}"""
    if as_of is not None:
        validate_as_of(as_of)
    table: dict[str, dict[str, float]] = {}
    used: dict[str, str | None] = {}
    tag_by_period: dict[str, dict[str, str]] = {}
    lineage: dict[str, dict[str, dict]] = {}
    revisions: dict[str, dict[str, list[dict]]] = {}
    conflicts: dict[str, dict[str, list[dict]]] = {}
    for field, tags in DURATION_TAGS.items():
        unit = "shares" if field == "diluted_shares" else "USD"
        selected = _latest_rows(facts, tags, unit, as_of)
        by_span: dict[tuple[str, str], list[dict]] = {}
        for tag in tags:
            for row in _entries(facts, tag, unit, as_of):
                if row.get("start"):
                    by_span.setdefault((row["start"], row["end"]), []).append({
                        "start": row["start"], "end": row["end"], "tag": tag, "unit": unit,
                        "value": row["val"], "filed": row.get("filed"), "accession": row.get("accn"),
                        "form": row.get("form")})
        vals = {span: row["val"] for span, (_, row) in selected.items()}
        if field == "diluted_shares":
            # 주식수는 합산값이 아니라 평균값이므로 빼기 계산을 하지 않는다
            derived = {e: {"value": v, "spans": [(s, e)]} for (s, e), v in vals.items() if is_quarter(s, e)}
        else:
            derived = derive_quarters_with_sources(vals)
        q = {end: item["value"] for end, item in derived.items()}
        for end, v in q.items():
            table.setdefault(end, {})[field] = v
            lineage.setdefault(end, {})[field] = {
                "operation": "direct" if len(derived[end]["spans"]) == 1 else "subtract",
                "inputs": [{"start": span[0], "end": span[1], "tag": selected[span][0],
                            "unit": "shares" if field == "diluted_shares" else "USD",
                            "value": selected[span][1]["val"], "form": selected[span][1].get("form"),
                            "filed": selected[span][1].get("filed"), "accession": selected[span][1].get("accn")}
                           for span in derived[end]["spans"]],
            }
            revisions.setdefault(end, {})[field] = [item for span in derived[end]["spans"]
                                                      for item in by_span.get(span, [])]
            revisions[end][field].sort(key=lambda item: (item["start"], item["end"], item["filed"] or "", item["accession"] or ""))
            for span in derived[end]["spans"]:
                clash = _same_day_conflicts(by_span.get(span, []), selected[span][1])
                if clash:
                    conflicts.setdefault(end, {}).setdefault(field, []).append(
                        _conflict_record(selected[span][1], clash))
            # tag_by_period is a display hint; lineage contains every chosen input.
            matching = [(tag, row) for (_, e), (tag, row) in selected.items() if e == end]
            if matching:
                tag_by_period.setdefault(end, {})[field] = max(matching, key=lambda hit: hit[1].get("filed", ""))[0]
        recent = max(q) if q else None
        used[field] = tag_by_period.get(recent, {}).get(field) if recent else None
    # 재무상태표 항목: 날짜마다 후보 태그를 순서대로 확인 (회사가 중간에 태그를 바꿔도 이어지도록)
    all_tags = facts.get("facts", {}).get("us-gaap", {})
    for field, tags in INSTANT_TAGS.items():
        per_tag: dict[str, dict[str, dict]] = {}
        for t in tags:
            latest: dict[str, dict] = {}
            for r in _entries(facts, t, as_of=as_of):
                if "start" in r:
                    continue
                if r["end"] not in latest or _rank(r) > _rank(latest[r["end"]]):
                    latest[r["end"]] = r
            per_tag[t] = latest
        hits: dict[str, str] = {}
        for end, row in table.items():
            candidates = [(t, per_tag[t][end], i) for i, t in enumerate(tags) if end in per_tag[t]]
            if candidates:
                t, fact, _ = max(candidates, key=lambda item: (*_rank(item[1]), -item[2]))
                row[field] = fact["val"]
                lineage.setdefault(end, {})[field] = _instant_lineage(t, fact)
                revisions.setdefault(end, {})[field] = _instant_revisions(facts, tags, end, as_of)
                clash = _same_day_conflicts(revisions[end][field], fact)
                if clash:
                    conflicts.setdefault(end, {}).setdefault(field, []).append(_conflict_record(fact, clash))
                hits[end] = t
        rev_ends = [e for e, r in table.items() if "revenue" in r]
        latest_end = max(rev_ends) if rev_ends else None
        # Discover company-specific current investment tags, including tag changes
        # for a period that was also reported under an older canonical tag.
        if field == "short_term_investments" and latest_end:
            pat = re.compile(r"(MarketableSecurities|ShortTermInvestments|AvailableForSale\w*|DebtSecurities\w*)Current$")
            for t in sorted(all_tags):
                if t in tags or not pat.search(t):
                    continue
                vals = {}
                for r in _entries(facts, t, as_of=as_of):
                    if "start" not in r and (r["end"] not in vals or r.get("filed", "") > vals[r["end"]].get("filed", "")):
                        vals[r["end"]] = r
                if latest_end in vals:
                    for end, row in table.items():
                        current = lineage.get(end, {}).get(field, {}).get("inputs", [{}])[0]
                        if end in vals and (end not in hits or vals[end].get("filed", "") > (current.get("filed") or "")):
                            row[field] = vals[end]["val"]
                            lineage.setdefault(end, {})[field] = _instant_lineage(t, vals[end])
                            fallback_revisions = _instant_revisions(facts, [t], end, as_of)
                            previous = revisions.setdefault(end, {}).get(field, [])
                            revisions[end][field] = sorted(previous + fallback_revisions,
                                                           key=lambda item: (item["filed"] or "", item["accession"] or ""))
                            hits[end] = t
        used[field] = hits.get(latest_end) if latest_end else None
        for end, tag in hits.items():
            tag_by_period.setdefault(end, {})[field] = tag
        if field == "debt":
            # LongTermDebt 는 유동성 부분까지 포함한 총액 → 유동성 부분을 또 더하면 이중 계산
            for end, t in hits.items():
                if t == "LongTermDebt":
                    table[end]["_debt_total"] = True
    for row in table.values():
        if row.pop("_debt_total", False):
            row.pop("debt_current", None)
    # A noncurrent-only debt tag does not establish that the current portion is zero.
    for end, row in table.items():
        if tag_by_period.get(end, {}).get("debt") == "LongTermDebtNoncurrent" and row.get("debt_current") is None:
            row.pop("debt", None)
        for field in list(lineage.get(end, {})):
            if field not in row:
                lineage[end].pop(field)
                revisions.get(end, {}).pop(field, None)
                conflicts.get(end, {}).pop(field, None)
    table = {k: v for k, v in table.items() if "revenue" in v}
    return {"quarters": dict(sorted(table.items())), "tags": used, "tag_by_period": tag_by_period,
            "entity": facts.get("entityName"), "source_lineage": {k: lineage[k] for k in table},
            "source_revisions": {k: revisions.get(k, {}) for k in table},
            "source_conflicts": {k: conflicts[k] for k in table if conflicts.get(k)}, "as_of": as_of,
            "raw_sha256": facts.get("_raw_sha256")}


def _conflict_record(chosen: dict, competing: list[dict]) -> dict:
    return {"selected": {"accession": chosen.get("accn"), "filed": chosen.get("filed"), "value": chosen["val"]},
            "competing": [{"accession": c["accession"], "filed": c["filed"], "value": c["value"], "tag": c["tag"]}
                          for c in competing]}


def _instant_lineage(tag: str, row: dict) -> dict:
    return {"operation": "direct", "inputs": [{"end": row["end"], "tag": tag,
            "unit": "USD", "value": row["val"], "form": row.get("form"),
            "filed": row.get("filed"), "accession": row.get("accn")}]}


def _instant_revisions(facts: dict, tags: list[str], end: str, as_of: str | None) -> list[dict]:
    return sorted((
        {"end": end, "tag": tag, "unit": "USD", "value": row["val"],
         "filed": row.get("filed"), "accession": row.get("accn"), "form": row.get("form")}
        for tag in tags for row in _entries(facts, tag, as_of=as_of)
        if "start" not in row and row.get("end") == end
    ), key=lambda item: (item["filed"] or "", item["accession"] or ""))
