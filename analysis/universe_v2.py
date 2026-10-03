"""UNIVERSE-2: investable-universe selection (by user decision, 2026-10-03).

Benchmarks: Russell 3000 (exchange-wide start, price/market-cap floors, SPAC/LP/closed-end exclusions, a looser test
for existing members) and KRX300 (KOSPI+KOSDAQ screened together, administrative/caution/SPAC/new-listing exclusions).
Index membership (S&P 500, KOSPI200, KOSDAQ150) is no longer a selection criterion; it stays as display metadata.

Pure functions only: no network. sync_universe.py feeds listings in; universe_report.py simulates the effect.
Missing data never admits a new stock. An existing member is removed only when a known value falls below
BUFFER x threshold (Russell-style band against turnover); a missing value alone does not remove it.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

VERSION = "UNIVERSE-2"
BUFFER = 0.70
THRESHOLDS = {
    # price (listing currency), market cap, 20-session average trading value (close x volume)
    "US": {"price": 5.0, "market_cap": 300e6, "traded_value": 5e6},
    "KR": {"price": 1_000.0, "market_cap": 100e9, "traded_value": 2e9},
}
US_EXCHANGES = ("NASDAQ", "NYSE", "AMEX")
KR_BOARDS = ("KOSPI", "KOSDAQ")
MIN_LISTING_DAYS = 30


@dataclass
class Candidate:
    market: str
    ticker: str
    name: str
    exchange: str | None = None
    price: float | None = None
    market_cap: float | None = None
    traded_value: float | None = None
    traded_value_source: str | None = None  # "traded_value_20d" (own history) or "listing_day" (one session)
    listing_days: int | None = None
    flags: set[str] = field(default_factory=set)  # exclusion flags found in the source rows
    sector: str | None = None
    industry: str | None = None


@dataclass
class Decision:
    candidate: Candidate
    included: bool
    reason: str  # "pass", "buffer", or the first failing rule


US_NAME_EXCLUSIONS = re.compile(
    r"\b(warrants?|units?|rights?|right to|preferred|depositary|senior notes|notes due|acquisition corp(oration)?"
    r"|acquisition co|funds?|closed-end|etns?|limited partnership|l\.p\.|lp|royalty trust|beneficial interest)\b",
    re.I,
)
US_INDUSTRY_EXCLUSIONS = ("blank checks", "trusts except educational religious and charitable")


def to_float(value) -> float | None:
    """Parse '$1,234.5', '1.2B', '' or None into a float; unparseable -> None (unknown, never zero)."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value) if value == value else None
    s = str(value).replace("$", "").replace(",", "").strip()
    if not s or s.upper() in {"NA", "N/A", "-", "--"}:
        return None
    mult = 1.0
    if s[-1:].upper() in {"T", "B", "M", "K"}:
        mult = {"T": 1e12, "B": 1e9, "M": 1e6, "K": 1e3}[s[-1].upper()]
        s = s[:-1]
    try:
        return float(s) * mult
    except ValueError:
        return None


def us_flags(symbol: str, name: str, industry: str | None) -> set[str]:
    flags = set()
    if US_NAME_EXCLUSIONS.search(name or ""):
        flags.add("non_common")
    if (industry or "").strip().lower() in US_INDUSTRY_EXCLUSIONS:
        flags.add("spac_or_trust")
    if not re.fullmatch(r"[A-Z][A-Z0-9.\-]{0,6}", symbol or ""):
        flags.add("symbol")
    elif len(symbol) > 4 and symbol.endswith(("W", "WS", "U", "R")) and "." not in symbol:
        flags.add("non_common")
    return flags


def kr_flags(code: str, name: str, dept: str | None) -> set[str]:
    flags = set()
    if not re.fullmatch(r"\d{5}0", code or ""):
        flags.add("preferred")  # KRX common shares end in 0; preferred and other classes end in 5/7/9/K...
    n = name or ""
    if "스팩" in n or re.search(r"\bSPAC\b", n, re.I):
        flags.add("spac")
    if "리츠" in n or re.search(r"REIT", n, re.I) or "인프라" in n and "투융자" in n:
        flags.add("reit_or_fund")
    d = dept or ""
    if "관리" in d:
        flags.add("administrative")
    if "환기" in d:
        flags.add("caution")
    if "정지" in d:
        flags.add("suspended")
    return flags


def decide(c: Candidate, existing: bool) -> Decision:
    """Apply exclusions, then the price / market-cap / trading-value floors (BUFFER x floor for existing members)."""
    if c.flags:
        return Decision(c, False, "excluded:" + ",".join(sorted(c.flags)))
    if c.listing_days is not None and c.listing_days < MIN_LISTING_DAYS:
        return Decision(c, False, "new_listing")
    t = THRESHOLDS[c.market]
    scale = BUFFER if existing else 1.0
    for key, value in (("price", c.price), ("market_cap", c.market_cap), ("traded_value", c.traded_value)):
        if value is None:
            if existing:
                continue
            return Decision(c, False, f"missing:{key}")
        if value < t[key] * scale:
            return Decision(c, False, f"below:{key}")
    if existing and any(
        v is not None and v < t[k] for k, v in (("price", c.price), ("market_cap", c.market_cap), ("traded_value", c.traded_value))
    ):
        return Decision(c, True, "buffer")
    return Decision(c, True, "pass")


def select(candidates: list[Candidate], existing: set[tuple[str, str]]) -> list[Decision]:
    """One decision per (market, ticker); duplicate listing rows keep the first."""
    seen, out = set(), []
    for c in candidates:
        key = (c.market, c.ticker)
        if key in seen:
            continue
        seen.add(key)
        out.append(decide(c, key in existing))
    return out


def summarize(decisions: list[Decision]) -> dict:
    out: dict = {}
    for d in decisions:
        m = out.setdefault(d.candidate.market, {"candidates": 0, "included": 0, "buffer": 0, "reasons": {}})
        m["candidates"] += 1
        if d.included:
            m["included"] += 1
            m["buffer"] += d.reason == "buffer"
        else:
            reason = d.reason.split(":")[0] + (":" + d.reason.split(":")[1] if d.reason.startswith(("below", "missing")) else "")
            m["reasons"][reason] = m["reasons"].get(reason, 0) + 1
    return out
