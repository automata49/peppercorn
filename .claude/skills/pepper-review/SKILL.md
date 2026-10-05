---
name: pepper-review
description: Use for Pepper acceptance review, Claude Code to Codex handoff, regression verification and completion claims.
---

Read `docs/harness/CONTRACT.md` and `docs/harness/HANDOFF.md`. For any UI/brand diff also read `docs/design/FOLIO_IDENTITY_V2.md`.

Review only the assigned diff and dependent execution path. Prioritize real regressions and unsupported completion claims. For identity work explicitly check: B consistency across desktop/mobile/iPad, System/Light/Dark, launch/wordmark/PWA assets, no stale punch-card references, no Robinhood visual cloning, semantic gain/loss colours, touch/overflow behavior and unchanged investment logic.

Run relevant gates. Identity changes require `npm run harness:check`, `npm run build`, `npm run test:identity` and the relevant/full browser suite before approval. Return severity, file, reproduction and evidence. Update the handoff with exact commands, outcomes and remaining work; never overwrite another writer.

Resolve paths from the Peppercorn repository root. If installed as a plugin outside Peppercorn, locate the repository first; do not apply its policies to another project.
