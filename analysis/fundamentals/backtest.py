"""Point-in-time backtest of the Position label rules on a fixed US universe.

  python backtest.py fetch --cache cache        # SEC companyfacts (needs SEC_USER_AGENT) + Yahoo prices
  python backtest.py run --cache cache --out bt # labels at each as-of date, forward outcomes, report

At each as-of date only facts filed on or before that date are used (`sec.parse(as_of=...)`), and the price is
the close on that date. Outcomes use the full current data: forward ROIC, forward 3-year revenue CAGR, forward
revenue drawdown and forward 3-year total return. SEC companyfacts is today's API, so a fact's recorded filing
date is trusted but a later backfill of an old period can still leak; see docs/harness/POSITION_RULES_V1.md.
"""
from __future__ import annotations

import argparse
import gzip
import json
import os
import statistics
from datetime import date, datetime, timezone
from pathlib import Path

import requests

import labels
import methods
import metrics
import prices
import sec
from quarters import ttm

# Non-financial US large caps fixed before any result was read: the 43 names of the first run plus sector
# peers added only for filing coverage (an operating income line, no captive finance arm, 13-week quarters).
# Groups are the expected profile, used only to show coverage, never by the rules. Survivorship bias remains:
# every name is still listed today.
UNIVERSE = {
    "growth": ["AAPL", "MSFT", "NVDA", "GOOGL", "META", "AMZN", "ADBE", "CRM", "NOW", "ISRG", "AVGO", "NFLX",
               "ORCL", "CSCO", "TXN", "QCOM", "INTU", "ADI", "ACN", "TMO", "DHR", "SYK", "ZTS", "AMGN", "GILD",
               "BSX", "MDT", "EW", "IDXX", "CMG", "BKNG", "ADP", "PAYX", "V", "MA"],
    "stalwart": ["KO", "PG", "PEP", "JNJ", "MCD", "COST", "WMT", "HD", "UNH", "ABT", "LOW", "TGT", "SBUX", "CL",
                 "KMB", "GIS", "HSY", "MDLZ", "YUM", "TJX", "ROST", "CLX", "HON", "UNP", "UPS", "LMT", "GD", "NOC",
                 "ITW", "EMR", "CSX", "NSC", "WM", "SHW", "APD"],
    "cyclical": ["MU", "INTC", "CAT", "DE", "DOW", "NUE", "FCX", "XOM", "CVX", "F", "GM", "AMAT", "LRCX", "KLAC",
                 "AMD", "LYB", "STLD", "CLF", "COP", "EOG", "OXY", "SLB", "HAL", "MPC", "VLO", "WHR", "LEN", "DHI",
                 "PHM", "NEM"],
    "stagnant": ["IBM", "T", "VZ", "PFE", "MMM", "BA", "NKE", "KHC", "CVS", "DIS", "TSLA", "UBER", "EL", "WBA"],
}
# The SEC ticker list maps a ticker to its current registrant; these reorganized companies filed their history
# under an earlier CIK.
# Replication universe, fixed on 2026-09-30 before any run on it: US non-financial S&P 500 members not in UNIVERSE
# and still listed; banks, insurers, REITs and utilities are excluded because ROIC is not meaningful for them.
# Used only to test position-rules-v1.2 (content identical to v1.1); never used to design a rule.
UNIVERSE_B = {
    "technology": ["ANET", "CDNS", "SNPS", "FTNT", "PANW", "ADSK", "MCHP", "NXPI", "ON", "MPWR", "TER", "KEYS",
                   "ZBRA", "CDW", "IT", "FICO", "VRSN", "AKAM", "HPQ", "NTAP", "WDC", "STX", "GLW", "APH", "CTSH"],
    "health": ["REGN", "VRTX", "BIIB", "ILMN", "IQV", "A", "WAT", "MTD", "RMD", "BDX", "BAX", "HOLX", "ALGN",
               "DXCM", "STE", "LH", "DGX", "HCA", "MCK", "ZBH"],
    "consumer": ["ORLY", "AZO", "TSCO", "DG", "DLTR", "BBY", "ULTA", "DRI", "MAR", "HLT", "EXPE", "POOL", "GPC",
                 "LULU", "DECK", "NVR", "KR", "SYY", "ADM", "TSN", "HRL", "CAG", "MNST", "CHD", "STZ", "MO", "PM"],
    "industrial": ["ETN", "PH", "ROK", "DOV", "AME", "XYL", "JCI", "CMI", "PCAR", "ODFL", "JBHT", "EXPD", "FAST",
                   "GWW", "URI", "CTAS", "RSG", "CPRT", "LHX", "TXT", "TDG", "SNA", "SWK", "FDX", "DAL", "UAL", "LUV"],
    "materials_energy": ["ECL", "PPG", "ALB", "CF", "MOS", "VMC", "MLM", "IP", "PKG", "AVY", "EMN", "PSX", "DVN", "BKR"],
    "media": ["CMCSA", "CHTR", "TMUS", "EA", "TTWO"],
}
# Second replication universe, fixed on 2026-09-30 before any run on it: US non-financial companies in neither
# UNIVERSE nor UNIVERSE_B, still listed, same exclusions. Used only to test position-rules-v2.
UNIVERSE_C = {
    "health": ["LLY", "ABBV", "MRK", "BMY", "RVTY", "TECH", "CRL", "WST", "PODD", "INCY", "VTRS", "HSIC", "DVA",
               "UHS", "CAH"],
    "technology": ["WDAY", "CRWD", "DDOG", "SMCI", "ENPH", "FSLR", "GEN", "JKHY", "BR", "GPN", "CPAY", "TRMB",
                   "TYL", "PTC", "ROP", "GRMN", "TEL", "JBL", "SWKS", "QRVO", "EPAM", "FFIV"],
    "consumer": ["TPR", "RL", "HAS", "LVS", "WYNN", "MGM", "CCL", "RCL", "NCLH", "DPZ", "MHK", "KMX", "EBAY",
                 "KDP", "TAP", "BG", "SJM", "MKC", "CPB", "LW", "WSM", "LKQ"],
    "industrial": ["GE", "RTX", "HWM", "ALLE", "AOS", "BLDR", "CHRW", "J", "LDOS", "PWR", "GNRC", "IEX", "PNR",
                   "RHI", "NDSN", "ROL", "VRSK", "WAB", "HUBB", "LII", "TT", "IR", "EFX", "AXON", "PAYC"],
    "materials_energy": ["LIN", "DD", "CE", "IFF", "BALL", "AMCR", "RS", "APA", "CTRA", "FANG", "EQT", "OKE",
                         "KMI", "WMB", "TRGP"],
    "media": ["FOXA", "NWSA", "WBD", "OMC", "LYV", "MTCH", "IPG"],
}
UNIVERSES = {"A": UNIVERSE, "B": UNIVERSE_B, "C": UNIVERSE_C}
CIK_OVERRIDE = {"XOM": 34088}
AS_OF = ["2018-06-30", "2018-12-31", "2019-06-30", "2019-12-31", "2020-06-30", "2020-12-31",
         "2021-06-30", "2021-12-31", "2022-06-30"]
