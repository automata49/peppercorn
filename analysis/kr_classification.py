"""Korean investment classification from FnGuide's WICS company labels.

The hierarchy is the published WiseIndex WICS taxonomy. KRX/KIND Industry is
the company's legal listing industry and must not be combined with a different
provider's sector to imply a single parent/child classification.
"""

import html
import re
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests

WICS_HIERARCHY = {
    "에너지": {"에너지": "에너지장비및서비스|석유와가스"},
    "소재": {"소재": "화학|포장재|비철금속|철강|종이와목재"},
    "산업재": {
        "자본재": "우주항공과국방|건축제품|건축자재|건설|가구|전기장비|복합기업|기계|조선|무역회사와판매업체",
        "상업서비스와공급품": "상업서비스와공급품",
        "운송": "항공화물운송과물류|항공사|해운사|도로와철도운송|운송인프라",
    },
    "경기관련소비재": {
        "자동차와부품": "자동차부품|자동차",
        "내구소비재와의류": "가정용기기와용품|레저용장비와제품|섬유,의류,신발,호화품|화장품|문구류",
        "호텔,레스토랑,레저 등": "호텔,레스토랑,레저|다각화된소비자서비스",
        "소매(유통)": "판매업체|인터넷과카탈로그소매|백화점과일반상점|전문소매",
        "교육서비스": "교육서비스",
    },
    "필수소비재": {
        "식품과기본식료품소매": "식품과기본식료품소매",
        "식품,음료,담배": "음료|식품|담배",
        "가정용품과개인용품": "가정용품",
    },
    "건강관리": {
        "건강관리장비와서비스": "건강관리장비와용품|건강관리업체및서비스|건강관리기술",
        "제약과생물공학": "생물공학|제약|생명과학도구및서비스",
    },
    "금융": {
        "은행": "은행", "증권": "증권", "다각화된금융": "창업투자|카드|기타금융",
        "보험": "손해보험|생명보험", "부동산": "부동산",
    },
    "IT": {
        "소프트웨어와서비스": "IT서비스|소프트웨어",
        "기술하드웨어와장비": "통신장비|핸드셋|컴퓨터와주변기기|전자장비와기기|사무용전자제품",
        "반도체와반도체장비": "반도체와반도체장비",
        "전자와 전기제품": "전자제품|전기제품",
        "디스플레이": "디스플레이 패널|디스플레이 장비 및 부품",
    },
    "커뮤니케이션서비스": {
        "전기통신서비스": "다각화된통신서비스|무선통신서비스",
        "미디어와엔터테인먼트": "광고|방송과엔터테인먼트|출판|게임엔터테인먼트|양방향미디어와서비스",
    },
    "유틸리티": {"유틸리티": "전기유틸리티|가스유틸리티|복합유틸리티|독립전력생산및에너지거래"},
}


def normalized(label):
    return re.sub(r"\s+", "", label or "")


WICS_DETAIL = {}
for industry, sectors in WICS_HIERARCHY.items():
    for sector, details in sectors.items():
        for detail in details.split("|"):
            key = normalized(detail)
            if key in WICS_DETAIL and WICS_DETAIL[key] != (industry, sector):
                raise ValueError(f"Ambiguous WICS category: {detail}")
            WICS_DETAIL[key] = (industry, sector)


def parse_wics_label(page):
    match = re.search(r"<dt\b[^>]*>\s*WICS\s*:\s*([^<]+)</dt>", page, re.I)
    return html.unescape(match.group(1)).strip() if match else None


def fetch_wics_classifications(tickers):
    """Fetch each stock's published WICS label; fail closed on coverage drift."""
    codes = sorted(set(tickers))

    def fetch(ticker):
        url = "https://navercomp.wisereport.co.kr/v2/company/c1010001.aspx"
        response = requests.get(url, params={"cmp_cd": ticker}, timeout=30,
                                headers={"User-Agent": "Mozilla/5.0 (Peppercorn universe classification check)"})
        response.raise_for_status()
        return ticker, parse_wics_label(response.text)

    result, missing, unknown = {}, [], {}
    with ThreadPoolExecutor(max_workers=5) as pool:
        futures = {pool.submit(fetch, ticker): ticker for ticker in codes}
        for future in as_completed(futures):
            ticker = futures[future]
            try:
                _, detail = future.result()
                category = WICS_DETAIL.get(normalized(detail))
                if category:
                    result[ticker] = category
                elif detail:
                    unknown[ticker] = detail
                else:
                    missing.append(ticker)
            except (requests.RequestException, ValueError) as exc:
                missing.append(ticker)
                print(f"WICS unavailable for {ticker}: {exc}")
    print({"wics_requested": len(codes), "matched": len(result),
           "missing": len(missing), "unknown": unknown})
    if len(result) < len(codes) * 0.95:
        raise RuntimeError(f"WICS classification coverage below 95%: {len(result)}/{len(codes)}")
    return result
