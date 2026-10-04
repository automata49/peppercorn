"""LEADERSHIP-DIAG-1: read-only diagnosis of the current 주도 종목 classification (step 1, by user request 2026-10-03).

  SEC_USER_AGENT=... DART_API_KEY=... python analysis/leadership_report.py

It changes nothing. It reads the public leaderboard, filed revenue/net income (SEC XBRL frames for US, OpenDART
multi-company accounts for KR) and Yahoo daily closes for the leaders, then reports:
  1. class counts, 2. sector mix of leaders vs the universe, 3. an industry-group rank preview (median RS rank),
  4. where semiconductors stand and which 핵심 주도 condition each fails, 5. the condition funnel,
  6. leaders without revenue / loss-making / shrinking revenue (unknown kept apart from zero),
  7. leaders whose 3-month gain came mostly from one day.
The conditions mirror recalculate_market_leadership() (supabase/migrations/*_kr_benchmark_kospi.sql).
"""
from __future__ import annotations

import datetime
import json
import math
import os
import statistics
import sys
import time
from pathlib import Path

LEADERBOARD_URL = "https://mhbcchegrbakearqptdr.supabase.co/functions/v1/leaderboard"
LEAD = ("핵심 주도", "주도 후보")
CLASSES = ("핵심 주도", "주도 후보", "강세 전환", "조정 중")
WATCH = {"US": ["NVDA", "AVGO", "AMD", "MU", "TSM", "ASML", "LRCX", "AMAT", "KLAC", "MRVL", "QCOM", "TXN", "ADI", "ARM", "INTC"],
         "KR": ["005930", "000660", "042700", "403870", "058470"]}
REVENUE_TAGS = ("Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax",
                "RevenueFromContractWithCustomerIncludingAssessedTax", "SalesRevenueNet")
# 매출 미미: latest annual revenue under these amounts (listing currency).
TINY_REVENUE = {"US": 10e6, "KR": 10e9}
GAP_MIN_DAY, GAP_MIN_SHARE = .15, .5


def num(v):
    try:
        f = float(v)
        return f if math.isfinite(f) else None
    except (TypeError, ValueError):
        return None


def conditions(r: dict) -> dict:
    """The four 핵심 주도 conditions; None when an input is missing (never counted as a pass)."""
    p, m50, m200, hd, rk, r3, r6 = (num(r.get(k)) for k in ("price", "ma50", "ma200", "high_52w_distance", "rs_rank", "rs_3m", "rs_6m"))
    return {
        "정배열": None if None in (p, m50, m200) else (p > m50 and m50 > m200),
        "고점 -15% 이내": None if hd is None else hd >= -.15,
        "RS순위 ≥95": None if rk is None else rk >= 95,
        "RS 3M·6M > 0": None if None in (r3, r6) else (r3 > 0 and r6 > 0),
    }


def funnel(rows: list[dict]) -> list[tuple[str, int]]:
    """Cumulative pass counts in condition order."""
    out, alive = [("전체", len(rows))], list(rows)
    for name in ("정배열", "고점 -15% 이내", "RS순위 ≥95", "RS 3M·6M > 0"):
        alive = [r for r in alive if conditions(r)[name] is True]
        out.append((name, len(alive)))
    return out


def sector_mix(rows: list[dict]) -> list[dict]:
    """Per sector: universe count/share, leader count/share and the ratio of the two shares."""
    total, leaders = len(rows), [r for r in rows if r.get("leadership_class") in LEAD]
    out = []
    for s in sorted({r.get("sector") or "분류 없음" for r in rows}):
        n = sum(1 for r in rows if (r.get("sector") or "분류 없음") == s)
        k = sum(1 for r in leaders if (r.get("sector") or "분류 없음") == s)
        us, ls = n / total if total else 0, k / len(leaders) if leaders else 0
        out.append({"sector": s, "n": n, "share": us, "leaders": k, "leader_share": ls, "ratio": ls / us if us else None})
    return sorted(out, key=lambda x: -x["leaders"])


