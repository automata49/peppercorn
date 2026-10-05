---
name: folio-identity
description: Use for Folio xx brand, Home visual identity, System/Light/Dark theme, loading screen, responsive mobile/iPad treatment, PWA icon/manifest and Robinhood-benchmark UI work.
---

Read `docs/harness/CONTRACT.md`, `docs/harness/HANDOFF.md` and `docs/design/FOLIO_IDENTITY_V2.md` before editing.

Hard rules:
- The attached column 02 “Sunset Editorial” (B) concept is the visual source of truth on desktop, mobile and iPad. Do not reinterpret it into a new Folio style.
- Wordmark must use the B artwork family: `public/folio-b-wordmark-light.webp` on light paper and `public/folio-b-wordmark-dark.webp` on dark/black surfaces. Plain text xx, the old punch-card mark, or a newly invented symbol is not a final substitute.
- Primary installed-app icon must use B's near-black tile + small centered angular xx: `folio-b-icon-180/192/512/512-maskable.png`. Do not regenerate it from generic X geometry.
- Loading must use `public/folio-b-launch-hero.webp`, the B top composition, with restrained GSAP reveal/pan only. Motion may animate the artwork but must not redesign it.
- Typography follows Inter / Neue-Grotesk editorial proportions: clean grotesk, regular large numerals, tight display tracking, restrained uppercase metadata.
- B motif = `public/folio-b-motif.webp`: monochrome landscape/rock + sparse technical line work + isolated warm sun/disc.
- Fluid Market/C is not a UI theme. C is limited to photography treatment through `public/folio-c-photography.webp`: warm sunset light, shallow depth/bokeh and human-scale optimism.
- Robinhood is a benchmark for hierarchy, simplicity, familiar navigation and progressive disclosure only. Do not copy its branding, colours or trade-entry UI.
- Preserve System / Light / Dark and persisted theme behavior.
- Preserve semantic finance colours and all investment logic. Brand colour never changes gain/loss meaning, leadership class, RS, stage, sector rank or Position Growth rules.
- Compact Dashboard uses the Folio brand bar rather than a duplicate Dashboard titlebar. Touch iPad follows the same B language.

Workflow:
1. Inspect the authoritative B artwork and shared source components before editing.
2. Keep one information hierarchy across breakpoints; change density, not identity or meaning.
3. Verify phone 390px, iPad 834px, touch iPad Pro 1366px and desktop 1440px, including Light and Dark where affected.
4. Run `npm run harness:check`, `npm run build`, `npm run test:identity`, then the relevant/full `npm run test:ui`.
5. Report measured behavior and exact test outcomes. Physical Safari remains unverified unless actually tested.

Resolve paths from the Peppercorn repository root. If installed as a plugin outside Peppercorn, locate the repository first; do not apply these policies to another project.
