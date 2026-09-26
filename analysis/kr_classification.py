"""Korean investment classification from FnGuide's WICS company labels.

The hierarchy is the published WiseIndex WICS taxonomy. KRX/KIND Industry is
the company's legal listing industry and must not be combined with a different
provider's sector to imply a single parent/child classification.
"""

import html
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, timedelta

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

# WiseIndex publishes the constituent list for each WICS middle-group index.
# These codes are the published hierarchy's four-digit middle-group codes.
WICS_MIDDLE_CODES = {
    "G1010": ("에너지", "에너지"),
    "G1510": ("소재", "소재"),
    "G2010": ("산업재", "자본재"),
    "G2020": ("산업재", "상업서비스와공급품"),
    "G2030": ("산업재", "운송"),
    "G2510": ("경기관련소비재", "자동차와부품"),
    "G2520": ("경기관련소비재", "내구소비재와의류"),
    "G2530": ("경기관련소비재", "호텔,레스토랑,레저 등"),
    "G2550": ("경기관련소비재", "소매(유통)"),
    "G2560": ("경기관련소비재", "교육서비스"),
    "G3010": ("필수소비재", "식품과기본식료품소매"),
    "G3020": ("필수소비재", "식품,음료,담배"),
    "G3030": ("필수소비재", "가정용품과개인용품"),
    "G3510": ("건강관리", "건강관리장비와서비스"),
    "G3520": ("건강관리", "제약과생물공학"),
    "G4010": ("금융", "은행"),
    "G4020": ("금융", "증권"),
    "G4030": ("금융", "다각화된금융"),
    "G4040": ("금융", "보험"),
    "G4050": ("금융", "부동산"),
    "G4510": ("IT", "소프트웨어와서비스"),
    "G4520": ("IT", "기술하드웨어와장비"),
    "G4530": ("IT", "반도체와반도체장비"),
    "G4535": ("IT", "전자와 전기제품"),
    "G4540": ("IT", "디스플레이"),
    "G5010": ("커뮤니케이션서비스", "전기통신서비스"),
    "G5020": ("커뮤니케이션서비스", "미디어와엔터테인먼트"),
    "G5510": ("유틸리티", "유틸리티"),
}
if set(WICS_MIDDLE_CODES.values()) != {
    (industry, sector) for industry, sectors in WICS_HIERARCHY.items() for sector in sectors
}:
    raise ValueError("WICS middle-group codes and hierarchy disagree")


def parse_wics_label(page):
    match = re.search(r"<dt\b[^>]*>\s*WICS\s*:\s*([^<]+)</dt>", page, re.I)
    return html.unescape(match.group(1)).strip() if match else None


def _components(code, as_of):
    url = "https://www.wiseindex.com/Index/GetIndexComponets"
    response = requests.get(url, params={"ceil_yn": "0", "dt": as_of, "sec_cd": code},
                            timeout=18, headers={"User-Agent": "Mozilla/5.0"})
    response.raise_for_status()
    data = response.json()
    return data.get("list") or []


def _latest_wics_date():
    # The index constituents can be published several days after the trade date.
    # Probe recent Fridays to avoid treating a valid but unpublished day as empty.
    today = date.today()
    friday = today - timedelta(days=(today.weekday() - 4) % 7)
    if friday >= today:
        friday -= timedelta(days=7)
    for week in range(7):
        candidate = (friday - timedelta(weeks=week)).strftime("%Y%m%d")
        try:
            if len(_components("G45", candidate)) >= 100:
                return candidate
        except (requests.RequestException, ValueError) as exc:
            print(f"WICS index probe failed for {candidate}: {exc}")
    raise RuntimeError("No recent published WiseIndex WICS constituents (last seven Fridays)")


def fetch_wics_classifications(tickers):
    """Read published WICS middle-group constituents and verify each stock."""
    codes = sorted(set(tickers))
    as_of = _latest_wics_date()
    result = {}

    def fetch_group(code, category):
        for attempt in range(2):
            try:
                rows = _components(code, as_of)
                for row in rows:
                    if row.get("IDX_CD") != code or normalized(row.get("SEC_NM_KOR")) != normalized(category[0]):
                        raise ValueError(f"WiseIndex {code} returned an unexpected classification")
                return code, category, rows
            except (requests.RequestException, ValueError) as exc:
                if attempt:
                    print(f"WICS group unavailable for {code}: {exc}")
                else:
                    time.sleep(1)
        return code, category, []

    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = [pool.submit(fetch_group, code, category)
                   for code, category in WICS_MIDDLE_CODES.items()]
        for future in as_completed(futures):
            group_code, category, rows = future.result()
            for row in rows:
                ticker = str(row.get("CMP_CD") or "").zfill(6)
                if ticker not in codes:
                    continue
                if ticker in result and result[ticker] != category:
                    raise RuntimeError(f"Conflicting WICS classifications for {ticker}")
                result[ticker] = category

    # Individual pages cover edge cases absent from index constituents.
    missing = sorted(set(codes) - result.keys())
    if missing:
        print(f"WiseIndex {as_of}: {len(result)}/{len(codes)} from index; checking {len(missing)} company pages")

    def fetch(ticker):
        url = "https://navercomp.wisereport.co.kr/v2/company/c1010001.aspx"
        response = requests.get(url, params={"cmp_cd": ticker}, timeout=15,
                                headers={"User-Agent": "Mozilla/5.0 (Peppercorn universe classification check)"})
        response.raise_for_status()
        response.encoding = response.apparent_encoding
        return ticker, parse_wics_label(response.text)

    unresolved, unknown = [], {}
    with ThreadPoolExecutor(max_workers=5) as pool:
        futures = {pool.submit(fetch, ticker): ticker for ticker in missing}
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
                    unresolved.append(ticker)
            except (requests.RequestException, ValueError) as exc:
                unresolved.append(ticker)
                print(f"WICS unavailable for {ticker}: {exc}")
    print({"wics_as_of": as_of, "wics_requested": len(codes), "matched": len(result),
           "missing": len(unresolved), "unknown": unknown})
    if len(result) < len(codes) * 0.95:
        raise RuntimeError(f"WICS classification coverage below 95%: {len(result)}/{len(codes)}")
    return result, as_of
