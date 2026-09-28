"""PoC: NVDA(SEC) + 삼성전자(DART) 재무 수집 → 지표 계산 → 검사 결과 출력.

실행:
  SEC_USER_AGENT="Peppercorn Capital you@email.com" DART_API_KEY=xxxx python collect.py --out out
결과:
  out/NVDA.json, out/005930.json, out/summary.md  (GitHub Actions 에서는 실행 요약 화면에도 표시)
Supabase 에는 아직 쓰지 않는다 (검증 단계).
"""
from __future__ import annotations

import argparse
import json
import os
from datetime import date, datetime, timezone
from pathlib import Path

import dart
import metrics
import methods
import reconcile
import sec

TARGETS = [
    {"ticker": "NVDA", "market": "US", "name": "NVIDIA", "source": "SEC", "cik": 1045810, "currency": "USD"},
    {"ticker": "005930", "market": "KR", "name": "삼성전자", "source": "DART", "corp_code": "00126380", "currency": "KRW"},
]


def money(v, cur):
    if v is None:
        return "–"
    return f"${v/1e9:,.1f}B" if cur == "USD" else f"{v/1e12:,.1f}조원"


def pct(v):
    return "–" if v is None else f"{v:.1%}"


def run_one(t: dict, as_of: str | None = None) -> dict:
    if t["source"] == "SEC":
        parsed = sec.parse(sec.fetch(t["cik"]), as_of=as_of)
    else:
        if as_of is not None:
            raise ValueError("DART historical as-of requires an archived filing snapshot")
        this_year = date.today().year
        parsed = dart.parse(dart.fetch(t["corp_code"], list(range(this_year - dart.HISTORY_YEARS, this_year + 1))))
    q = parsed["quarters"]
    method = methods.for_market(t["market"])
    if method["currency"] != t["currency"]:
        raise ValueError("Market and currency mismatch")
    year = date.fromisoformat(max(q)).year if q else date.today().year
    m = metrics.compute(q, methods.statutory_tax_rate(t["market"], year), method["roic"])
    check_results = metrics.checks(q, m, date.fromisoformat(as_of) if as_of else date.today())
    check_results.extend(lineage_checks(parsed, t["market"], sorted(q)[-8:]))
    check_results.extend(conflict_checks(parsed, sorted(q)[-8:]))
    check_results.extend(reconcile.compare({"ticker": t["ticker"], "quarters": q}, as_of=as_of))
    return {**t, "fetched_at": datetime.now(timezone.utc).isoformat(), "tags": parsed["tags"],
            "methodology": method, "source_lineage": parsed.get("source_lineage", {}),
            "raw_sha256": parsed.get("raw_sha256"), "source_revisions": parsed.get("source_revisions", {}),
            "source_conflicts": parsed.get("source_conflicts", {}),
            "as_of": as_of,
            "tag_by_period": parsed.get("tag_by_period", {}),
            "quarters": q, "metrics": m, "checks": check_results}


def lineage_checks(parsed: dict, market: str, periods: list[str]) -> list[tuple[str, bool, str]]:
    """Reject source facts whose filing identity or derivation inputs cannot be audited."""
    missing = []
    hashes = parsed.get("raw_sha256")
    for end in periods:
        for field in ("revenue", "operating_cash_flow", "capex"):
            origin = parsed.get("source_lineage", {}).get(end, {}).get(field)
            if not origin or not origin.get("inputs"):
                missing.append(f"{end}/{field}: inputs")
                continue
            for item in origin["inputs"]:
                identity = item.get("accession") if market == "US" else item.get("receipt")
                digest = hashes if market == "US" else item.get("raw_sha256")
                if not identity or not item.get("filed") or not digest:
                    missing.append(f"{end}/{field}: receipt/date/hash")
    return [("원천 공시 추적 (최근 8분기)", not missing,
             "완료" if not missing else f"누락 {len(missing)}건: {', '.join(missing[:3])}")]


def conflict_checks(parsed: dict, periods: list[str]) -> list[tuple[str, bool, str]]:
    """Same-day filings that disagree cannot be ordered reliably; fail rather than pick silently."""
    found = [f"{end}/{field}" for end in periods
             for field in parsed.get("source_conflicts", {}).get(end, {})]
    return [("동일자 공시 충돌 (최근 8분기)", not found,
             "없음" if not found else f"{len(found)}건: {', '.join(found[:3])}")]