def industry_rank(rows: list[dict], min_n: int = 5, top: float = .4) -> dict:
    """IBD-style group rank preview: industries with ≥min_n members ranked by median RS rank."""
    groups: dict[str, list[dict]] = {}
    for r in rows:
        if r.get("industry"):
            groups.setdefault(r["industry"], []).append(r)
    ranked = []
    for name, members in groups.items():
        ranks = [num(m.get("rs_rank")) for m in members if num(m.get("rs_rank")) is not None]
        if len(members) >= min_n and ranks:
            ranked.append({"industry": name, "n": len(members), "median_rs_rank": statistics.median(ranks),
                           "leaders": sum(1 for m in members if m.get("leadership_class") in LEAD)})
    ranked.sort(key=lambda x: -x["median_rs_rank"])
    for i, g in enumerate(ranked, 1):
        g["rank"] = i
    cut = math.ceil(len(ranked) * top)
    top_names = {g["industry"] for g in ranked[:cut]}
    leaders = [r for r in rows if r.get("leadership_class") in LEAD]
    ranked_leaders = [r for r in leaders if r.get("industry") in {g["industry"] for g in ranked}]
    return {"groups": ranked, "top_cut": cut,
            "leaders_in_top": sum(1 for r in ranked_leaders if r.get("industry") in top_names),
            "leaders_ranked": len(ranked_leaders), "leaders_unranked": len(leaders) - len(ranked_leaders)}


def is_semi(r: dict) -> bool:
    text = f"{r.get('industry') or ''} {r.get('sector') or ''}".lower()
    return "semiconductor" in text or "반도체" in text


def single_day(closes: list[float], window: int = 63) -> dict | None:
    """Largest one-day gain over the last `window` sessions and its share of the window's log gain."""
    c = [x for x in closes if x and x > 0]
    if len(c) < window + 1:
        return None
    c = c[-(window + 1):]
    days = [c[i] / c[i - 1] - 1 for i in range(1, len(c))]
    top = max(days)
    total = math.log(c[-1] / c[0])
    share = math.log(1 + top) / total if total > 0 and top > 0 else None
    return {"top_day": top, "window_return": c[-1] / c[0] - 1, "share": share,
            "flag": bool(share is not None and top >= GAP_MIN_DAY and share >= GAP_MIN_SHARE)}


def fundamental_flags(market: str, f: dict | None) -> dict:
    """Flags from filed values; a missing value stays unknown, never zero."""
    # Files annual results without any revenue line AND loses money: a pre-revenue company (clinical biotech, explorer).
    # A profitable filer without a matched revenue tag (banks, shipping, IFRS extensions) is a tag miss, not "no revenue".
    if f and f.get("revenue") is None and f.get("files_without_revenue") and (f.get("net_income") or 0) < 0:
        return {"status": "known", "no_revenue": True, "no_revenue_filed": True, "loss": None if f.get("net_income") is None else f["net_income"] < 0,
                "shrinking": None, "revenue": None, "revenue_growth": None, "net_income": f.get("net_income")}
    if not f or f.get("revenue") is None:
        return {"status": "unknown", "no_revenue": None, "loss": None if not f or f.get("net_income") is None else f["net_income"] < 0, "shrinking": None}
    rev, ni, prev = f.get("revenue"), f.get("net_income"), f.get("revenue_prev")
    growth = f.get("revenue_growth")
    if growth is None and prev not in (None, 0) and rev is not None:
        growth = rev / prev - 1
    return {"status": "known", "no_revenue": rev < TINY_REVENUE[market], "loss": None if ni is None else ni < 0,
            "shrinking": None if growth is None else growth < 0, "revenue": rev, "revenue_growth": growth, "net_income": ni}


def ratio(x):
    return "—" if x is None else f"{x:.1f}배"


def pct(x, d=0):
    return "—" if x is None else f"{x * 100:.{d}f}%"


def fmt_n(x):
    return "—" if x is None else f"{x:,.0f}"


