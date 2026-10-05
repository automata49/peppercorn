---
name: pepper-ui
description: Use for Pepper responsive layout, typography, navigation, tables, Dashboard, stock dialog and visual-regression changes.
---

Read the UI/formatting sections in `docs/harness/CONTRACT.md`. For Folio brand/Home/theme/loading/PWA work also read `docs/design/FOLIO_IDENTITY_V2.md` and use the `folio-identity` skill.

Locate the existing shared component and CSS tokens before editing. Reuse shared primitives such as `StockRows`, `DecisionList`, disclosures, navigation icons and table tokens. Preserve data/calculation contracts while changing presentation.

Responsive / identity contract:
- The attached column 02 Sunset Editorial (B) is the exact visual source of truth on desktop, mobile and iPad; compact layouts may change density and navigation placement but not identity.
- Use the committed B wordmark/icon/launch/motif artwork instead of recreating them with text, CSS X geometry or generic gradients.
- Dashboard compact hierarchy is brand → Total/KR/US → one leader hero/chart/periods → evidence → class summary → secondary sector/temperature/exploration.
- Touch targets, no-horizontal-overflow, progressive disclosure and System/Light/Dark behavior are acceptance criteria.
- C is photography treatment only through the committed C photography asset; it is not chrome for cards/navigation and its flowing-wave motif is not a Folio UI motif.
- Robinhood can inform hierarchy and interaction economy, never Folio branding or colour.

Run `npm run build` and `npm run test:identity` for identity/responsive changes, then relevant/full `npm run test:ui`. Report measured layout and behavior, not a visual guess.

Resolve paths from the Peppercorn repository root. If installed as a plugin outside Peppercorn, locate the repository first; do not apply its policies to another project.
