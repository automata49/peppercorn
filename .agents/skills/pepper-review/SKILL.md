---
name: pepper-review
description: Use for Pepper acceptance review, Claude Code to Codex handoff, regression verification and completion claims.
---

Read `docs/harness/CONTRACT.md` and `docs/harness/HANDOFF.md`. For any UI/brand diff also read `docs/design/FOLIO_IDENTITY_V2.md`.

Review only the assigned diff and dependent execution path. Prioritize real regressions and unsupported completion claims.

For Folio identity work explicitly check:
- the current product system is **Folio Sunset Editorial + Pebble Liquid Glass** on desktop/mobile/iPad;
- exact supplied artwork is used for light/dark wordmark, installed icon, launch hero, Typography and Photography treatment;
- Paper `#F4F1EC` / warm Surface `#EFE9E3` / Warm Sand `#E8DED4` remain the Light hierarchy and generic pure-white chrome does not return;
- Pebble Liquid Glass stays restricted to the primary category selector: **대형주 / 중소형주 / 전체 / ETF**, with the first three grouped, a visible `/`, and ETF separate;
- Home **오늘의 시장** summarizes market breadth → leading sector → ETF RS leader and `전체 보기 →` opens **섹터 > ETF**;
- Home **오늘의 주도주** appears above **핵심 주도 / 주도 후보 / 강세 전환 / 조정 중**;
- **섹터 > ETF** keeps the sector heatmap, ETF industry map and ETF summary open by default, and Home ETF matches the same global market pool / `etf_rs_rank` order;
- C appears only as photography treatment; Inter/Neue-Grotesk editorial typography is preserved;
- System/Light/Dark still work;
- no stale punch-card, generic `folio-identity-*`, generic icon generator or Robinhood visual cloning is active;
- semantic gain/loss colours, touch/overflow behavior and investment logic are unchanged.

Run relevant gates. Identity changes require `npm run harness:check`, `npm run build`, `npm run test:identity` and the relevant/full browser suite before approval. Return severity, file, reproduction and evidence. Update the handoff with exact commands, outcomes and remaining work; never overwrite another writer.

Resolve paths from the Peppercorn repository root. If installed as a plugin outside Peppercorn, locate the repository first; do not apply its policies to another project.
