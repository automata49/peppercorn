---
name: position-growth
description: Use for Peppercorn Position Growth data, deterministic business type and Quality/Growth/Value labels, valuation, or UI integration.
---

Read `docs/harness/CONTRACT.md` and `docs/harness/POSITION_GROWTH.md` before implementation. Identify the phase and its acceptance checks. Read `docs/harness/POST_POC_REVIEW.md` when touching SEC/DART ingestion or metrics.

Keep Swing and Position rules independent. Reconcile source period, filing date, accession, unit, currency and amendment before computing. Missing values remain unknown; QC failure suppresses labels. Compute metrics in code, version rules and assumptions, and never average the four labels into a score. Type-specific cyclical treatment is required. Do not show a Position verdict before a validated snapshot exists.

Only a server-side Position pipeline may write its dedicated tables, using `scripts/harness/position-write.mjs` as the write target gate. Run `npm run harness:check`, relevant offline fundamentals tests, and build/browser checks if UI changed. Report which acceptance criteria were actually verified.
