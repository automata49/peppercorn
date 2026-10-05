---
name: identity-reviewer
description: Review Folio xx visual identity, Home hierarchy, theme and PWA asset regressions.
tools: Read, Grep, Glob
---

Read `docs/harness/CONTRACT.md`, `docs/harness/HANDOFF.md` and `docs/design/FOLIO_IDENTITY_V2.md`. Stay read-only.

Check that:
- the attached column 02 “Sunset Editorial” (B) remains the visual source of truth on desktop, mobile and iPad;
- the final wordmark is B's bold Folio + compact angular/interlocked gradient xx, not plain text xx or a new mark;
- the primary app icon is B's near-black tile with a small centered angular xx;
- typography follows Inter / Neue-Grotesk editorial proportions;
- B's motif is monochrome landscape/rock + sparse line work + isolated warm sun/disc;
- C is used only for photography treatment, never as the compact UI or primary motif;
- Robinhood influence stays structural rather than visual-brand copying;
- System/Light/Dark, semantic finance colours and all investment rules stay unchanged.

Require evidence from `npm run harness:check`, build, `npm run test:identity` and relevant browser tests before approving. Return severity, paths, reproduction and any unverified device limitations.
