# Source-backed Today cards

`analysis/leader_insights.py` publishes `dist/data/leader-insights.json` after the existing market snapshot in the Pages workflow. The same deployment runs after successful market refresh (existing pre-open / post-close schedules). It writes no Supabase tables or private workspaces, and never changes selection, rank, classification or financial values.

## Sources and scope

- Reviewed official RSS feeds: issuer registry, Apple, NVIDIA, SK hynix, Samsung, AMD and Dell. Registry: `config/leader-sources.json`.
- Only explicitly registered, public issuer feeds are collected. Unsupported tickers/ETFs retain the existing source-missing fallback; never infer news from a ticker or bypass a publisher's denied crawling. No Naver subscription, Telegram login, private Thesis, portfolio, or diary content is read or sent to a model. RSS/HTML URLs use reviewed HTTPS hosts, no credentials/alternate ports, redirect validation, public DNS checks, robots rules, time/byte limits. In managed environments a configured HTTPS proxy may resolve DNS; the fixed host boundary and TLS remain enforced. Wikimedia's documented query API is a separate machine endpoint, not an HTML crawler.
- Source publication, collection, generation and expiry remain distinct. Unknown/naive/future source dates are rejected; source age is at most 14 days and publication cache at most 48 hours. Old source dates are visible. Retained observations never get a new expiry just because a new deployment runs.

## AI

Default: **Gemini 2.5 Flash-Lite** using the server-side REST adapter. Official pricing documents a free tier, subject to project quotas and eligibility; use a free-tier project without paid billing if zero charges are required. No search-grounding or image-generation paid endpoint is used.

Add `GEMINI_API_KEY` in [repository Actions secrets](https://github.com/automata49/peppercorn/settings/secrets/actions). The connector used for this work cannot read or write repository secrets. Never use `VITE_` for a provider key, commit it, or paste it into the app. Only bounded public source text goes to the provider; no user records. Google's free-tier terms may use submitted public content for product improvement.

The adapter treats source content as untrusted data. It requires a four-field JSON response, an exact source ID and exact <=100-character/20-word evidence fragment, a <=70-character headline and <=180-character neutral summary. Generated URLs/HTML are rejected. Output is labelled **AI 요약 초안 · 사실 확인 필요**; it is not a verified financial analysis or investment instruction. Exact-fragment validation verifies source identity, not semantic entailment. The existing Analyst/Position live-quality gates are unchanged; news drafts never feed their grades or numbers. Quota/auth/contract failure stops provider calls and falls back to the source title. No key means `not_configured`, never a fabricated AI summary.

Live provider execution and Korean summary quality remain unverified until a real key is configured. Offline adapter tests are not a live model evaluation. Run one collection and review model/headline/summary/evidence/date manually before relying on drafts; they remain drafts even after this check.

## Images

Related photos: the Wikimedia Commons imageinfo query API supplies raster file, artist, license and source page. Search result ranking alone is insufficient: file title must include the issuer's reviewed image terms (e.g. Apple Park; AMD headquarters / Advanced Micro Devices rather than the ambiguous AMD acronym), and the client repeats this gate. This is a conservative filename relevance gate, not visual recognition; no matching result means no photo. Supported licenses are CC BY / CC BY-SA 2.0, 2.5, 3.0, 4.0, CC0 or Public domain. Both `upload.wikimedia.org` and the current `thumb.wikimedia.org` CDN are supported. No raw photo is copied into the repo; credited CDN images are displayed with `no-referrer`. Detail links the original page/license, identifies creator and notes card cropping. A related photo is explicitly **not the article's original photo**.

Original article photos: `og:image` is only used when a reviewed `image_permission` entry exists. Supply `license`, `creator`, `license_url`, `evidence_url`, and `image_hosts`. Hosts must already be in the code's reviewed issuer allowlist. The client requires the same permission record, source page and attribution. `Publisher permission` is supported only with issuer-hosted permission evidence. None of the initial publishers has a reviewed redistribution permission, so their OG images are not automatically reused. Mere publication of a photo is not permission. Missing/failed/unsupported photos revert to the approved Folio art with **원문 사진 아님**.

## Run and verify

```sh
python -m unittest analysis.test_leader_insights
python analysis/leader_insights.py --leaders dist/data/leaderboard.json --previous /tmp/previous-leader-insights.json
npm run build
npx playwright test tests/leader-insights.spec.ts tests/today-leaders.spec.ts
```

Collection is bounded to 20 issuers/provider calls and a 240-second network budget. Output is atomic; no raw body or credentials are persisted/logged. Collection failure cannot block the existing app deployment; cards fall back when no fresh manifest is produced. Run the existing harness, identity, four-screen and full UI gates. A code/PR update is not production activation: merge/deploy and a real provider key are separate operational steps.

Google News/Yahoo feed crawling was tested and rejected by their robots rules; those fallbacks are not enabled. Broader KR/US coverage requires reviewing additional issuer feeds in the registry.

Live read-only collection evidence and exact source/photo attribution: `docs/evidence/leader-source-smoke-20261011.json`. This file is review evidence, not an app snapshot.

Primary documentation checked 2026-10-11:
- https://ai.google.dev/gemini-api/docs/pricing#gemini-2.5-flash-lite
- https://ai.google.dev/api/generate-content
- https://generativelanguage.googleapis.com/$discovery/rest?version=v1beta (GenerationConfig responseJsonSchema / responseMimeType)
- https://www.mediawiki.org/wiki/API:Imageinfo
- https://commons.wikimedia.org/wiki/Commons:API/MediaWiki

## HS Academy public metadata (PREMIUM-INSIGHTS-1)

`python -m analysis.premium_insights` writes `dist/data/premium-insights.json` on the existing deployment/market-refresh workflow. Exact channel: https://contents.premium.naver.com/hsacademy/hsacademy1. Up to three article links, in listing order, are suggestions for reading, not stock recommendations or personalized ranking. This source is independent of the issuer/ticker feed. It reads public OG titles/descriptions only when robots permits access. It never opens a subscriber session or extracts paid bodies; missing dates remain explicitly unknown. Gemini drafts use only the public description, the existing schema/evidence validation, and a server-only Actions secret. No description means title-only. No invented summary or link is substituted on failure; expired (48h), malformed, foreign-channel or oversized feeds are rejected by the client. Collection errors retain a usable channel link in Today. Live Naver access and actual Gemini drafts require production evidence; unit fixtures do not prove activation.
