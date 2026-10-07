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
- Home **오늘의 시장** summarizes market breadth → leading sector → ETF RS leader and `전체 보기 →` opens **시장 신호**;
- Home **오늘의 주도주** appears above **핵심 주도 / 주도 후보 / 강세 전환 / 조정 중**;
- **시장 신호** keeps the sector heatmap, ETF industry map and ETF summary open by default, and Home ETF matches the same global market pool / `etf_rs_rank` order;
- C appears only as photography treatment; Inter/Neue-Grotesk editorial typography is preserved;
- System/Light/Dark still work;
- no stale punch-card, generic `folio-identity-*`, generic icon generator or Robinhood visual cloning is active;
- semantic gain/loss colours, touch/overflow behavior and investment logic are unchanged.

Run relevant gates. Identity changes require `npm run harness:check`, `npm run build`, `npm run test:identity` and the relevant/full browser suite before approval. Return severity, file, reproduction and evidence. Update the handoff with exact commands, outcomes and remaining work; never overwrite another writer.

Resolve paths from the Peppercorn repository root. If installed as a plugin outside Peppercorn, locate the repository first; do not apply its policies to another project.


- MARKET-COLORS-1 / FLAT-METRICS-1 / PEBBLE-REGIONS-1 (user decision 2026-10-07): The secondary destination is **시장 신호**, retaining expanded sector → ETF content and Home's existing full-view link. KR signed changes use red gains / blue losses; US uses green gains / red losses. The nearest instrument/sector market owns colours, including mixed-market rows, daily/live returns, detail, grids and market-specific heatmap legends; zero/missing stays neutral. Colours are display-only and never alter ranking, classification or pass/fail status. Major regions (including 오늘의 주도주) and all four leadership controls share Pebble Liquid Glass: translucent paper-based fill, blur/saturation, inset highlight and beach-stone radii. Nested numerical metrics stay unboxed; non-gradient surfaces share the same theme paper base. This supersedes the prior selector-only glass restriction and flat major-region styling.

- LEADERSHIP-GLASS-2 (user decision 2026-10-07 18:58 KST): Home and Explore controls **핵심 주도 / 주도 후보 / 강세 전환 / 조정 중** use the same borderless Liquid Glass rounded rectangles (24px radius), never oval/percentage radii or coloured edge strips. Explore's group wrapper is unboxed with spacing between controls. Selected state uses a subtle coral-tinted glass fill and readable theme ink, never the legacy black fill; keyboard focus remains visible. Labels/counts retain safe padding, minimum touch sizes, and Light/Dark readability. This overrides beach-stone geometry for these four controls only; stock-category pebbles and major-region styling stay unchanged.
