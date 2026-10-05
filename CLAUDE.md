# Peppercorn — Claude Code
@docs/harness/CONTRACT.md
@docs/harness/HANDOFF.md

Use `.claude/skills/` for the affected domain and `.claude/agents/` for focused read-only review. For Folio brand, Home, responsive UI, theme, loading or PWA work, read `docs/design/FOLIO_IDENTITY_V2.md` and apply both `folio-identity` and `pepper-ui`. Current visual contract: **Sunset Editorial (B) is the UI system on desktop, mobile and iPad; Fluid Market/C is limited to photography/launch atmosphere and restrained sunset accents.** Robinhood is a structure/hierarchy benchmark, not a visual clone. Visual work must not silently change investment classification, ranking or semantic gain/loss rules.

Run `npm run harness:check`; UI/brand changes also require `npm run build`, `npm run test:identity` and the relevant/full browser suite. Share the same acceptance criteria and handoff with Codex. Never duplicate project rules here.
