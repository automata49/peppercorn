# Instinct.com → Folio MARKET & COMPANIES

## Source of truth / security boundary
Google Drive folder: https://drive.google.com/drive/folders/1HdM3uXO3_cAnJS0igLlDIsCylch6KMey
Folio-YYYY-MM-DD.pdf and other private report PDFs retain the existing private import path. The public news job reads only files named Folio-News-YYYY-MM-DD.json (application/json). Do not rename PDFs to news files. This path publishes vetted **public news metadata/AI summaries**, not Drive file links, full article text, user-private research or private images, to a public GitHub Pages JSON feed. Do not include confidential material in a Folio-News file.

## Instinct.com instruction (copy into your existing Instinct conversation)

Connect Google Drive to the account holding the Folio 리서치 리포트 folder. Save a UTF-8 JSON file directly in that folder named Folio-News-YYYY-MM-DD.json (Asia/Seoul date). Replace that day's file when updating rather than generating duplicates.

Collect recent original, attributable news for equities from Folio's current 주도 categories (핵심 주도 / 주도 후보 / 강세 전환 / 조정 중). Do not infer or invent leadership class: include market and exact ticker only; Folio maps to its own current classifications. Prefer verified original issuer/SEC/KRX announcements and reputable publishers; retrieve the *article publication time*, source name and original article HTTPS URL. Use factual 1–3 sentence Korean summaries from the **market, industry and company facts** (orders, shipments, earnings, products, capex, regulation, risks). No meta-description of what a report discusses, predictions, investment advice, copied full article or paywalled content. If no valid items, write an empty items list. No invented URLs/dates/tickers.

Use exactly this schema (no Markdown fences):
{
  "version": 1,
  "items": [
    {
      "market": "US",
      "ticker": "NVDA",
      "headline": "Original factual headline",
      "summary": "한국어로 검증된 사실을 간결하게 요약합니다.",
      "source_name": "Original publisher",
      "source_url": "https://publisher.example/article",
      "published_at": "2026-10-16T11:00:00Z"
    }
  ]
}
Keep headline <=120 chars, summary <=320, publisher <=100; only US uppercase tickers and six-digit KR tickers. Maximum 100 items per daily file. Save JSON as application/json, not a Google Doc or an instinct.com hosted link. Verify the file exists in the specified folder.

## Recurring sync configuration
This repository's GitHub Actions workflow runs every four hours and on manual dispatch. An authorized Google OAuth client must have the Drive readonly scope and access to the folder. Set GitHub Actions secrets: GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET, GOOGLE_DRIVE_REFRESH_TOKEN. Never send these in chat, source control, or browser. The service reads the named JSON files from the existing folder through Drive API, discards invalid, stale or unsafe entries, deduplicates sources, and commits **only** public/data/instinct-leader-news.json if the content changed. There is no ingestion until the secrets are configured and the workflow passes. Existing private PDFs are never downloaded by this job.

Folio's DiscoveryNews loads public/data/instinct-leader-news.json from its deployed assets, matches the exact market+ticker to the live leaderboard, requires the live leadership classification, and shows the original news link; original RSS is retained as a fallback. The news never changes leaderboard scores, stage, classification, watchlist or journal. Missing/invalid feeds fail closed and show the prior official news strip.

## Acceptance
1. Run Python test: python -m unittest analysis.test_sync_instinct_news
2. Save a schema-conformant Folio-News-YYYY-MM-DD.json in the registered folder with valid fresh source URL(s).
3. Manually dispatch GitHub Actions Instinct Drive leader news and verify successful run + public/data/instinct-leader-news.json commit.
4. Confirm deployed MARKET & COMPANIES shows the news only if live leaderboard contains market+ticker in a leadership category. Check dates, original links, responsive view and that old official RSS still loads if no valid custom news.
5. Confirm no private PDFs, Drive file links, credentials or account identifiers were committed.
