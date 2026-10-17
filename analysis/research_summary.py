"""Source-grounded market / industry / company excerpts for Folio PDF reports.

No generative service, market inference, or report-purpose prose is produced here.
Every non-fallback line is a verbatim whitespace-normalized PDF text fragment.
"""
import re

CATEGORIES = {
    '시장': re.compile(
        r'시장|증시|코스피|코스닥|KOSPI|KOSDAQ|NASDAQ|나스닥|S&P|금리|국채|채권|연준|'
        r'FOMC|CPI|PCE|GDP|물가|고용|환율|달러|유동성|경기|외국인|인플레이션|'
        r'market|Treasury|yields?|inflation|interest rates?', re.I),
    '산업': re.compile(
        r'산업|업종|섹터|반도체|HBM|DRAM|메모리|파운드리|데이터센터|배터리|'
        r'전기차|자동차|클라우드|소프트웨어|바이오|제약|로봇|전력|공급망|'
        r'수요|공급|재고|가동률|CAPEX|출하량|'
        r'industry|sector|semiconductor|shipments?|inventory|demand|supply|cloud', re.I),
    '종목': re.compile(
        r'종목|기업|회사|엔비디아|삼성전자|SK하이닉스|테슬라|애플|'
        r'마이크로소프트|NVIDIA|NVDA|TSLA|AAPL|MSFT|GOOGL|AMZN|DELL|HPE|MRVL|ASML|AMD|AVGO|'
        r'매출|영업이익|순이익|실적|영업이익률|마진|목표주가|주가|'
        r'시가총액|가이던스|밸류에이션|EPS|ROE|PER|수주|고객사|'
        r'company|revenue|earnings|profit|guidance|operating margin', re.I),
}
# Report descriptions are not underlying investment facts, even when they name a sector.
REPORT_META = re.compile(
    r'(?:본|이번|해당|이)\s*(?:리포트|보고서|자료|글)(?:는|가|를|의|에서는|에서)|'
    r'(?:리포트|보고서)(?:는|가|를|의|에서는|에서)\s*(?:분석|정리|소개|설명|다루)|'
    r'분석하고자|살펴보고자|소개하고자|다루고자|본 자료의 목적|'
    r'(?:this|the)\s+report\s+(?:covers|explores|discusses|aims|outlines|analyzes)', re.I)
FACT = re.compile(
    r'\d|증가|감소|상승|하락|확대|축소|개선|악화|유지|회복|둔화|'
    r'부진|증설|감산|흑자|적자|수주|출하|전망|예상|기록|반등|'
    r'grew|growth|rose|fell|declin|increas|decreas|forecast|guidance|'
    r'expand|shipment|supply', re.I)
CHANGE = re.compile(r'증가|감소|상승|하락|전년|전분기|증설|둔화|개선|grew|rose|fell|year.over.year|quarter.over.quarter', re.I)
STOCK_FINANCIAL = re.compile(r'매출|영업이익|영업현금|영업마진|EPS|순이익|실적|마진|수주|revenue|earnings|profit|margin|guidance', re.I)
EDITORIAL = re.compile(r'매수·매도|검토 강화|검토 약화|매매 판단|판단 유보|핵심 판단|해석:|의견|추격 매수|단서일 뿐|증거가 아닙니다', re.I)
FALLBACK = '시장·산업·종목의 구체적인 사실을 자동 발췌하지 못했습니다. 원본 PDF를 확인해주세요.'


def _fragments(text):
    for paragraph in re.split(r'\n\s*\n', text):
        normalized = re.sub(r'\s+', ' ', paragraph).strip()
        for sentence in re.split(r'(?<=[.!?。！？;；])\s+', normalized):
            sentence = sentence.strip()
            # A long web-export PDF can omit sentence boundaries. Bound the excerpts.
            while len(sentence) > 580:
                cut = sentence.rfind(' ', 100, 540)
                if cut < 100:
                    cut = 540
                yield sentence[:cut].strip()
                sentence = sentence[cut:].strip()
            if sentence:
                yield sentence


def summarize_research(text, preferred=None):
    """Return 1-5 categorized, verbatim excerpts; empty categories are omitted.

    Optional manually supplied summaries are *ranking hints only*, never output
    directly: this prevents an abstract report-direction description or an
    unsupported number from bypassing extraction.
    """
    if preferred is not None and (
        not isinstance(preferred, list) or len(preferred) > 5
        or any(not isinstance(item, str) or len(item) > 600 for item in preferred)
    ):
        raise ValueError('Preferred excerpts must be a list of at most five short strings')
    hints = [re.sub(r'\s+', ' ', s).strip() for s in (preferred or [])]
    buckets = {category: [] for category in CATEGORIES}
    seen = set()
    for order, fragment in enumerate(_fragments(text)):
        if not 18 <= len(fragment) <= 580 or fragment in seen or REPORT_META.search(fragment) or not FACT.search(fragment) or EDITORIAL.search(fragment):
            continue
        seen.add(fragment)
        counts = {category: len(pattern.findall(fragment)) for category, pattern in CATEGORIES.items()}
        best = max(counts, key=lambda category: counts[category])
        # Company earnings with currency amounts belong to stocks, not '시장'.
        if len(STOCK_FINANCIAL.findall(fragment)) >= 2:
            best = '종목'
        if not counts[best]:
            continue
        score = 2 * counts[best] + 2 * min(len(re.findall(r'\d+(?:\.\d+)?%?', fragment)), 3)
        score += int(bool(CHANGE.search(fragment))) + 3 * int(any(fragment in hint for hint in hints))
        buckets[best].append((-score, order, fragment))

    available = [category for category, rows in buckets.items() if rows]
    if not available:
        return [FALLBACK]
    for category in available:
        buckets[category].sort()
    picked = {category: [] for category in CATEGORIES}
    # Give each present topic one source fact before filling extra lines.
    for category in available:
        picked[category].append(buckets[category].pop(0)[2])
    while sum(map(len, picked.values())) < 5:
        options = [
            (rows[0][0], rows[0][1], category)
            for category, rows in buckets.items()
            if rows and len(picked[category]) < (2 if len(available) > 1 else 5)
        ]
        if not options:
            break
        _, _, category = min(options)
        picked[category].append(buckets[category].pop(0)[2])
    return [f'[{category}] {excerpt}' for category in CATEGORIES for excerpt in picked[category]]
