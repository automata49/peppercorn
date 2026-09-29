"""Versioned local cash-flow bases. A metric's basis travels with its value."""
from __future__ import annotations

from copy import deepcopy


METHODS = {
    "US": {
        "version": "US-FCF-1",
        "fcf_formula": "TTM operating cash flow minus TTM reported acquisition line",
        "capex_basis": "SEC acquisition tag as filed; inspect filing to identify included assets",
        "capex_field": "capex",
        "currency": "USD",
        "roic": {
            "version": "US-ROIC-2",
            "nopat": "TTM operating income x (1 - tax); tax is the TTM effective rate (income tax / pretax income) when it lies in 0-40%, else the federal statutory rate (state tax not added)",
            "invested_capital": "total equity + debt (incl. current portion) - cash - short-term investments, averaged over the latest quarter end and four quarters earlier",
            "leases": "operating lease liabilities are not added to invested capital and operating lease cost stays in operating income (ASC 842 single-line expense), so numerator and denominator agree; finance leases are not separately added",
            "lease_liabilities": "excluded",
            "zero_if_never_presented": ["short_term_investments", "debt", "debt_current"],
            "not_presented": "short-term investments, debt or the current portion of debt count as zero only when no candidate concept (for debt, any borrowing-like concept) has a value at any of the latest 8 quarter ends; a line missing for a shorter time stays unknown",
            "financial_firms": "ROIC is not meaningful for banks and insurers; exclude them",
        },
    },
    "KR": {
        "version": "KR-FCF-PPE-2",
        "fcf_formula": "TTM operating cash flow minus TTM purchases of property, plant and equipment net of government grants received",
        "capex_basis": "OpenDART consolidated purchase of PPE minus the separate government-grant line when a report presents it; intangible acquisitions excluded",
        "capex_field": "capex",
        "currency": "KRW",
        "roic": {
            "version": "KR-ROIC-1",
            "nopat": "TTM operating income x (1 - tax); tax is the TTM effective rate (income tax / pretax income) when it lies in 0-40%, else the top-bracket statutory rate including local income tax",
            "invested_capital": "consolidated total equity (incl. non-controlling interests) + debt lines - cash - short-term financial instruments, plus lease liabilities when presented, averaged over the latest quarter end and four quarters earlier",
            "leases": "IFRS 16 operating income excludes lease interest, so lease liabilities belong in invested capital; they are added only when the consolidated balance sheet presents current and non-current lines at both dates. When absent at both dates the basis is reported as excluded_not_presented (ROIC is then somewhat overstated); presented at one date only suppresses ROIC",
            "lease_liabilities": "included_if_presented",
            "financial_firms": "ROIC is not meaningful for banks and insurers; exclude them",
        },
    },
}

# Top-bracket statutory income tax including local income tax. Years without a reviewed
# source are rejected rather than guessed.
_US_FEDERAL = 0.21                      # US federal statutory rate, tax years 2018 onward
_US_FEDERAL_PRE_TCJA = 0.35             # top rate before TCJA s.13001 (tax years beginning before 2018); backtests only
_KR_TOP_LOCAL_INCLUDED = {2025: 0.264}                                # 24% national x 1.1
_KR_TOP_FROM_2026 = 0.275                                          # 25% national x 1.1


def for_market(market: str) -> dict:
    if market not in METHODS:
        raise ValueError(f"Unsupported fundamentals market: {market}")
    return deepcopy(METHODS[market])


def statutory_tax_rate(market: str, year: int) -> float:
    if market == "US" and year >= 2018:
        return _US_FEDERAL
    if market == "US" and 1993 <= year <= 2017:
        return _US_FEDERAL_PRE_TCJA
    if market == "KR":
        if year >= 2026:
            return _KR_TOP_FROM_2026
        if year in _KR_TOP_LOCAL_INCLUDED:
            return _KR_TOP_LOCAL_INCLUDED[year]
    raise ValueError(f"No reviewed statutory tax rate for {market} {year}")
