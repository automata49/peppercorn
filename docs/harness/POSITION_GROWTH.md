# Position Growth adoption contract

Source: [Pepper Position Growth 요구 정의서 v0.1 (2026-09-28)](https://drive.google.com/file/d/1p4ZjyGE_h6jGTmRH1fzunMUwbVvZjnbv/view?usp=drivesdk). This file records the repository adaptation. `CONTRACT.md` remains the shared authority for both development clients; `CLAUDE.md` and `AGENTS.md` remain short entrypoints. The source document's as-is row saying skills do not exist is obsolete.

## Fit to the running app

| Requirement | Existing source | Adoption and gate |
|---|---|---|
| HN-01: shared rules | `CLAUDE.md`, `AGENTS.md` → `CONTRACT.md` | Keep one shared contract; both clients read this document when working on Position. Do not duplicate rules in `CLAUDE.md`. |
| HN-02: skills | `harness/skills`, generated `.claude/skills`, `.agents/skills`, plugin copy | Add five Position skills to canonical directory; `npm run harness:sync` copies them and CI detects drift. |
| HN-03: collector, analyst, valuator, red-team | `.claude/agents` Markdown; `.codex/agents` TOML | Add read-only specialists for targeted diff/evidence review. Running them is optional; no live AI model is provisioned. |
| HN-04: validation/protected tables | `scripts/harness/analyst.mjs`, CI, existing `price_daily`/`market_metrics` writers | Add Position AI output gate and allowed write target policy. A future writer must call them before saving; do not block the independent Swing jobs. Client edit hooks only run fast checks, not database permission enforcement. |
| HN-05: restricted writes | `supabase/schema.sql` uses RLS; GitHub Actions PoC has no DB writes | Use dedicated server-side credentials and table grants in a reviewed migration; never expose service credentials to browser or agent. This repository change does not create or apply that migration. |

| App boundary | Current reality | Required integration |
|---|---|---|
| Swing / Position | Swing derives `market_metrics`; Position is still a specification | Separate snapshot, criterion version, and UI states; no shared score or Swing threshold changes. |
| Legacy analysis | `stock_analyses` is per-user and RLS protected; `user_thresholds` contains Swing fields only | Keep it private. New public derived snapshots must not copy user notes. A Position threshold override needs a new schema and explicit permissions (P3). |
| Universe / audience | `instruments` + user-specific `watchlist` and `portfolio_positions` | Select targets server-side under appropriate authority, deduplicate by instrument; never publish a user's membership in a public table. |
| Collection | `analysis/fundamentals/` produces artifact JSON for two companies | Validate against filings, persist source identity, normalize periods and test idempotency before connecting the app. No live Position table, UI label or AI provider is currently active. |
| UI | React/Vite; dashboard and table formatting controlled by `CONTRACT.md` | Reuse typography/spacing tokens and source badges. Avoid placeholder Attractive/High labels. Show unavailable/check_failed while data is not ready. |

## Implementation order and acceptance

1. **Source and normalization (P1; FR-DATA-01–06,08, FR-QC, FR-CALC-01–09,11):** independently reconcile NVDA/Samsung figures in AC-1-2 to official filings, including accession and amendment dates. Define separate, versioned US/KR CapEx/FCF methods and validate each against its local source; no forced cross-market FCF definition. Record per-field units, currency, CFS/OFS, source tag and raw response hash. Acquire enough periods for requested growth metrics (3-year TTM CAGR may require 16 consecutive quarters plus an earlier comparison TTM). Offline checks include YTD→quarter, FY/Q4, tag switches, debt totals vs current portion, missing vs zero, stale/short histories and non-December year ends. QC failure sets `check_failed` and suppresses labels. Only then add a reviewed migration for `fundamentals_q` / metric snapshot and server-side idempotent writes. PoC output alone does not satisfy AC-1-1–1-5.
2. **Deterministic verdict (P1; FR-TYPE, FR-VAL, FR-JUDGE):** record `rules_version` and reproducible four-label reasons; type-specific Quality/Growth/Value thresholds and missing-data behavior belong in a versioned rule file. Price basis, share count, discount rate, terminal assumptions and sector exceptions must be explicit. For Cyclical, use cycle-normalized measures; no incremental ROIC/PEG decision. Re-running identical source and rules must yield identical results (AC-2-1–2-3).
3. **UI (P1; UI-01–03,05–07 numeric,09–12,20,30–32):** add Position tab and typed reads only after populated snapshots. Display the Type/Quality/Growth/Value labels, reasons, as-of/provenance and failure states. Leaderboard's Swing Leader + Position Attractive filter must exclude missing and failed snapshots. Verify mobile (400 px), iPad and desktop and existing dashboard parity; do not replace Swing UI (AC-3-1–3-3).
4. **AI and thesis (P2; FR-AI, FR-THESIS, remaining UI):** allow only cited extraction and editable drafts. Validate outputs against registered document IDs, sections, paragraphs and hashes before save; record model/run metadata, deduplicate by input hash and enforce a monthly spend ceiling. Thesis/Break rows belong to their authenticated owner under RLS; cross-user visibility is unacceptable (AC-4-1–4-4). NEW P/Q/C requires measured or source-backed proxies; otherwise show revenue/cost decomposition only.

## Decisions before implementation

| Source question / ambiguity | Decision gate |
|---|---|
| Q-01 ROIC invested capital; FR-CALC-05 Owner Earnings | Define cash exclusion and average capital; name FCF minus SBC as a proxy, not Buffett's maintenance CapEx based Owner Earnings. Preserve missing SBC. Apply versioned, market-specific FCF inputs and independent local thresholds; never infer common cross-market ranking. |
| Q-02/Q-03 type thresholds and Pepper growth | Backtest proposed type-specific thresholds and growth assumptions against historical filings without lookahead before publishing verdicts. |
| Q-04 existing `stock_analyses` | Keep owner-controlled notes separate; decide any migration of user content with a dedicated privacy review. |
| Q-05/Q-07 targets and fiscal calendar | Agree instrument scope and non-December reporting periods before AC-1-1; 8 quarters for QC does not guarantee 3-year CAGR. |
| Q-06 models/budget | Choose providers and monthly cap before enabling any paid extraction, with server-side credentials only. |
| FR-DATA-07 / valuation share basis | DART total shares do not equal weighted-average diluted shares; source the appropriate per-share denominator or suppress EPS-based outputs. |
| FR-QC-05 / FR-CALC-08 | Gross margin bounds and EBITDA-based debt ratios need sector exceptions and actual EBITDA components; if absent, mark undefined rather than infer. |
| NFR-09 Actions Node 24 | Audit action versions and pinned upgrades as separate workflow work; current workflows use checkout@v4/setup-node@v4/setup-python@v5. |

The source document's PoC figures and 10/10 checks are historical examples, not independent filing verification. `POST_POC_REVIEW.md` lists observed extraction risks and the previous 11-test baseline. Never mark an acceptance criterion complete from a schema fixture or a proposed table definition.
