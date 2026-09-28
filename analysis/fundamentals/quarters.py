"""분기 값 계산 공통 로직.

공시는 분기(3개월) 값이 아니라 '연초부터 누적(YTD)' 값으로 나오는 경우가 많다.
- SEC 10-Q 현금흐름표: 1~6월, 1~9월 누적
- DART 분기/반기 보고서: 누적 금액
그래서 '이번 누적 - 직전 누적'으로 3개월 값을 만든다.
"""
from __future__ import annotations

from datetime import date


def days(start: str, end: str) -> int:
    return (date.fromisoformat(end) - date.fromisoformat(start)).days


def is_quarter(start: str, end: str) -> bool:
    return 80 <= days(start, end) <= 100


def derive_quarters(durations: dict[tuple[str, str], float]) -> dict[str, float]:
    """{(시작일, 종료일): 값} → {분기 종료일: 3개월 값}

    1) 3개월짜리 값이 있으면 그대로 사용
    2) 없으면 같은 시작일의 누적값끼리 빼서 계산 (예: 9개월 누적 - 6개월 누적)
    """
    return {end: item["value"] for end, item in derive_quarters_with_sources(durations).items()}


def derive_quarters_with_sources(durations: dict[tuple[str, str], float]) -> dict[str, dict]:
    """Return each quarterly value and the exact source spans used to derive it."""
    out: dict[str, dict] = {}
    ends = sorted({e for (_, e) in durations})
    for end in ends:
        direct = [((s, e), v) for (s, e), v in durations.items() if e == end and is_quarter(s, e)]
        if direct:
            span, value = direct[0]
            out[end] = {"value": value, "spans": [span]}
            continue
        # 누적값: 같은 종료일, 기간이 3개월보다 긴 것 중 가장 긴 것(연초부터)
        ytd = [(s, v) for (s, e), v in durations.items() if e == end and days(s, e) > 100]
        if not ytd:
            continue
        start, total = min(ytd, key=lambda x: x[0])
        # 같은 시작일에서 약 3개월 전에 끝나는 누적값
        prev = [
            (e, v) for (s, e), v in durations.items()
            if s == start and e < end and 80 <= days(e, end) <= 100
        ]
        if prev:
            out[end] = {"value": total - prev[0][1], "spans": [(start, end), (start, prev[0][0])]}
            continue
        # 직전 누적값이 없으면: 누적 - (그 기간 안의 3개월 값들의 합)
        inner = [(s, e, v) for (s, e), v in durations.items()
                 if is_quarter(s, e) and s >= start and e < end]
        covered = sum(days(s, e) + 1 for s, e, _ in inner)
        if inner and 80 <= days(start, end) + 1 - covered <= 100:
            out[end] = {"value": total - sum(v for _, _, v in inner),
                        "spans": [(start, end)] + [(s, e) for s, e, _ in inner]}
    return out


def ttm(quarterly: dict[str, float], end: str) -> float | None:
    """최근 4개 분기 합(TTM). 4개가 모두 있어야 계산."""
    keys = [k for k in sorted(quarterly) if k <= end][-4:]
    if (len(keys) < 4 or keys[-1] != end
            or any(not 80 <= days(a, b) <= 100 for a, b in zip(keys, keys[1:]))
            or any(quarterly[k] is None for k in keys)):
        return None
    return sum(quarterly[k] for k in keys)
