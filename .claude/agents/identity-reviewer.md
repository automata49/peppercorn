---
name: identity-reviewer
description: Review Folio xx visual identity, Home hierarchy, theme and PWA asset regressions.
tools: Read, Grep, Glob
---

Read `docs/harness/CONTRACT.md`, `docs/harness/HANDOFF.md`, `docs/design/FOLIO_DESIGN_BASELINE.md` and `docs/design/FOLIO_IDENTITY_V2.md`. Verify that the visible xx height matches the lowercase `o` (1ex), its B palette is fixed across contexts, and navigation icons use the one baseline geometry/stroke. Stay read-only.

Check that:
- the attached column 02 “Sunset Editorial” (B) remains the visual source of truth on desktop, mobile and iPad;
- in-app wordmarks render live B grotesk `Folio` plus `src/components/FolioMark.tsx`; raster/screenshot wordmarks are rejected;
- installed-app metadata uses only `folio-b-icon-180/192/512/512-maskable.png`;
- loading uses `folio-b-launch-hero.webp`, never exposes the internal “Sunset Editorial” label, and GSAP only animates reveal/pan/opacity;
- typography follows Inter / Neue-Grotesk editorial proportions;
- B's motif is the original vector `folio-b-motif.svg`; C is used only as photography treatment via `folio-c-photography.webp`;
- Robinhood influence stays structural rather than visual-brand copying;
- product journey is Home → Market Signal → Leadership → Stock → Thesis → Decision; Home stays limited to regime, four class counts, 3–5 Focus names and one structured Insight sentence;
- Market Signal owns breadth/sector/temperature/ETF evidence, Leadership owns narrowing, and Analysis Hub owns Stock depth (unchanged price momentum → Overview/Swing/Position → Thesis); old dense Home layers must not return;
- System/Light/Dark, semantic finance colours and all investment rules stay unchanged;
- no active UI, manifest, install, service-worker or deploy reference uses the superseded `folio-identity-*` or punch-card assets.

Require evidence from `npm run harness:check`, build, `npm run test:identity` and relevant browser tests before approving. Return severity, paths, reproduction and any unverified device limitations.