def markdown(rep: dict) -> str:
    L = ["# 주도 종목 진단 (LEADERSHIP-DIAG-1)", "", f"기준: 공개 leaderboard {rep['as_of']} · 주식만 · 읽기 전용", ""]
    for m in ("US", "KR"):
        x = rep["markets"].get(m)
        if not x:
            continue
        L += [f"## {m}", "", "### 1. 분류 개요", "", "| 분류 | 종목 수 |", "|---|---:|"]
        L += [f"| {k} | {v} |" for k, v in x["classes"].items()]
        L += ["", "### 2. 섹터 분포 (핵심 주도+주도 후보 vs 유니버스)", "", "| 섹터 | 유니버스 | 비중 | 주도 | 주도 비중 | 배율 |", "|---|---:|---:|---:|---:|---:|"]
        L += [f"| {s['sector']} | {s['n']} | {pct(s['share'])} | {s['leaders']} | {pct(s['leader_share'])} | {ratio(s['ratio'])} |" for s in x["sectors"] if s["n"] >= 5 or s["leaders"]]
        ir = x["industry_rank"]
        L += ["", "### 3. 산업 그룹 순위 미리보기 (5종목 이상, RS순위 중앙값)", "",
              f"상위 40%({ir['top_cut']}개 산업)에 속한 주도 종목: {ir['leaders_in_top']} / {ir['leaders_ranked']} (5종목 미만 산업 소속 {ir['leaders_unranked']})", "",
              "| 순위 | 산업 | 종목 수 | RS순위 중앙값 | 주도 |", "|---:|---|---:|---:|---:|"]
        L += [f"| {g['rank']} | {g['industry']} | {g['n']} | {g['median_rs_rank']:.0f} | {g['leaders']} |" for g in ir["groups"][:15]]
        sm = x["semis"]
        L += ["", "### 4. 반도체 위치", "", f"반도체 종목 {sm['n']}개 · 주도 {sm['leaders']}개 · RS순위 중앙값 {sm['median_rs_rank']}", "",
              "| 조건 | 반도체 통과 |", "|---|---:|"]
        L += [f"| {k} | {v} / {sm['n']} |" for k, v in sm["pass"].items()]
        L += ["", "| 종목 | 분류 | RS순위 | IBD식 | 고점 대비 | 3M 수익률 | 12M 수익률 | 못 넘은 핵심 주도 조건 |", "|---|---|---:|---:|---:|---:|---:|---|"]
        L += [f"| {w['ticker']} {w['name']} | {w['class']} | {fmt_n(w['rs_rank'])} | {fmt_n(w['ibd'])} | {pct(w['high_dist'])} | {pct(w['ret_3m'])} | {pct(w['ret_12m'])} | {w['fails'] or '없음'} |" for w in sm["watch"]]
        L += ["", f"참고: RS순위 ≥95 종목의 3M 수익률 중앙값 {pct(x['rs95']['ret_3m'])}, 12M {pct(x['rs95']['ret_12m'])} (반도체 중앙값 3M {pct(sm['ret_3m'])}, 12M {pct(sm['ret_12m'])})"]
        L += ["", "### 5. 핵심 주도 조건 퍼널 (누적 통과)", "", "| 조건 | 남은 종목 |", "|---|---:|"]
        L += [f"| {k} | {v} |" for k, v in x["funnel"]]
        fd = x["fundamentals"]
        L += ["", "### 6. 주도 종목의 공시 실적 (핵심 주도+주도 후보)", "",
              f"주도 {fd['n']}개 중 공시 확인 {fd['known']} · 확인 불가 {fd['unknown']}", "",
              "| 항목 | 종목 수 | 확인된 종목 대비 |", "|---|---:|---:|",
              f"| 매출 없음·미미 (연 매출 < {'$10M' if m == 'US' else '100억원'}) | {fd['no_revenue']} | {pct(fd['no_revenue'] / fd['known'] if fd['known'] else None)} |",
              f"| 적자 (최근 연간 순이익 < 0) | {fd['loss']} | {pct(fd['loss'] / fd['loss_known'] if fd['loss_known'] else None)} |",
              f"| 매출 감소 | {fd['shrinking']} | {pct(fd['shrinking'] / fd['growth_known'] if fd['growth_known'] else None)} |", "",
              f"(이 중 매출 항목 없이 순이익만 공시하는 회사: {fd['no_revenue_filed']}개)", "",
              "매출 없음·미미 종목: " + (", ".join(fd["no_revenue_list"][:40]) or "없음"), "",
              "공시 확인 불가: " + (", ".join(fd["unknown_list"][:60]) or "없음")]
        gp = x["gaps"]
        L += ["", "### 7. 단일일 급등 의존 (최근 63거래일)", "",
              f"주가 확인 {gp['priced']} / {gp['n']} · 하루 상승률 ≥{GAP_MIN_DAY:.0%}이고 그 하루가 63일 로그 수익의 {GAP_MIN_SHARE:.0%} 이상: {gp['flagged']}개", "",
              "| 종목 | 섹터 | 최대 하루 상승 | 63일 수익률 | 하루 비중 |", "|---|---|---:|---:|---:|"]
        L += [f"| {g['ticker']} {g['name']} | {g['sector']} | {pct(g['top_day'])} | {pct(g['window_return'])} | {pct(g['share'])} |" for g in gp["list"][:25]]
        L.append("")
    L += ["## 한계", "", "- 공시 매출은 SEC 연간 프레임(CY2025, CY2024)과 OpenDART 2025 사업보고서 기준이며, 회계연도가 다른 회사는 가장 가까운 연도로 맞춰집니다. 확인 불가는 0으로 세지 않습니다.",
          "- 주가는 Yahoo 일봉이고, 분류 조건은 recalculate_market_leadership()을 그대로 옮겼습니다. 이 보고서는 아무것도 바꾸지 않습니다."]
    return "\n".join(L) + "\n"


