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
