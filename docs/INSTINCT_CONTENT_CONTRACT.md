# Instinct → Folio content contract v1 (2026-10-26)

Instinct researches, writes JSON and finds image links. Folio validates, stores and
renders. No PDF/HTML export or per-reader AI calls are required. Existing PDFs and
version-1 public news remain supported; the report shelf stays in Market Signal.

## Copy to Instinct

기존 Drive 폴더 `1HdM3uXO3_cAnJS0igLlDIsCylch6KMey`에 실제 UTF-8
`application/json` 파일을 저장해줘. Google Doc이나 공유 링크를 대신 저장하지 마.

- 리포트: `Folio-Report-YYYY-MM-DD.json`. 같은 날 여러 건은
  `Folio-Report-YYYY-MM-DD-고유영문ID.json` 형식. JSON 구조는 아래 참조.
- 뉴스: 기존 `Folio-News-YYYY-MM-DD.json`, version 1, items 구조 유지.
- 같은 리포트의 `id`와 Drive 파일 ID를 유지하고 기존 파일 내용을 갱신해줘.
- PDF/HTML은 생성할 필요 없어. 리포트는 비공개, 뉴스 파일에는 공개 가능한
  사실 요약만 넣어줘. 개인 리포트 전문을 뉴스에 넣지 마.
- 요약은 최대 5개 문자열. [시장]/[산업]/[종목] 중 실제 존재하는 항목만 사용하고,
  리포트의 목적 설명 대신 사건·수치·변화를 적어줘. 사실과 전망을 구분해줘.
- 본문은 `sections` 배열에 `heading`, 일반 텍스트 `body`, 선택 `images`, `tables`.
  HTML·실행 스크립트는 넣지 마. Markdown 문법 대신 일반 텍스트로 작성해줘.
- 이미지마다 실제 `image_url`, 원문 `source_url`, `caption`, `credit`,
  `usage_rights`, `license_url`, `kind`(photo/chart/illustration)를 전달해줘.
  이용 조건 미확인은 `unknown`, 적합한 이미지가 없으면 `images: []`.
- 가능하면 Wikimedia Commons의 File 원문 페이지와 API 기준 원본 이미지 URL을
  사용해줘. 검색 결과/미리보기 링크는 쓰지 마. 링크·라이선스·저작자를 추정하지 마.
- 사진·차트 다운로드와 이미지 가공은 Folio가 담당해. 차트의 단위·기간·제목은
  유지하고, 표 데이터가 있으면 `tables`로도 전달해줘.
- `published_at`/`updated_at`은 실제 ISO 8601 시각과 UTC offset 포함.
  `sources`는 label/url, `tickers`는 market(US/KR)/ticker 배열.
- 지정 폴더에 파일이 실제 저장됐는지 확인해줘.

## Report JSON

See [synthetic format example](examples/Folio-Report-2026-10-26.json).
Do not publish the example as research. Fields `version:1`, `type:"report"`, `id`,
`title`, `published_at`, `updated_at`, `summary`, `sections` are required.
`tickers`, `sources`, section `images` and `tables` may be empty arrays.
Limits: 2 MB input, 60 sections, 500k body characters, 3 images/section,
60 images/report (5 MB combined optimized bytes), 5 tables/section, 12 columns × 100 rows/table. Table cells are strings; caption
must state units/time where applicable. No unverified recalculation/recreated charts.

Image object (on a report section or public news item):

```json
{
  "image_url": "https://upload.wikimedia.org/wikipedia/commons/REPLACE_WITH_ORIGINAL.png",
  "source_url": "https://commons.wikimedia.org/wiki/File:REPLACE_WITH_FILE_NAME.png",
  "caption": "이미지/차트의 실제 내용과 기준 시점",
  "credit": "원저작자",
  "usage_rights": "CC BY 4.0",
  "license_url": "https://creativecommons.org/licenses/by/4.0/",
  "kind": "chart"
}
```

## Folio processing

The existing four-hour/manual `instinct-drive-news.yml` has separate public-news
and private-report jobs. Drive readonly OAuth is reused. The private job uses the
existing server-only `SUPABASE_ACCESS_TOKEN` management credential. It never commits
reports, image bytes, titles or account IDs. No client or RLS changes are required.

Ownership comes only from existing `private_source_reports` rows for the registered
folder. One owner is selected automatically; for multiple owners set the GitHub
secret `FOLIO_REPORT_USER_ID` to an existing folder owner. Empty/ambiguous ownership
fails closed. Never choose the first auth user or trust an owner ID inside JSON.
The current database has an existing report owner, so no new account mapping is needed.

Unchanged/older Drive modification times skip downloads and writes, except pending transient image failures retry on the next sync. Unknown rights are retained as a stable fallback until image metadata changes. Logical report
IDs deduplicate replacement files while retaining the first database key; the reader
also links the latest actual JSON file. Corrections update derived text/tables/images.
Source deletion does not delete archived reports. Private text and optimized WebP
images live only in the existing RLS-protected pages JSON, matching legacy PDF image
storage; there is no new public image bucket or browser write endpoint.

Image fetches are credential-free HTTPS with public DNS/IP pinning on every redirect,
20-second deadline, 5 MB input, MIME/decoder/pixel/frame limits and EXIF-free WebP output.
Only Commons API-confirmed reuse licenses or publisher policies reviewed in
`analysis/instinct-image-policies.json` allow storage. A submitted rights claim alone
is not permission. Unknown/blocked/broken images retain the fallback without blocking
text. Charts use contain sizing and no photo filter; attribution and license links stay.

Public images are content-hashed local assets. Verified metadata is cached across
syncs; private image bytes never share that cache. Image fetches are capped at 12 per public job / 8 per private job. No image generation API call is necessary for these supplied links. Existing
conceptual illustration fallback is retained, but not generated for an article with
a verified supplied image.

## Acceptance

- Python: `python -m unittest analysis.test_instinct_images analysis.test_sync_instinct_reports analysis.test_sync_instinct_news analysis.test_news_visuals`
- DB: `node supabase/tests/source_reports.verify.mjs`
- Build and Harness; parser/browser source report and news tests.
- Operational: actual Instinct JSON in Drive, successful private job and same-owner
  authenticated reader. Fixtures are not evidence of live private ingestion.