def summarize(rows: list[dict], funda: dict, closes: dict, as_of: str) -> dict:
    rep = {"as_of": as_of, "markets": {}}
    for m in ("US", "KR"):
        eq = [r for r in rows if r.get("market") == m and r.get("asset_class") == "Equity"]
        if not eq:
            continue
        leaders = [r for r in eq if r.get("leadership_class") in LEAD]
        semis = [r for r in eq if is_semi(r)]
        by_ticker = {r["ticker"]: r for r in eq}
        watch_rows = [by_ticker[t] for t in WATCH[m] if t in by_ticker]
        watch_rows += sorted([r for r in semis if r not in watch_rows], key=lambda r: -(num(r.get("rs_rank")) or 0))[:max(0, 20 - len(watch_rows))]
        med = lambda xs: None if not xs else statistics.median(xs)
        ranks95 = [r for r in eq if (num(r.get("rs_rank")) or 0) >= 95]
        flags = {r["ticker"]: fundamental_flags(m, funda.get((m, r["ticker"]))) for r in leaders}
        known = [t for t, f in flags.items() if f["status"] == "known"]
        gaps = []
        for r in leaders:
            g = single_day(closes.get((m, r["ticker"]), []))
            if g:
                gaps.append({**g, "ticker": r["ticker"], "name": r.get("name") or "", "sector": r.get("sector") or "—"})
        rep["markets"][m] = {
            # 조정 중 is a stage ('◇ 조정 중 주도주'), not a leadership_class value; the app counts it the same way.
            "classes": {c: sum(1 for r in eq if (("조정 중" in str(r.get("stage") or "")) if c == "조정 중" else r.get("leadership_class") == c)) for c in CLASSES} | {"전체 주식": len(eq)},
            "sectors": sector_mix(eq),
            "industry_rank": industry_rank(eq),
            "semis": {
                "n": len(semis), "leaders": sum(1 for r in semis if r.get("leadership_class") in LEAD),
                "median_rs_rank": fmt_n(med([num(r.get("rs_rank")) for r in semis if num(r.get("rs_rank")) is not None])),
                "pass": {k: sum(1 for r in semis if conditions(r)[k] is True) for k in conditions({})},
                "ret_3m": med([num(r.get("return_3m")) for r in semis if num(r.get("return_3m")) is not None]),
                "ret_12m": med([num(r.get("return_12m")) for r in semis if num(r.get("return_12m")) is not None]),
                "watch": [{"ticker": r["ticker"], "name": r.get("name") or "", "class": r.get("leadership_class") or "—",
                           "rs_rank": num(r.get("rs_rank")), "ibd": num(r.get("ibd_rs_estimate")), "high_dist": num(r.get("high_52w_distance")),
                           "ret_3m": num(r.get("return_3m")), "ret_12m": num(r.get("return_12m")),
                           "fails": ", ".join(k + ("(값 없음)" if v is None else "") for k, v in conditions(r).items() if v is not True)} for r in watch_rows],
            },
            "rs95": {"ret_3m": med([num(r.get("return_3m")) for r in ranks95 if num(r.get("return_3m")) is not None]),
                     "ret_12m": med([num(r.get("return_12m")) for r in ranks95 if num(r.get("return_12m")) is not None])},
            "funnel": funnel(eq),
            "fundamentals": {
                "n": len(leaders), "known": len(known), "unknown": len(leaders) - len(known),
                "no_revenue": sum(1 for f in flags.values() if f["no_revenue"]),
                "no_revenue_list": [f"{t} {by_ticker[t].get('name') or ''}".strip() for t, f in flags.items() if f["no_revenue"]],
                "no_revenue_filed": sum(1 for f in flags.values() if f.get("no_revenue_filed")),
                "unknown_list": [t for t, f in flags.items() if f["status"] == "unknown"],
                "loss": sum(1 for f in flags.values() if f["loss"]), "loss_known": sum(1 for f in flags.values() if f["loss"] is not None),
                "shrinking": sum(1 for f in flags.values() if f["shrinking"]), "growth_known": sum(1 for f in flags.values() if f["shrinking"] is not None),
            },
            "gaps": {"n": len(leaders), "priced": len(gaps), "flagged": sum(1 for g in gaps if g["flag"]),
                     "list": sorted([g for g in gaps if g["flag"]], key=lambda g: -(g["share"] or 0))},
        }
    return rep


