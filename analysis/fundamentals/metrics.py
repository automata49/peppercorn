"""분기 재무 → 목업의 Quality / Growth 지표 계산 + 수집 품질 검사."""
from __future__ import annotations

from datetime import date

from quarters import ttm


def _div(a, b):
    return None if a is None or b in (None, 0) else a / b


def _ttm_field(q: dict, field: str, end: str):
    series = {k: v[field] for k, v in q.items() if field in v}
    return ttm(series, end)


def _fill(row: dict, absent: frozenset) -> dict:
    """Lines the company never presented (sec.parse `not_presented`) count as zero; everything else stays unknown."""
    return {**row, **{field: 0 for field in absent if row.get(field) is None}} if absent else row


def _ic(row: dict, with_leases: bool = False):
    """투하자본 = 자본 + 차입금 (+ 리스부채) - 현금 - 단기투자 (간이 정의)"""
    if any(row.get(field) is None for field in ("equity", "debt", "cash", "short_term_investments")):
        return None
    ic = (row["equity"] + row["debt"] + row.get("debt_current", 0)
          - row["cash"] - row["short_term_investments"])
    return ic + row["lease_liabilities"] if with_leases else ic


def _lease_basis(policy: str, now: dict, prev: dict | None) -> str:
    """included | excluded | excluded_not_presented | inconsistent (lease line at one date only)."""
    if policy != "included_if_presented":
        return "excluded"
    present = [row.get("lease_liabilities") is not None for row in (now, prev) if row is not None]
    if all(present):
        return "included"
    return "excluded_not_presented" if not any(present) else "inconsistent"


def compute(q: dict, default_tax: float, roic_method: dict | None = None, absent=()) -> dict:
    absent = frozenset(absent) & set((roic_method or {}).get("zero_if_never_presented", []))
    q = {end: _fill(row, absent) for end, row in q.items()}
    ends = sorted(q)
    if len(ends) < 4:
        return {}
    e = ends[-1]
    e1 = ends[-5] if len(ends) >= 5 else None      # 1년 전 분기
    e3 = ends[-13] if len(ends) >= 13 else None    # 3년 전 분기
    roic_method = roic_method or {}

    def T(f, end=e):
        return _ttm_field(q, f, end) if end else None

    rev, op, ni, ocf, capex = T("revenue"), T("operating_income"), T("net_income"), T("operating_cash_flow"), T("capex")
    fcf = None if ocf is None or capex is None else ocf - capex
    sbc = T("sbc")
    tax_rate = _div(T("income_tax"), T("pretax_income"))
    tax_source = "effective"
    if tax_rate is None or not 0 <= tax_rate <= 0.4:
        tax_rate, tax_source = default_tax, "statutory_fallback"

    def nopat(end):
        o = T("operating_income", end)
        return None if o is None else o * (1 - tax_rate)

    lease_basis = _lease_basis(roic_method.get("lease_liabilities", "excluded"), q[e], q[e1] if e1 else None)
    with_leases = lease_basis == "included"
    ic_now = _ic(q[e], with_leases)
    ic_prev = _ic(q[e1], with_leases) if e1 else None
    if lease_basis == "inconsistent":
        ic_now = ic_prev = None
    avg_ic = (ic_now + ic_prev) / 2 if ic_now is not None and ic_prev is not None else None
    roic = _div(nopat(e), avg_ic) if avg_ic and avg_ic > 0 else None
    inc_roic = None
    if (e1 and nopat(e) is not None and nopat(e1) is not None and ic_now is not None and ic_prev is not None
            and ic_now - ic_prev > 0):
        inc_roic = (nopat(e) - nopat(e1)) / (ic_now - ic_prev)

    rev_prev = T("revenue", e1) if e1 else None
    rev_3y = T("revenue", e3) if e3 else None
    ni_3y = T("net_income", e3) if e3 else None
    shares, shares_prev = q[e].get("diluted_shares"), (q[e1].get("diluted_shares") if e1 else None)
    last = q[e]
    net_debt = None
    if all(last.get(field) is not None for field in ("debt", "cash", "short_term_investments")):
        net_debt = last["debt"] + last.get("debt_current", 0) - last["cash"] - last["short_term_investments"]

    return {
        "as_of": e,
        "ttm_revenue": rev, "ttm_operating_income": op, "ttm_net_income": ni,
        "ttm_fcf": fcf, "ttm_sbc": sbc,
        "owner_earnings": None if fcf is None or sbc is None else fcf - sbc,
        "gross_margin": _div(T("gross_profit"), rev),
        "operating_margin": _div(op, rev),
        "fcf_margin": _div(fcf, rev),
        "fcf_conversion": _div(fcf, ni),
        "tax_rate_used": tax_rate, "tax_rate_source": tax_source,
        "roic_method": roic_method.get("version"), "roic_lease_basis": lease_basis,
        "roic_zero_not_presented": sorted(absent),
        "roic": roic, "incremental_roic": inc_roic,
        "roe": _div(ni, last.get("equity")),
        "net_debt": net_debt,
        "revenue_yoy": None if rev is None or rev_prev in (None, 0) else rev / rev_prev - 1,
        "revenue_cagr_3y": None if not rev_3y or rev_3y <= 0 or rev is None else (rev / rev_3y) ** (1 / 3) - 1,
        "net_income_cagr_3y": None if not ni_3y or ni_3y <= 0 or not ni or ni <= 0 else (ni / ni_3y) ** (1 / 3) - 1,
        "dilution_yoy": None if not shares or not shares_prev else shares / shares_prev - 1,
        **_display(q, ends, e, e1, e3, T),
    }


