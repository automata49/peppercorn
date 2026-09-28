# Fundamentals PoC

NVDA(SEC EDGAR)와 삼성전자(OpenDART)의 분기 재무를 수집해 Position Growth 지표(ROIC, FCF 마진, 성장률 등)가 계산되는지 확인하는 검증용 코드입니다. Supabase에는 쓰지 않습니다.

| 파일 | 역할 |
|---|---|
| `quarters.py` | 누적(YTD) 값 → 3개월 값 변환, TTM 합계 |
| `sec.py` | SEC companyfacts 수집·태그 매핑 |
| `dart.py` | OpenDART 전체 재무제표 수집·계정 매핑 |
| `metrics.py` | 지표 계산 + 수집 품질 검사 |
| `collect.py` | 실행 진입점, 결과 JSON/요약 출력 |
| `test_fundamentals.py` | 네트워크 없이 도는 변환 로직 테스트 |
| `official_reference_2025.json`, `reconcile.py` | SEC·삼성전자 공시의 과거 기준 행과 수집 결과 대조 |

## 준비 (GitHub → Settings → Secrets and variables → Actions)

- `SEC_USER_AGENT`: `Peppercorn Capital 본인이메일@example.com` 형식 (SEC 규정상 연락처 필수)
- `DART_API_KEY`: https://opendart.fss.or.kr 인증키 신청으로 발급

## 실행

Actions → **Fundamentals PoC (NVDA + Samsung)** → Run workflow. 실행 요약 화면에 검사표와 지표가 나오고, `fundamentals-poc` 아티팩트로 JSON을 받을 수 있습니다.

로컬: `cd analysis/fundamentals && SEC_USER_AGENT="..." DART_API_KEY=... python collect.py`

과거 PoC 아티팩트 대조: `python analysis/fundamentals/reconcile.py /path/to/fundamentals-poc.zip` (저장소 루트). 기준값과 확인 범위는 `docs/harness/SOURCE_RECONCILIATION.md`를 참고하세요. 현재 FCF는 국가별 CapEx 항목 범위가 달라 종목 간 비교나 자동 Position 판정에 사용할 수 없습니다.