# ---- network (not unit tested) -------------------------------------------------------------------------------
class _Body:
    def __init__(self, status_code: int, content: bytes):
        self.status_code, self.content = status_code, content

    def json(self):
        return json.loads(self.content)


def get_with_deadline(url: str, deadline: float = 60, attempts: int = 4, **kw) -> _Body:  # pragma: no cover - network
    """GET with a hard limit on the whole download. requests' timeout only bounds the gap between bytes, so a server
    that trickles a response could hold a run forever (the 2026-10-04 Pages deploy lost its flags file to that).
    Retries on a cut-off, stalled or failed connection; raises after the last attempt."""
    import requests
    last = None
    for attempt in range(attempts):
        try:
            start = time.monotonic()
            with requests.get(url, timeout=(15, 30), stream=True, **kw) as r:
                chunks = []
                for chunk in r.iter_content(1 << 16):
                    chunks.append(chunk)
                    if time.monotonic() - start > deadline:
                        raise requests.exceptions.Timeout(f"download over {deadline:.0f}s: {url}")
                return _Body(r.status_code, b"".join(chunks))
        except (requests.exceptions.ChunkedEncodingError, requests.exceptions.ConnectionError, requests.exceptions.Timeout) as e:
            last = e
            if attempt < attempts - 1:
                time.sleep(2 ** (attempt + 1))
    raise last


def sec_frames(ua: str, concept: str, period: str, unit: str = "USD") -> dict[int, float]:  # pragma: no cover - network
    r = get_with_deadline(f"https://data.sec.gov/api/xbrl/frames/us-gaap/{concept}/{unit}/{period}.json", headers={"User-Agent": ua})
    time.sleep(.15)
    if r.status_code != 200:
        return {}
    return {int(d["cik"]): float(d["val"]) for d in r.json().get("data", []) if d.get("val") is not None}


def us_fundamentals(ua: str, tickers: list[str], fallback: set[str] | None = None) -> dict:  # pragma: no cover - network
    """Annual revenue/net income from SEC frames; companies missing there are read from their own filings when they
    are in `fallback` (None = every ticker)."""
    sys.path.insert(0, str(Path(__file__).parent / "fundamentals"))
    import targets
    ciks = targets.sec_ciks(ua)
    rev = {p: {} for p in ("CY2025", "CY2024")}
    for p in rev:
        for tag in REVENUE_TAGS:
            for cik, v in sec_frames(ua, tag, p).items():
                rev[p][cik] = max(rev[p].get(cik, v), v)
    ni = sec_frames(ua, "NetIncomeLoss", "CY2025")
    out = {}
    for t in tickers:
        cik = ciks.get(t.upper().replace(".", "-")) or ciks.get(t.upper())
        if cik:
            out[("US", t)] = {"revenue": rev["CY2025"].get(cik), "revenue_prev": rev["CY2024"].get(cik), "net_income": ni.get(cik), "cik": cik}
            if out[("US", t)]["revenue"] is None and (fallback is None or t in fallback):
                out[("US", t)] |= company_annual(ua, cik)
    return out


