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

미국 공시의 과거 기준일 재현: `python collect.py --only US --as-of 2025-08-27 --out out-asof`. 선택한 SEC 수치의 수정 공시 후보는 `source_revisions`, 실제 분기 계산 입력은 `source_lineage`, 조회 시점은 `fetched_at`, 공시 제한 날짜는 `as_of`에 기록됩니다. 이는 현재 SEC API가 반환하는 제출 이력을 기준일로 필터링한 결과이며, 당시 API 응답 자체의 불변 보존본은 아닙니다. 같은 기간에 같은 날 다른 접수번호가 다른 금액을 공시하면 `source_conflicts`에 기록하고 `동일자 공시 충돌` 검사를 실패시킵니다. 선택은 공시일, 접수번호 순으로 API 응답 순서와 무관하게 고정됩니다. 한국 DART API는 현재 응답으로 과거 정정 전 수치를 복원할 수 없으므로 `--as-of` 실행을 거부합니다.

과거 PoC 아티팩트 대조: `python analysis/fundamentals/reconcile.py /path/to/fundamentals-poc.zip` (저장소 루트). 기준값과 확인 범위는 `docs/harness/SOURCE_RECONCILIATION.md`를 참고하세요. `methods.py`에 US와 KR FCF 방법 버전을 별도로 정의합니다. 출력 JSON에는 방법, 원천 응답 해시와 계산 항목별 입력 자료의 출처를 기록합니다. 서로 다른 방법의 FCF 마진을 하나의 시장 간 순위로 비교하지 않습니다. 각 시장별 자동 Position 판정은 해당 시장의 공시 범위 검증과 별도 기준·임계값 검증이 완료된 뒤에 켭니다.

## Position 테이블 적재 (서버 전용)

`python persist.py <collect 출력 폴더>` 는 드라이런입니다. `--apply` 는 `POSITION_SUPABASE_URL` 과 `POSITION_PIPELINE_JWT`(role=`position_pipeline`) 가 있을 때만 쓰며, 브라우저나 에이전트에 토큰을 넘기지 않습니다. 행은 추가 전용이고 같은 입력을 다시 실행해도 중복되지 않습니다. `--as-of` 결과와 오류 결과는 적재를 거부합니다. 자세한 규칙은 `docs/harness/POSITION_GROWTH.md` 의 Ingestion 절을 보세요.
