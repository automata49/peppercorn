---
name: folio-identity
description: Use for Folio xx brand, Home visual identity, System/Light/Dark theme, loading screen, responsive mobile/iPad treatment, PWA icon/manifest and Robinhood-benchmark UI work.
---

Read `docs/harness/CONTRACT.md`, `docs/harness/HANDOFF.md` and `docs/design/FOLIO_IDENTITY_V2.md` before editing.

Hard rules:
- The attached column 02 “Sunset Editorial” (B) concept is the visual source of truth on desktop, mobile and iPad. Do not reinterpret it into a new Folio style.
- Wordmark must match B's bold Folio + compact angular/interlocked gradient xx; plain text xx is not a final substitute.
- Primary app icon must match B's near-black tile + small centered angular xx. Warm-sand is the only secondary icon treatment.
- Typography follows Inter / Neue-Grotesk editorial proportions.
- B motif = monochrome landscape/rock + sparse line work + isolated warm sun/disc. C's flowing wave is not a primary motif.
- Fluid Market/C is not a UI theme. C is limited to photography treatment: warm sunset light, shallow depth/bokeh and human-scale imagery.
- Robinhood is a benchmark for hierarchy, simplicity, familiar navigation and progressive disclosure only. Do not copy its branding, colours or trade-entry UI.
- Preserve System / Light / Dark and persisted theme behavior.
- Preserve semantic finance colours and all investment logic. Brand colour never changes gain/loss meaning, leadership class, RS, stage, sector rank or Position Growth rules.
- Active PWA references use only `folio-identity-180.png`, `-192.png`, `-512.png` and `-512-maskable.png`; generated assets come from `scripts/generate-folio-icons.mjs`.
- Compact Dashboard uses the Folio brand bar rather than a duplicate Dashboard titlebar. Touch iPad follows the same B language.

Workflow:
1. Inspect shared source components and tokens before adding overrides.
2. Keep one information hierarchy across breakpoints; change density, not meaning.
3. Verify phone 390px, iPad 834px, touch iPad Pro 1366px and desktop 1440px, including Light and Dark where affected.
4. Run `npm run harness:check`, `npm run build`, `npm run test:identity`, then the relevant/full `npm run test:ui`.
5. Report measured behavior and exact test outcomes. Physical Safari remains unverified unless actually tested.

Resolve paths from the Peppercorn repository root. If installed as a plugin outside Peppercorn, locate the repository first; do not apply these policies to another project.