def latest_annual(facts: dict, concepts: tuple[str, ...]) -> tuple[float | None, float | None]:
    """Latest and prior full-year values (10-K/20-F, about 12 months) across the given concepts."""
    best = {}
    for ns in ("us-gaap", "ifrs-full"):
        for c in concepts:
            for unit, items in ((facts.get("facts", {}).get(ns, {}).get(c) or {}).get("units") or {}).items():
                if unit != "USD":
                    continue
                for it in items:
                    if it.get("form") not in ("10-K", "20-F", "10-K/A", "20-F/A") or not it.get("start") or not it.get("end"):
                        continue
                    days = (datetime.date.fromisoformat(it["end"]) - datetime.date.fromisoformat(it["start"])).days
                    if 350 <= days <= 380 and it["end"] >= "2023-01-01":
                        best[it["end"]] = max(best.get(it["end"], it["val"]), it["val"])
    ends = sorted(best)
    return (best[ends[-1]] if ends else None, best[ends[-2]] if len(ends) > 1 else None)


def company_annual(ua: str, cik: int) -> dict:  # pragma: no cover - network
    """Fallback for a company missing from the CY2025 frames: its own filings, and whether it files without revenue."""
    import requests
    try:
        r = get_with_deadline(f"https://data.sec.gov/api/xbrl/companyfacts/CIK{cik:010d}.json", deadline=30, attempts=2, headers={"User-Agent": ua})
    except requests.exceptions.RequestException:
        return {}
    time.sleep(.15)
    if r.status_code != 200:
        return {}
    facts = r.json()
    rev, prev = latest_annual(facts, REVENUE_TAGS + ("Revenue", "RevenueFromContractsWithCustomers"))
    ni, _ = latest_annual(facts, ("NetIncomeLoss", "ProfitLoss"))
    if rev is not None:
        return {"revenue": rev, "revenue_prev": prev, "net_income": ni}
    # Files annual net income but no revenue line at all: a pre-revenue company (e.g. clinical-stage biotech).
    return {"net_income": ni, "files_without_revenue": ni is not None}


DART_BATCH_DEADLINE, DART_SOURCE_BUDGET = 45, 150  # seconds; OpenDART can turn slow (2026-10-04 deploy stalled on it)


def dart_corp_codes(key: str) -> dict[str, str]:  # pragma: no cover - network
    """stock_code -> OpenDART corp_code, downloaded once under a hard deadline."""
    import io
    import xml.etree.ElementTree as ET
    import zipfile
    r = get_with_deadline("https://opendart.fss.or.kr/api/corpCode.xml", deadline=60, attempts=2, params={"crtfc_key": key})
    if r.status_code != 200:
        raise RuntimeError(f"OpenDART corpCode HTTP {r.status_code}")
    with zipfile.ZipFile(io.BytesIO(r.content)) as archive:
        root = ET.fromstring(archive.read(archive.namelist()[0]))
    return {(item.findtext("stock_code") or "").strip(): item.findtext("corp_code").strip()
            for item in root.iter("list") if (item.findtext("stock_code") or "").strip()}


def dart_multi_accounts(key: str, corp_codes: list[str], year: int, report: str, budget: float = DART_SOURCE_BUDGET):  # pragma: no cover - network
    """Yields OpenDART multi-company account rows per batch of 100 companies. The whole source has a time budget and
    any failed batch fails the source (raised), so a slow OpenDART costs at most `budget` seconds instead of the run."""
    start = time.monotonic()
    for i in range(0, len(corp_codes), 100):
        if time.monotonic() - start > budget:
            raise TimeoutError(f"OpenDART over its {budget:.0f}s budget after {i} of {len(corp_codes)} companies")
        body = get_with_deadline("https://opendart.fss.or.kr/api/fnlttMultiAcnt.json", deadline=DART_BATCH_DEADLINE, attempts=2,
                                 params={"crtfc_key": key, "corp_code": ",".join(corp_codes[i:i + 100]), "bsns_year": str(year), "reprt_code": report}).json()
        yield body.get("list") or []
        time.sleep(.3)


