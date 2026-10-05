---
name: pepper-review
description: Use for Pepper acceptance review, Claude Code to Codex handoff, regression verification and completion claims.
---

Read `docs/harness/CONTRACT.md` and `docs/harness/HANDOFF.md`. For any UI/brand diff also read `docs/design/FOLIO_IDENTITY_V2.md`.

Review only the assigned diff and dependent execution path. Prioritize real regressions and unsupported completion claims.

For Folio identity work explicitly check:
- exact B artwork is used for light/dark wordmark, app icon, launch hero and motif;
- C appears only as photography treatment;
- Inter/Neue-Grotesk editorial typography is preserved;
- desktop/mobile/iPad all remain Sunset Editorial B;
- System/Light/Dark still work;
- no stale punch-card, generic `folio-identity-*`, generic icon generator or Robinhood visual cloning is active;
- semantic gain/loss colours, touch/overflow behavior and investment logic are unchanged.

Run relevant gates. Identity changes require `npm run harness:check`, `npm run build`, `npm run test:identity` and the relevant/full browser suite before approval. Return severity, file, reproduction and evidence. Update the handoff with exact commands, outcomes and remaining work; never overwrite another writer.

Resolve paths from the Peppercorn repository root. If installed as a plugin outside Peppercorn, locate the repository first; do not apply its policies to another project.
