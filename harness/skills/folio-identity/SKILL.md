---
name: folio-identity
description: Use for Folio xx brand, Home visual identity, System/Light/Dark theme, loading screen, responsive mobile/iPad treatment, PWA icon/manifest and Robinhood-benchmark UI work.
---

Read `docs/harness/CONTRACT.md`, `docs/harness/HANDOFF.md`, **`docs/design/FOLIO_DESIGN_BASELINE.md` first**, then `docs/design/FOLIO_IDENTITY_V2.md` before editing.

Hard rules:
- The seven identity files supplied by the user on 2026-10-07 are the pixel source of truth. Do not reconstruct or regenerate them from the older concept board.
- Wordmark must use `public/folio-brand-wordmark-light.webp` / `public/folio-brand-wordmark-dark.webp` through `FolioWordmark`. Do not restore live `Folio` + `FolioMark.tsx`, plain-text xx, or newly generated lettering.
- Primary installed-app icons `folio-b-icon-*` are static size derivatives of `public/folio-brand-icon-black.webp`. `scripts/generate-b-app-icons.mjs` is verification-only and must not draw a new mark. The supplied glossy/light icon files are approved reference variants.
- Loading uses the supplied portrait `public/folio-brand-launch.webp` at **9:16** with restrained GSAP reveal/pan only. It already contains Folio branding, so no second caption/footer wordmark may overlay it.
- Home identity imagery uses the supplied `public/folio-brand-typography.webp` and `public/folio-brand-photography.webp`; the former generated motif SVG and old C photography file are retired.
- Typography in functional UI follows Inter / Neue-Grotesk editorial proportions: clean grotesk, regular large numerals, tight display tracking, restrained uppercase metadata.
- Light is the first-run/default appearance. System and Dark remain explicit user selections; OS dark preference must not silently override a fresh Folio session.
- Robinhood is a benchmark for hierarchy, simplicity, familiar navigation and progressive disclosure only. Do not copy its branding, colours or trade-entry UI.
- DISCOVERY-JOURNEY-2 owns Home (market facts + up to five Focus stocks) → Explore (one visible filtered list) → Detail (unchanged PriceRsChart) → Thesis (existing analysis records by exact id) → Tracking (Watchlist / Portfolio / Journal). Market Signal owns secondary sector/ETF/temperature tools. The approved structural mockup never replaces supplied identity pixels. Detail owns the deep path: 핵심/후보/전환/전체/Position scope → one visible stock list → unchanged PriceRsChart composition → Overview / Analysis / Financials / Thesis. Overview owns deterministic Folio Insight, Analysis owns leadership/Swing evidence, Financials owns Position filing evidence, Thesis owns user judgement. Do not restore duplicate Focus/추가 보기 layers.
- 3D is restricted to the shallow Leadership Pulse presentation. It must not change counts, ranking, classification or imply a new score.
- Preserve System / Light / Dark and persisted theme behavior.
- Preserve semantic finance colours and all investment logic. Brand colour never changes gain/loss meaning, leadership class, RS, stage, sector rank or Position Growth rules.
- Compact Dashboard uses the Folio brand bar rather than a duplicate Dashboard titlebar. Touch iPad follows the same B language.
- The launch screen is the supplied Folio hero only: no overlay caption/footer, Peppercorn logo/text co-branding, or `logo.webp`.
- Superseded `folio-app-icon-*`, `folio-icon-*`, `folio-identity-*`, generic `icon-*`, legacy wordmark and old Apple-touch assets must stay deleted.
- The visual identity regression gate is fixed at 390 / 834 / 1366 / 1440 CSS px.
- Level-0 sizes/spacing/icon/wordmark/app-icon rules come from `src/design/folio-baseline.css`. Do not append a new “quality pass / V4 / V5” override block; change the baseline token or owning component and add regression coverage.

Workflow:
1. Inspect the authoritative B artwork and shared source components before editing.
2. Keep one information hierarchy across breakpoints; change density, not identity or meaning.
3. Verify phone 390px, iPad 834px, touch iPad Pro 1366px and desktop 1440px, including Light and Dark where affected.
4. Run `npm run harness:check`, `npm run build`, `npm run test:visual-identity`, `npm run test:identity`, then the relevant/full `npm run test:ui`.
5. Report measured behavior and exact test outcomes. Physical Safari remains unverified unless actually tested.

Resolve paths from the Peppercorn repository root. If installed as a plugin outside Peppercorn, locate the repository first; do not apply these policies to another project.