# Out-of-sample dates, first run only after position-rules-v1.1 was fixed; never used to design any rule.
HOLDOUT = ["2014-06-30", "2014-12-31", "2015-06-30", "2015-12-31", "2016-06-30", "2016-12-31",
           "2017-06-30", "2017-12-31"]
HORIZON_YEARS = 3
TICKERS_URL = "https://www.sec.gov/files/company_tickers.json"


def tickers(universe: str = "A") -> list[str]:
    return [t for group in UNIVERSES[universe].values() for t in group]


def fetch(cache: Path, universe: str = "A") -> None:
    ua = os.environ.get("SEC_USER_AGENT", "").strip()
    if "@" not in ua:
        raise SystemExit("SEC_USER_AGENT is required")
    (cache / "sec").mkdir(parents=True, exist_ok=True)
    (cache / "prices").mkdir(parents=True, exist_ok=True)
    mapping = requests.get(TICKERS_URL, headers={"User-Agent": ua}, timeout=60).json()
    cik = {row["ticker"]: row["cik_str"] for row in mapping.values()} | CIK_OVERRIDE
    manifest = {"fetched_at": datetime.now(timezone.utc).isoformat(), "universe": universe, "companies": {}}
    for ticker in tickers(universe):
        if ticker not in cik:
            manifest["companies"][ticker] = {"error": "ticker not in SEC mapping"}
            continue
        try:
            facts, quote, profile = sec.fetch(cik[ticker]), prices.fetch(ticker), sec.fetch_profile(cik[ticker])
        except Exception as error:  # noqa: BLE001 - one company's outage must not stop the fetch
            manifest["companies"][ticker] = {"error": f"{type(error).__name__}: {str(error)[:120]}"}
            continue
        (cache / "sec" / f"{ticker}.json.gz").write_bytes(gzip.compress(json.dumps(facts).encode()))
        (cache / "prices" / f"{ticker}.json").write_text(json.dumps(quote), encoding="utf-8")
        (cache / "profiles").mkdir(exist_ok=True)
        (cache / "profiles" / f"{ticker}.json").write_text(json.dumps(profile), encoding="utf-8")
        manifest["companies"][ticker] = {"cik": cik[ticker], "sic": profile["sic"], "sec_sha256": facts.get("_raw_sha256"),
                                         "price_sha256": quote["raw_sha256"], "price_days": len(quote["dates"])}
        print(ticker, manifest["companies"][ticker])
    tnx = prices.fetch(prices.RISK_FREE_SYMBOL)
    (cache / "prices" / "_risk_free.json").write_text(json.dumps(tnx), encoding="utf-8")
    manifest["risk_free"] = {"symbol": prices.RISK_FREE_SYMBOL, "sha256": tnx["raw_sha256"], "days": len(tnx["dates"])}
    (cache / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")


def _load(cache: Path, ticker: str) -> tuple[dict, dict, dict | None]:
    facts = json.loads(gzip.decompress((cache / "sec" / f"{ticker}.json.gz").read_bytes()))
    profile = cache / "profiles" / f"{ticker}.json"
    return (facts, json.loads((cache / "prices" / f"{ticker}.json").read_text(encoding="utf-8")),
            json.loads(profile.read_text(encoding="utf-8")) if profile.exists() else None)


def _plus_years(day: str, years: int) -> str:
    d = date.fromisoformat(day)
    return d.replace(year=d.year + years, day=min(d.day, 28) if d.month == 2 else d.day).isoformat()


def _upto(q: dict, end: str) -> dict:
    return {k: v for k, v in q.items() if k <= end}


def outcomes(full: dict, start_quarter: str, as_of: str, quote: dict, roic_method: dict) -> dict:
    """Forward outcomes measured on today's data, starting at the as-of date's latest quarter."""
    ends = sorted(full)
    if start_quarter not in ends:
        return {}
    i = ends.index(start_quarter)
    fwd = [ends[i + n] if i + n < len(ends) else None for n in (4, 8, 12)]
    out: dict = {}
    roics = [metrics.compute(_upto(full, e), methods.statutory_tax_rate("US", int(e[:4])), roic_method).get("roic")
             for e in fwd if e]
    roics = [r for r in roics if r is not None]
    out["fwd_roic"] = statistics.mean(roics) if len(roics) == 3 else None
    rev_s = {k: v["revenue"] for k, v in full.items() if "revenue" in v}
    r0, r12 = ttm(rev_s, start_quarter), ttm(rev_s, fwd[2]) if fwd[2] else None
    out["fwd_revenue_cagr"] = (r12 / r0) ** (1 / 3) - 1 if r0 and r12 and r0 > 0 and r12 > 0 else None
    path = [ttm(rev_s, e) for e in ends[i:i + 13]]
    out["fwd_revenue_drawdown"] = labels._drawdown(path, True) if len(path) == 13 and all(path) else None
    out["fwd_return"] = prices.total_return(quote, as_of, _plus_years(as_of, HORIZON_YEARS))
    return out


def run(cache: Path, out_dir: Path, rules: dict, dates: list[str] = AS_OF, universe: str = "A") -> dict:
    method = methods.for_market("US")["roic"]
    tnx = json.loads((cache / "prices" / "_risk_free.json").read_text(encoding="utf-8"))
    rows = []
    for ticker in tickers(universe):
        if not (cache / "sec" / f"{ticker}.json.gz").exists():
            rows.append({"ticker": ticker, "error": "not fetched"})
            continue
        facts, quote, profile = _load(cache, ticker)
        full = sec.parse(facts)["quarters"]
        for as_of in dates:
            row = {"ticker": ticker, "as_of": as_of}
            parsed = sec.parse(facts, as_of=as_of)
            q = parsed["quarters"]
            if not q:
                rows.append({**row, "status": "no_data"})
                continue
            latest = max(q)
            row["latest_quarter"] = latest
            if not labels.as_of_is_fresh(latest, as_of):
                rows.append({**row, "status": "stale"})
                continue
            tax = methods.statutory_tax_rate("US", int(latest[:4]))
            absent = parsed.get("not_presented", [])
            m = metrics.compute(q, tax, method, absent)
            failed = [c[0] for c in metrics.checks(q, m, date.fromisoformat(as_of)) if not c[1]]
            result = labels.evaluate(q, "US", None, rules, tax, method, absent, profile)
            share_end = result["features"].get("shares_quarter")
            if share_end:
                share_input = (parsed["source_lineage"].get(share_end, {}).get("diluted_shares") or {}).get("inputs") or [{}]
                price = prices.market_cap(quote, as_of, q[share_end]["diluted_shares"], share_input[0].get("filed"))
                if price:
                    price["risk_free"] = prices.risk_free_on(tnx, as_of)
                result = labels.evaluate(q, "US", price, rules, tax, method, absent, profile)
            row |= {"status": "check_failed" if failed else result["status"], "failed_checks": failed,
                    "labels": result["labels"] if not failed else {}, "missing": result["missing"],
                    "features": result["features"], "value_detail": result["value_detail"],
                    "reasons": result["reasons"] if not failed else {}}
            row["outcomes"] = outcomes(full, latest, as_of, quote, method)
            rows.append(row)
        print(ticker, sum(1 for r in rows if r["ticker"] == ticker and r.get("status") == "ok"), "labelled")
    report = summarize(rows, rules)
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "rows.json").write_text(json.dumps(rows, indent=1, default=str), encoding="utf-8")
    (out_dir / "summary.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    (out_dir / "report.md").write_text(render(report, rules), encoding="utf-8")
    return report


# Pre-registered acceptance (docs/harness/POSITION_RULES_V1.md): every group needs MIN_GROUP observations and
# strictly ordered medians; cyclicals must show larger forward drawdowns; types must be stable; coverage must hold.
MIN_GROUP = 10
MIN_TYPE_STABILITY = 0.8
MIN_COMPANIES = 40
# Each label is judged on the outcome it claims to anticipate; the expected order is best first.
TESTS = {
    "quality": ("fwd_roic", ["High", "Average", "Low"]),
    "growth": ("fwd_revenue_cagr", ["Durable", "Moderate", "Weak"]),
    "value": ("excess_return", ["Attractive", "Fair", "Expensive"]),
}


def _value_order(rules: dict | None) -> list[str]:
    names = ((rules or {}).get("value") or {}).get("label_names", {"low": "Attractive", "mid": "Fair", "high": "Expensive"})
    return [names["low"], names["mid"], names["high"]]


def summarize(rows: list[dict], rules: dict | None = None) -> dict:
    ok = [r for r in rows if r.get("status") == "ok"]
    value_order = _value_order(rules)
    expectations = ((rules or {}).get("value") or {}).get("test") == "expectations"
    tests = {**TESTS, "value": ("excess_return", value_order)}
    by_date: dict[str, list[float]] = {}
    for r in ok:
        if r["outcomes"].get("fwd_return") is not None:
            by_date.setdefault(r["as_of"], []).append(r["outcomes"]["fwd_return"])
    for r in ok:
        ret = r["outcomes"].get("fwd_return")
        r["outcomes"]["excess_return"] = None if ret is None else ret - statistics.median(by_date[r["as_of"]])
    status: dict[str, int] = {}
    for r in rows:
        status[r.get("status", "error")] = status.get(r.get("status", "error"), 0) + 1
    report: dict = {"observations": len(rows), "status": status, "tests": {}, "type": {}}
    for dim, (metric, order) in tests.items():
        groups = {}
        for label in order:
            vals = [r["outcomes"][metric] for r in ok if r["labels"].get(dim) == label and r["outcomes"].get(metric) is not None]
            groups[label] = {"n": len(vals), "median": statistics.median(vals) if vals else None,
                             "tickers": sorted({r["ticker"] for r in ok if r["labels"].get(dim) == label})}
        enough = all(groups[label]["n"] >= MIN_GROUP for label in order)
        medians = [groups[label]["median"] for label in order]
        report["tests"][dim] = {"metric": metric, "order": order, "groups": groups,
                                "monotonic": enough and all(a > b for a, b in zip(medians, medians[1:]))}
    for kind in ["Unprofitable", "Cyclical", "Fast Grower", "Stalwart", "Slow Grower"]:
        members = [r for r in ok if r["labels"].get("type") == kind]
        dd = [r["outcomes"]["fwd_revenue_drawdown"] for r in members if r["outcomes"].get("fwd_revenue_drawdown") is not None]
        report["type"][kind] = {"n": len(members), "fwd_drawdown_median": statistics.median(dd) if dd else None,
                                "tickers": sorted({r["ticker"] for r in members})}
    cyc = [r["outcomes"]["fwd_revenue_drawdown"] for r in ok if r["labels"].get("type") == "Cyclical"
           and r["outcomes"].get("fwd_revenue_drawdown") is not None]
    other = [r["outcomes"]["fwd_revenue_drawdown"] for r in ok if r["labels"].get("type") not in ("Cyclical", None)
             and r["outcomes"].get("fwd_revenue_drawdown") is not None]
    report["type_test"] = {"cyclical_median": statistics.median(cyc) if cyc else None,
                           "other_median": statistics.median(other) if other else None,
                           "passes": bool(cyc and other) and statistics.median(cyc) > statistics.median(other)}
    stable = changed = 0
    for ticker in {r["ticker"] for r in ok}:
        seq = [r["labels"]["type"] for r in sorted(ok, key=lambda r: r["as_of"]) if r["ticker"] == ticker]
        stable += sum(1 for a, b in zip(seq, seq[1:]) if a == b)
        changed += sum(1 for a, b in zip(seq, seq[1:]) if a != b)
    report["type_stability"] = stable / (stable + changed) if stable + changed else None
    # Informational, not an acceptance test: how often realized revenue growth reached the growth the price implied.
    report["value_expectations"] = {}
    for label in value_order:
        pairs = [(r["outcomes"]["fwd_revenue_cagr"], r["value_detail"]["implied_growth"]) for r in ok
                 if r["labels"].get("value") == label and r["outcomes"].get("fwd_revenue_cagr") is not None
                 and "implied_growth" in r["value_detail"]]
        report["value_expectations"][label] = {
            "n": len(pairs), "met_share": sum(a >= b for a, b in pairs) / len(pairs) if pairs else None}
    shares = [report["value_expectations"][label]["met_share"] for label in value_order]
    report["value_expectations_pass"] = (
        all(report["value_expectations"][label]["n"] >= MIN_GROUP for label in value_order)
        and all(a > b for a, b in zip(shares, shares[1:])) and shares[0] > 0.5 and shares[-1] < 0.5)
    report["value_test"] = "expectations" if expectations else "returns"
    report["companies_labelled"] = len({r["ticker"] for r in ok})
    report["acceptance"] = {
        "A1 quality": report["tests"]["quality"]["monotonic"],
        "A2 growth": report["tests"]["growth"]["monotonic"],
        "A3 value": report["value_expectations_pass"] if expectations else report["tests"]["value"]["monotonic"],
        "A4 type": report["type_test"]["passes"] and (report["type_stability"] or 0) >= MIN_TYPE_STABILITY,
        "A5 coverage": report["companies_labelled"] >= MIN_COMPANIES,
    }
    report["activate"] = all(report["acceptance"].values())
    return report


def _pct(v):
    return "—" if v is None else f"{v:+.1%}"


def render(report: dict, rules: dict) -> str:
    lines = [f"# Backtest {rules['version']}", "", f"Observations: {report['observations']} — status {report['status']}", ""]
    for dim, test in report["tests"].items():
        lines += [f"## {dim} vs {test['metric']} — {'monotonic' if test['monotonic'] else 'NOT monotonic'}", "",
                  "| label | n | median | companies |", "|---|---|---|---|"]
        for label, g in test["groups"].items():
            lines.append(f"| {label} | {g['n']} | {_pct(g['median'])} | {', '.join(g['tickers'])} |")
        lines.append("")
    lines += ["## type vs forward 3-year revenue drawdown", "", "| type | n | median drawdown | companies |", "|---|---|---|---|"]
    for kind, g in report["type"].items():
        lines.append(f"| {kind} | {g['n']} | {_pct(g['fwd_drawdown_median'])} | {', '.join(g['tickers'])} |")
    t = report["type_test"]
    lines += ["", f"Cyclical median {_pct(t['cyclical_median'])} vs others {_pct(t['other_median'])} — "
              f"{'passes' if t['passes'] else 'fails'}; type stability between consecutive dates "
              f"{report['type_stability']:.0%}" if report["type_stability"] is not None else "", ""]
    kind = "acceptance test A3" if report["value_test"] == "expectations" else "informational"
    lines += [f"## value expectations ({kind})", "", "| label | n | realized growth reached implied |", "|---|---|---|"]
    for label, g in report["value_expectations"].items():
        share = "—" if g["met_share"] is None else f"{g['met_share']:.0%}"
        lines.append(f"| {label} | {g['n']} | {share} |")
    lines += ["", f"Companies labelled: {report['companies_labelled']}", "", "## acceptance", "",
              *[f"- {name}: {'pass' if passed else 'FAIL'}" for name, passed in report["acceptance"].items()],
              "", f"Activate: {'yes' if report['activate'] else 'no'}", ""]
    return "\n".join(lines)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("command", choices=["fetch", "run"])
    ap.add_argument("--cache", default="cache")
    ap.add_argument("--out", default="bt")
    ap.add_argument("--rules", default="position-rules-v1.1")
    ap.add_argument("--dates", choices=["in-sample", "holdout", "all"], default="in-sample")
    ap.add_argument("--universe", choices=sorted(UNIVERSES), default="A")
    a = ap.parse_args()
    if a.command == "fetch":
        fetch(Path(a.cache), a.universe)
    else:
        rules = labels.load_rules(a.rules)
        dates = {"in-sample": AS_OF, "holdout": HOLDOUT, "all": HOLDOUT + AS_OF}[a.dates]
        report = run(Path(a.cache), Path(a.out), rules, dates, a.universe)
        print(f"universe {a.universe}, {a.dates} dates")
        print(render(report, rules))


if __name__ == "__main__":
    main()
