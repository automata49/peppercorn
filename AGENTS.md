# Peppercorn — Codex
Read `docs/harness/CONTRACT.md` before work and `docs/harness/HANDOFF.md` before continuing a task. Those shared documents govern UI, formatting, analysis and Pepper AI Analyst.

For Folio brand, Home, responsive UI, theme, loading or PWA work, read `docs/design/FOLIO_DESIGN_BASELINE.md` first, then `docs/design/FOLIO_IDENTITY_V2.md`, and use both `folio-identity` and `pepper-ui` from `.agents/skills/`. Current visual contract: **the attached column 02 Sunset Editorial (B) is the exact UI source of truth on desktop, mobile and iPad. Use the committed B wordmark/icon/hero/motif artwork; C is photography treatment only.** Robinhood is an information-architecture benchmark, never a visual clone. Do not change investment classification, ranking or semantic gain/loss rules as part of visual work.

Run `npm run harness:check`; for UI/brand changes also run `npm run build`, `npm run test:identity`, then the relevant/full browser suite. Use `.codex/agents/` reviewers for substantial cross-domain changes; keep one writer per file. Never claim an unrun test or unconfigured AI provider is active.