def _display(q: dict, ends: list[str], e: str, e1: str | None, e3: str | None, T) -> dict:
    """Quantities the stock analysis screen shows next to the user's own entries; unknown stays None."""
    last, prior = q[e], (q[e1] if e1 else {})
    rev, rev_prior = last.get("revenue"), prior.get("revenue")
    eps_q, eps_q_prior = last.get("eps_diluted"), prior.get("eps_diluted")
    eps_ttm, eps_ttm_3y = T("eps_diluted"), (T("eps_diluted", e3) if e3 else None)
    liabilities, equity = last.get("liabilities"), last.get("equity")
    shares_end = next((k for k in ends[::-1][:2] if q[k].get("diluted_shares")), None)
    return {
        "revenue_yoy_q": None if rev is None or not rev_prior or rev_prior <= 0 else rev / rev_prior - 1,
        "ttm_operating_cash_flow": T("operating_cash_flow"),
        "eps_ttm": eps_ttm,
        "eps_yoy_q": None if eps_q is None or not eps_q_prior or eps_q_prior <= 0 else eps_q / eps_q_prior - 1,
        "eps_cagr_3y": None if not eps_ttm or not eps_ttm_3y or eps_ttm <= 0 or eps_ttm_3y <= 0
        else (eps_ttm / eps_ttm_3y) ** (1 / 3) - 1,
        "debt_ratio": None if liabilities is None or not equity or equity <= 0 else liabilities / equity,
        "diluted_shares_latest": q[shares_end]["diluted_shares"] if shares_end else None,
        "shares_common": last.get("shares_common"),
        "shares_preferred": last.get("shares_preferred"),
    }


REQUIRED = ["revenue", "operating_income", "net_income", "operating_cash_flow", "capex", "equity", "cash"]


def checks(q: dict, m: dict, today: date) -> list[tuple[str, bool, str]]:
    out = []
    ends = sorted(q)
    if not ends:
        return [("데이터 존재", False, "분기 데이터 0건")]
    age = (today - date.fromisoformat(ends[-1])).days
    out.append(("최신성", 0 <= age <= 200, f"최근 분기 {ends[-1]} ({age}일 전)"))
    out.append(("분기 수 ≥ 8", len(ends) >= 8, f"{len(ends)}개 분기 ({ends[0]} ~ {ends[-1]})"))
    missing = [f for f in REQUIRED if q[ends[-1]].get(f) is None]
    out.append(("필수 항목", not missing, "모두 있음" if not missing else "누락: " + ", ".join(missing)))
    # 예전 분기엔 있던 재무상태표 항목이 최신 분기에 없으면 태그가 바뀐 것 (순부채·ROIC 왜곡)
    broken = [f for f in ("cash", "short_term_investments", "debt")
              if q[ends[-1]].get(f) is None and any(f in q[k] for k in ends[-8:-1])]
    out.append(("재무상태표 연속성", not broken, "정상" if not broken else "최신 분기 누락: " + ", ".join(broken)))
    neg = [k for k, v in q.items() if v.get("revenue") is None or v["revenue"] <= 0]
    out.append(("매출 > 0", not neg, "정상" if not neg else "음수/0: " + ", ".join(neg)))
    gm = m.get("gross_margin")
    out.append(("매출총이익률 0~100%", gm is None or 0 <= gm <= 1, "없음(해당 항목 미공시)" if gm is None else f"{gm:.1%}"))
    # 지표 계산에 쓰는 최근 16개 분기(4년)만 연속성 검사. 그 이전 공백은 참고로만 표시
    recent = ends[-16:]
    gaps = [(a, b) for a, b in zip(recent, recent[1:]) if (date.fromisoformat(b) - date.fromisoformat(a)).days > 100]
    old = [(a, b) for a, b in zip(ends[:-15], ends[1:-15]) if (date.fromisoformat(b) - date.fromisoformat(a)).days > 100]
    note = "빠진 분기 없음" if not gaps else f"공백 {len(gaps)}곳: {gaps[:3]}"
    if old:
        note += f" (참고: 4년 이전 공백 {len(old)}곳)"
    out.append(("분기 연속성 (최근 16분기)", not gaps, note))
    for key in ("roic", "fcf_margin", "revenue_yoy"):
        out.append((f"{key} 계산", m.get(key) is not None, "계산됨" if m.get(key) is not None else "계산 불가"))
    return out
