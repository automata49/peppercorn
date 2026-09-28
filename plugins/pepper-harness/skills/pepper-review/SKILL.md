---
name: pepper-review
description: Use for Pepper acceptance review, Claude Code to Codex handoff and regression verification.
---

Read docs/harness/CONTRACT.md and docs/harness/HANDOFF.md. Review only the assigned diff and dependent execution path. Prioritize real regressions and unsupported completion claims. Run relevant gates. Return severity, file, reproduction and evidence. Update the handoff with exact commands, outcomes and remaining work; never overwrite another writer.

Resolve paths from the Peppercorn repository root. If installed as a plugin outside Peppercorn, locate the repository first; do not apply its policies to another project.
