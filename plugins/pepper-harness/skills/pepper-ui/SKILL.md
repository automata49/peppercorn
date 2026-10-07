---
name: pepper-ui
description: Use for Pepper responsive layout, typography, navigation, tables, Dashboard, stock dialog and visual-regression changes.
---

Read the UI/formatting sections in `docs/harness/CONTRACT.md`. For Folio brand/Home/theme/loading/PWA work also read `docs/design/FOLIO_IDENTITY_V2.md` and use the `folio-identity` skill.

Locate the existing shared component and CSS tokens before editing. Reuse shared primitives such as `StockRows`, `DecisionList`, disclosures, navigation icons and table tokens. Preserve data/calculation contracts while changing presentation.

Responsive / identity contract:
- **Folio Sunset Editorial + Pebble Liquid Glass** is the current visual system on desktop, mobile and iPad. Supplied B identity artwork remains pixel-authoritative; compact layouts may change density and navigation placement but not identity.
- Use the committed B wordmark/icon/launch/motif artwork instead of recreating them with text, CSS X geometry or generic gradients.
- Dashboard hierarchy is brand → Total/KR/US → **오늘의 시장** signal summary → category selector → **오늘의 주도주** → leadership classes → Insight. `오늘의 시장 > 전체 보기` opens **섹터>ETF**. The Sector > ETF page keeps sector and ETF core analysis expanded.
- Touch targets, no-horizontal-overflow and System/Light/Dark behavior are acceptance criteria. Progressive disclosure remains for secondary/dense editors, but must not hide the core sector heatmap or ETF analysis on 섹터>ETF.
- Pebble Liquid Glass is reserved for the primary stock-category selector: **대형주 / 중소형주 / 전체 / ETF**, with a visible `/` before ETF. Keep translucent warm glass, blur/saturation, inset highlight and irregular beach-stone radii; do not turn ordinary cards into glass bubbles.
- C is photography treatment only through the committed C photography asset; it is not chrome for cards/navigation and its flowing-wave motif is not a Folio UI motif.
- Robinhood can inform hierarchy and interaction economy, never Folio branding or colour.

Run `npm run build` and `npm run test:identity` for identity/responsive changes, then relevant/full `npm run test:ui`. Report measured layout and behavior, not a visual guess.

Resolve paths from the Peppercorn repository root. If installed as a plugin outside Peppercorn, locate the repository first; do not apply its policies to another project.
