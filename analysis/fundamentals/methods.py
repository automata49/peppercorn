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
    },
    "KR": {
        "version": "KR-FCF-PPE-2",
        "fcf_formula": "TTM operating cash flow minus TTM purchases of property, plant and equipment net of government grants received",
        "capex_basis": "OpenDART consolidated purchase of PPE minus the separate government-grant line when a report presents it; intangible acquisitions excluded",
        "capex_field": "capex",
        "currency": "KRW",
    },
}


def for_market(market: str) -> dict:
    if market not in METHODS:
        raise ValueError(f"Unsupported fundamentals market: {market}")
    return deepcopy(METHODS[market])
