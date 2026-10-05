---
name: folio-identity
description: Use for Folio xx brand, Home visual identity, System/Light/Dark theme, loading screen, responsive mobile/iPad treatment, PWA icon/manifest and Robinhood-benchmark UI work.
---

Read `docs/harness/CONTRACT.md`, `docs/harness/HANDOFF.md` and `docs/design/FOLIO_IDENTITY_V2.md` before editing.

Hard rules:
- Sunset Editorial (B) is the UI system on desktop, mobile and iPad: monochrome/warm-paper or near-black surfaces, editorial typography, flat rules, restrained spacing and minimal card chrome.
- Fluid Market/C is not a mobile UI theme. Keep it to photography/launch atmosphere, the gradient `xx` mark and small focus accents.
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