def dart_pick(rows: list[dict]) -> dict[str, tuple[dict | None, dict | None]]:
    """corp_code -> (revenue row, net income row) from consolidated statements when present, else separate ones."""
    out = {}
    for corp in {r["corp_code"] for r in rows}:
        mine = [r for r in rows if r["corp_code"] == corp]
        fs = "CFS" if any(r.get("fs_div") == "CFS" for r in mine) else "OFS"
        mine = [r for r in mine if r.get("fs_div") == fs]
        out[corp] = (next((r for r in mine if r.get("account_nm") in ("매출액", "영업수익", "수익(매출액)")), None),
                     next((r for r in mine if (r.get("account_nm") or "").startswith("당기순이익")), None))
    return out


def kr_fundamentals(key: str, tickers: list[str], codes: dict[str, str] | None = None) -> dict:  # pragma: no cover - network
    codes = codes or dart_corp_codes(key)
    by_code = {codes[t]: t for t in tickers if t in codes}
    out = {}
    amount = lambda r, k: num(str(r.get(k) or "").replace(",", ""))
    for rows in dart_multi_accounts(key, list(by_code), 2025, "11011"):
        for corp, (rev, ni) in dart_pick(rows).items():
            out[("KR", by_code[corp])] = {"revenue": amount(rev, "thstrm_amount") if rev else None,
                                          "revenue_prev": amount(rev, "frmtrm_amount") if rev else None,
                                          "net_income": amount(ni, "thstrm_amount") if ni else None}
    return out


def yahoo_closes(rows: list[dict], period: str = "5mo") -> dict:  # pragma: no cover - network
    import yfinance as yf
    sym = {}
    for r in rows:
        s = r["ticker"].replace(".", "-") if r["market"] == "US" else r["ticker"] + (".KQ" if (r.get("exchange") or "").upper().startswith("KOSDAQ") else ".KS")
        sym[s] = (r["market"], r["ticker"])
    out, keys = {}, list(sym)
    for i in range(0, len(keys), 200):
        batch = keys[i:i + 200]
        frame = yf.download(batch, period=period, interval="1d", auto_adjust=False, progress=False, threads=True, group_by="ticker", timeout=30)
        for s in batch:
            try:
                f = frame[s] if len(batch) > 1 else frame
                out[sym[s]] = f["Close"].dropna().tolist()
            except Exception:
                continue
    return out


def main():  # pragma: no cover - network
    import requests
    rows = requests.get(LEADERBOARD_URL, params={"client": "peppercorn-public-read-v1"}, timeout=120).json()["rows"]
    leaders = [r for r in rows if r.get("asset_class") == "Equity" and r.get("leadership_class") in LEAD and r.get("market") in ("US", "KR")]
    funda = {}
    ua, key = os.environ.get("SEC_USER_AGENT"), os.environ.get("DART_API_KEY")
    if ua:
        funda |= us_fundamentals(ua, [r["ticker"] for r in leaders if r["market"] == "US"])
    if key:
        funda |= kr_fundamentals(key, [r["ticker"] for r in leaders if r["market"] == "KR"])
    closes = yahoo_closes(leaders)
    as_of = max((str(r.get("as_of") or r.get("ibd_rs_as_of") or "") for r in rows), default="") or datetime.date.today().isoformat()
    rep = summarize(rows, funda, closes, as_of)
    md = markdown(rep)
    Path(os.environ.get("REPORT_MD", "leadership_report.md")).write_text(md, encoding="utf-8")
    Path(os.environ.get("REPORT_JSON", "leadership_report.json")).write_text(json.dumps(rep, ensure_ascii=False, indent=1, default=str), encoding="utf-8")
    print(md)


if __name__ == "__main__":  # pragma: no cover
    main()
