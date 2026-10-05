---
name: pepper-ui
description: Use for Pepper responsive layout, typography, navigation, tables, Dashboard, stock dialog and visual-regression changes.
---

Read the UI/formatting sections in `docs/harness/CONTRACT.md`. For Folio brand/Home/theme/loading/PWA work also read `docs/design/FOLIO_IDENTITY_V2.md` and use the `folio-identity` skill.

Locate the existing shared component and CSS tokens before editing. Reuse shared primitives such as `StockRows`, `DecisionList`, disclosures, navigation icons and table tokens. Preserve data/calculation contracts while changing presentation.

Responsive contract:
- Desktop, mobile and iPad share Sunset Editorial (B); compact layouts may change density and navigation placement but not switch to a different visual system.
- Dashboard compact hierarchy is brand → Total/KR/US → one leader hero/chart/periods → evidence → class summary → secondary sector/temperature/exploration.
- Touch targets, no-horizontal-overflow, progressive disclosure and System/Light/Dark behavior are acceptance criteria.
- C/Fluid Market colour is a restrained brand/photography accent, not chrome for cards/navigation.

Run `npm run build` and `npm run test:identity` for identity/responsive changes, then relevant/full `npm run test:ui`. Report measured layout and behavior, not a visual guess.

Resolve paths from the Peppercorn repository root. If installed as a plugin outside Peppercorn, locate the repository first; do not apply its policies to another project.
