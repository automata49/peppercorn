# Peppercorn — Claude Code
@docs/harness/CONTRACT.md
@docs/harness/HANDOFF.md

Use `.claude/skills/` for the affected domain and `.claude/agents/` for focused read-only review. For Folio brand, Home, responsive UI, theme, loading or PWA work, read `docs/design/FOLIO_DESIGN_BASELINE.md` first, then `docs/design/FOLIO_IDENTITY_V2.md`, and apply both `folio-identity` and `pepper-ui`. Current visual contract: **Folio Sunset Editorial + Pebble Liquid Glass** on desktop, mobile and iPad. Supplied B wordmark/icon/launch/typography artwork remains pixel-authoritative; C remains photography treatment only. Warm Paper/Surface/Sand replaces generic white chrome, and Pebble Liquid Glass is reserved for the grouped stock-category selector (**대형주 / 중소형주 / 전체 / ETF**, with `/` before ETF). Robinhood is a structure/hierarchy benchmark, not a visual clone. Visual work must not silently change investment classification, ranking or semantic gain/loss rules.

Run `npm run harness:check`; UI/brand changes also require `npm run build`, `npm run test:identity` and the relevant/full browser suite. Share the same acceptance criteria and handoff with Codex. Never duplicate project rules here.