def render(results: list[dict]) -> str:
    lines = ["# Pepper 재무 수집 PoC 결과", ""]
    for r in results:
        if "error" in r:
            lines += [f"## ❌ {r['ticker']} {r['name']} ({r['source']})", "", f"오류: `{r['error']}`", ""]
            continue
        ok = all(c[1] for c in r["checks"])
        m, cur = r["metrics"], r["currency"]
        last_row = r["quarters"].get(m.get("as_of"), {})
        lines += [f"## {'✅' if ok else '⚠️'} {r['ticker']} {r['name']} ({r['source']})", "",
                  "| 검사 | 결과 | 내용 |", "|---|---|---|"]
        lines += [f"| {n} | {'통과' if p else '실패'} | {d} |" for n, p, d in r["checks"]]
        method = r["methodology"]
        lines += ["", f"**지표 (TTM, 기준 {m.get('as_of')}; {method['version']})**", "",
                  f"FCF 기준: {method['capex_basis']}. 시장별 기준이며 원시 FCF 마진의 시장 간 순위 비교는 제공하지 않습니다.",
                  f"ROIC 기준: {m.get('roic_method') or '–'}; 리스 {m.get('roic_lease_basis') or '–'}; "
                  f"세율 {pct(m.get('tax_rate_used'))} ({m.get('tax_rate_source') or '–'}).",
                  "", "| 지표 | 값 |", "|---|---:|",
                  f"| 매출 | {money(m.get('ttm_revenue'), cur)} |",
                  f"| 영업이익 | {money(m.get('ttm_operating_income'), cur)} |",
                  f"| FCF (영업CF−{method['capex_field']}; {method['version']}) | {money(m.get('ttm_fcf'), cur)} |",
                  f"| FCF−SBC 추정치 | {money(m.get('owner_earnings'), cur)} |",
                  f"| 매출총이익률 | {pct(m.get('gross_margin'))} |",
                  f"| 영업이익률 | {pct(m.get('operating_margin'))} |",
                  f"| FCF 마진 | {pct(m.get('fcf_margin'))} |",
                  f"| ROIC | {pct(m.get('roic'))} |",
                  f"| 증분 ROIC | {pct(m.get('incremental_roic'))} |",
                  f"| ROE | {pct(m.get('roe'))} |",
                  f"| 순부채 (음수=순현금) | {money(m.get('net_debt'), cur)} |",
                  f"| └ 현금 | {money(last_row.get('cash'), cur)} |",
                  f"| └ 단기투자 | {money(last_row.get('short_term_investments'), cur)} |",
                  f"| └ 차입금 | {money(None if last_row.get('debt') is None else last_row['debt'] + last_row.get('debt_current', 0), cur)} |",
                  f"| └ 자본 | {money(last_row.get('equity'), cur)} |",
                  f"| 매출 YoY | {pct(m.get('revenue_yoy'))} |",
                  f"| 매출 3년 CAGR | {pct(m.get('revenue_cagr_3y'))} |",
                  f"| 순이익 3년 CAGR | {pct(m.get('net_income_cagr_3y'))} |",
                  f"| 희석 (주식수 YoY) | {pct(m.get('dilution_yoy'))} |", ""]
        recent = list(r["quarters"].items())[-6:]
        lines += ["**최근 분기 (3개월 값)**", "", "| 분기 종료 | 매출 | 영업이익 | 영업CF | CapEx |", "|---|---:|---:|---:|---:|"]
        lines += [f"| {k} | {money(v.get('revenue'), cur)} | {money(v.get('operating_income'), cur)} | "
                  f"{money(v.get('operating_cash_flow'), cur)} | {money(v.get('capex'), cur)} |" for k, v in recent]
        lines += ["", f"사용한 태그: `{json.dumps(r['tags'], ensure_ascii=False)}`", ""]
    return "\n".join(lines)


def results_failed(results: list[dict]) -> bool:
    """A successful job requires every target and quality check to pass."""
    return not results or any(
        "error" in r or not r.get("checks") or any(not passed for _, passed, _ in r["checks"])
        for r in results
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="out")
    ap.add_argument("--only", choices=["US", "KR"])
    ap.add_argument("--as-of", help="Historical filing cutoff YYYY-MM-DD (US only)")
    a = ap.parse_args()
    if a.as_of:
        sec.validate_as_of(a.as_of)
        if a.only != "US":
            ap.error("--as-of requires --only US; DART historical snapshots are not yet available")
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    results = []
    for t in TARGETS:
        if a.only and t["market"] != a.only:
            continue
        try:
            r = run_one(t, as_of=a.as_of)
        except SystemExit as e:
            r = {**t, "error": str(e)}
        except Exception as e:  # 네트워크·형식 오류도 결과에 남긴다 (API 키는 가림)
            msg = f"{type(e).__name__}: {e}"
            key = os.environ.get("DART_API_KEY", "")
            r = {**t, "error": msg.replace(key, "***") if key else msg}
        results.append(r)
        (out / f"{t['ticker']}.json").write_text(json.dumps(r, ensure_ascii=False, indent=2), encoding="utf-8")
    md = render(results)
    (out / "summary.md").write_text(md, encoding="utf-8")
    print(md)
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as f:
            f.write(md + "\n")
    if results_failed(results):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
