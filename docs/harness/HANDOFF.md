# Current handoff

Task: dual-client engineering harness + dashboard stock/sector parity.
Base: main 1b03168 (2026-09-28).
Changes: reuse StockRows in dashboard, shared table tokens, correct signed high-distance display, full period columns, wide-screen sector selection in place, shared standards/skills/reviewer definitions/hooks/CI/offline analyst contract.
Scope: Analyst contract and eval infrastructure only; this checkout has no live AI Analyst provider. Position Growth remains the target specification, not a shipped valuation engine.
Validation: see final implementation evidence below; run `npm run harness:check`, `npm run build`, `npm run test:ui` after changes.
Next: connect a server-side analyst adapter against sourced fundamentals, retaining missing-data behavior; do not add API secrets to the frontend.

## 2026-09-28 follow-up
Merged upstream POC at 2189dc8 without conflicts. Reviewed run 36380836618 and downloaded artifact 10952184956. POC is collection-only, not a live AI service. See POST_POC_REVIEW.md for verified scope, corrected validation issues and ordered follow-up gates.
UI build and 5 Chromium viewport tests passed; Analyst offline contract: 12 cases passed. Physical iPad Safari and live provider not tested.

Fundamentals regression: 11 pytest cases passed (6 existing + 5 new). Quality failures now fail the collector job; missing SBC remains unknown; TTM requires the requested end and consecutive quarters.

## Position Growth requirements adoption — 2026-09-28
Source: https://drive.google.com/file/d/1p4ZjyGE_h6jGTmRH1fzunMUwbVvZjnbv/view?usp=drivesdk
Review: `docs/harness/POSITION_GROWTH.md` maps FR/DR/UI/HN and acceptance conditions to the existing Swing app and PoC. Existing shared CONTRACT remains canonical; five focused skills and four read-only role definitions per client support future work. Position AI citation and write-target gates are offline scaffolding, not live database enforcement.
Next: independently reconcile the PoC's NVDA/Samsung financial rows with official filings, settle ROIC/FCF conventions and acquisition coverage, then implement a reviewed migration and ingestion job. No Position labels should be displayed until a validated snapshot exists.
Validation: `npm run harness:check`; `python -m pytest -q analysis/fundamentals` for collector work; build/browser tests for UI work.

## 공시 기준행 대조 — 2026-09-28
`docs/harness/SOURCE_RECONCILIATION.md` records 10 independently sourced 2025 SEC/Samsung values matching the earlier PoC artifact. `analysis/fundamentals/official_reference_2025.json` + `reconcile.py` add a regression gate to the collector. SEC units and per-span tag selection and DART missing/nested debt handling were corrected; missing balance sheet items no longer silently enter ROIC/net debt as zeros. The existing cross-market FCF measure mixes NVIDIA PPE+intangibles and Samsung PPE-only, so it cannot support live comparative labels yet.
Next: reconcile remaining 7+ quarters per company, confirm each SEC acquisition line's scope, preserve immutable amendment history, validate market-specific rules and ROIC conventions, then implement the reviewed Supabase migration/ingestion job. Common US/KR CapEx scope is not required. Keep Position labels inactive until each market's gates pass.
Validation: run `python -m pytest -q analysis/fundamentals`, `npm run harness:check` and `python analysis/fundamentals/reconcile.py <artifact.zip>`. No production DB changes made in this step.

## Market-specific FCF and lineage — 2026-09-28
`analysis/fundamentals/methods.py` declares US-FCF-1 and KR-FCF-PPE-1. The collector emits the applicable version alongside input lineage and raw SHA-256; `quarters.py` records the source spans for quarter derivation. OpenDART receipt IDs are matched to filing dates from its disclosure search API; absent identity/date/hash fails collection QC. FCF remains a local, versioned measure. The US SEC tag alone does not prove which intangible assets are included. Neither market has enough independently reviewed history or calibrated thresholds for live verdicts. No Supabase schema or production data was changed.

## Historical SEC cutoff — 2026-09-28
SEC quarter and balance-sheet facts now support `as_of` filing-date cutoff and output `source_revisions` for every used field. `collect.py --only US --as-of YYYY-MM-DD` applies the cutoff to QC freshness; historical DART use is rejected until filing-specific archival is available. A later filing cannot be used to compute an earlier quarter in the US cutoff mode. Same-day conflicting SEC accessions, current-API backfills and historical DART amendments remain unresolved; no backtest or Position valuation should treat this as point-in-time certified data. Continue local market calibration, expanded official filing reconciliation and reviewed Position-only storage design before activation.
Validation: `python -m pytest -q analysis/fundamentals` and `npm run harness:check`. No production DB write in this step.

## SEC same-day tie policy — 2026-09-28
`sec.py` now orders amendments by filing date then accession, so a same-day tie no longer depends on API response order. A different accession filed the same day with a different amount is recorded in `source_conflicts`, and `collect.py` fails the `동일자 공시 충돌 (최근 8분기)` check. Offline only: 4 new cases (31 total) pass under pytest 8.4.2; the 3 SEC cases fail against the previous `sec.py`. `npm run harness:check` passed locally (12 Analyst, 14 Position AI cases). No UI change, so no build/browser run. No live SEC fetch, DB write or verdict.
Next: independently reconcile the remaining recent quarters against official filings, then market-specific ROIC conventions and thresholds; DART historical archival remains open.

## NVIDIA reference extension — 2026-09-28
`official_reference_2025.json` is now multi-period (`periods`, each with `filed`); `reconcile.compare(result, as_of)` checks only quarters filed by the cutoff. Added 5 NVIDIA quarters (6 total): 2024-10-27, 2025-04-27, 2025-10-26, 2026-04-26, 2026-07-26 from the primary 10-Qs. Read via a summarizing web fetch with cross-checks (prior-year columns, cumulative sums); not yet spot-checked by a person. Details and gaps in `SOURCE_RECONCILIATION.md`.
Open: fiscal Q4 quarters 2025-01-26 and 2026-01-25 (10-K fetch truncated before the statements); Samsung has 1 quarter (PDFs need a text extractor such as pypdf, not installed here); the live collector has not been compared with the new rows, so the first `fundamentals-poc` run may fail and should be inspected, not loosened.
Validation: `python -m pytest -q analysis/fundamentals` (33 passed), `npm run harness:check`.
