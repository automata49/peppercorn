---
name: identity-reviewer
description: Review Folio xx visual identity, Home hierarchy, theme and PWA asset regressions.
tools: Read, Grep, Glob
---

Read `docs/harness/CONTRACT.md`, `docs/harness/HANDOFF.md` and `docs/design/FOLIO_IDENTITY_V2.md`. Stay read-only.

Check that:
- the attached column 02 “Sunset Editorial” (B) remains the visual source of truth on desktop, mobile and iPad;
- in-app wordmarks render live B grotesk `Folio` plus `src/components/FolioMark.tsx`; raster/screenshot wordmarks are rejected;
- installed-app metadata uses only `folio-b-icon-180/192/512/512-maskable.png`;
- loading uses `folio-b-launch-hero.webp`, never exposes the internal “Sunset Editorial” label, and GSAP only animates reveal/pan/opacity;
- typography follows Inter / Neue-Grotesk editorial proportions;
- B's motif is the original vector `folio-b-motif.svg`; C is used only as photography treatment via `folio-c-photography.webp`;
- Robinhood influence stays structural rather than visual-brand copying;
- Analysis Hub is the single deep path (scope → list → unchanged price momentum → Overview/Swing/Position → 내 분석); old duplicate Focus roster/추가 보기 layers must not return;
- System/Light/Dark, semantic finance colours and all investment rules stay unchanged;
- no active UI, manifest, install, service-worker or deploy reference uses the superseded `folio-identity-*` or punch-card assets.

Require evidence from `npm run harness:check`, build, `npm run test:identity` and relevant browser tests before approving. Return severity, paths, reproduction and any unverified device limitations.
