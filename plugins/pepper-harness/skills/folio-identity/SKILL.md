---
name: folio-identity
description: Use for Folio xx brand, Home visual identity, System/Light/Dark theme, loading screen, responsive mobile/iPad treatment, PWA icon/manifest and Robinhood-benchmark UI work.
---

Read `docs/harness/CONTRACT.md`, `docs/harness/HANDOFF.md` and `docs/design/FOLIO_IDENTITY_V2.md` before editing.

Hard rules:
- The attached column 02 “Sunset Editorial” (B) concept is the visual source of truth on desktop, mobile and iPad. Do not reinterpret it into a new Folio style.
- Wordmark must match B as a clean lockup: live `Folio` typography plus the original interlocked vector `src/components/FolioMark.tsx`. Raster/screenshot wordmarks, pasted B-board lettering, plain text xx and alternate symbols are prohibited.
- Primary installed-app icon uses B's near-black tile + small centered interlocked xx. `scripts/generate-b-app-icons.mjs` must rasterize the original vector geometry procedurally (31.25% width, ~1.72:1), never read a raster mark source.
- Loading uses `public/folio-b-launch-hero.webp` with restrained GSAP reveal/pan only and must never display the internal concept label “Sunset Editorial”.
- Typography follows Inter / Neue-Grotesk editorial proportions: clean grotesk, regular large numerals, tight display tracking, restrained uppercase metadata.
- B motif = original vector `public/folio-b-motif.svg`: monochrome rock/coast, lone figure, sparse technical line work and isolated warm sun/disc. Do not paste/crop the concept-board image.
- Fluid Market/C is not a UI theme. C is limited to photography treatment through `public/folio-c-photography.webp`: warm sunset light, shallow depth/bokeh and human-scale optimism.
- Robinhood is a benchmark for hierarchy, simplicity, familiar navigation and progressive disclosure only. Do not copy its branding, colours or trade-entry UI.
- Analysis Hub owns the deep path: 핵심/후보/전환/전체/Position scope → one visible stock list → unchanged PriceRsChart composition → Overview/Swing/Position → 내 분석. Do not restore the old Focus roster + 추가 보기 duplication or nested analysis disclosures.
- 3D is restricted to the shallow Leadership Pulse presentation. It must not change counts, ranking, classification or imply a new score.
- Preserve System / Light / Dark and persisted theme behavior.
- Preserve semantic finance colours and all investment logic. Brand colour never changes gain/loss meaning, leadership class, RS, stage, sector rank or Position Growth rules.
- Compact Dashboard uses the Folio brand bar rather than a duplicate Dashboard titlebar. Touch iPad follows the same B language.
- The launch screen is Folio-only: no Peppercorn logo/text co-branding and no `logo.webp`.
- Superseded `folio-app-icon-*`, `folio-icon-*`, `folio-identity-*`, generic `icon-*`, legacy wordmark and old Apple-touch assets must stay deleted.
- The visual identity regression gate is fixed at 390 / 834 / 1366 / 1440 CSS px.

Workflow:
1. Inspect the authoritative B artwork and shared source components before editing.
2. Keep one information hierarchy across breakpoints; change density, not identity or meaning.
3. Verify phone 390px, iPad 834px, touch iPad Pro 1366px and desktop 1440px, including Light and Dark where affected.
4. Run `npm run harness:check`, `npm run build`, `npm run test:visual-identity`, `npm run test:identity`, then the relevant/full `npm run test:ui`.
5. Report measured behavior and exact test outcomes. Physical Safari remains unverified unless actually tested.

Resolve paths from the Peppercorn repository root. If installed as a plugin outside Peppercorn, locate the repository first; do not apply these policies to another project.
