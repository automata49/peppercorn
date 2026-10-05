# Folio discovery redesign — 2026-10-05

## Source findings and interpretation

- [Metalab / Robinhood](https://www.metalab.com/work/robinhood): product-design case study. Its retrieved visual shows a dominant value, a restrained price chart, a selected date, and sparse navigation. The page does not disclose its implementation libraries. Folio independently adapts the focal hierarchy in a light theme; it does not copy Robinhood's assets or imply that the pictured future projection is historical data.
- [Robinhood design archive](https://robinhood.com/us/en/newsroom/category/design/): the current returned archive mixes newsroom categories. The substantive official [design story](https://robinhood.com/us/en/newsroom/the-top-secret-robinhood-design-story/) stresses useful information, mobile familiarity, simplicity and investor understanding.
- [Integrated content standards](https://robinhood.com/us/en/newsroom/the-power-of-integrated-content-standards/): content guidance belongs with reusable components, including when to use them. Folio uses short action labels, clear daily-price provenance, explicit missing states and one primary detail action.
- [Server Driven UI](https://robinhood.com/us/en/newsroom/how-server-driven-ui-is-helping-frontend-engineers-scale-impact/): describes typed view models, schema compatibility, component mapping and native composability. It also names payload/debugging/consistency costs. A multi-platform backend renderer is excessive for this static React app today.

## Applied design

| Surface | Before | After |
| --- | --- | --- |
| Home focus | Repeated counts and industry lists | One representative leader, actual daily chart, three evidence values, one detail action |
| Candidate browsing | All Focus rows in the initial reading flow | Up to four representative tabs; full unchanged Focus list behind an explicit disclosure |
| Phone market selection | Global and repeated section toggles | One visible global toggle; wider screens retain independent section toggles |
| Phone sectors | Vertical compact list | Horizontally scrollable sector tiles with ranking, RS and period returns |
| Motion | Shared generic feedback | Quiet selection/press feedback; reduced-motion respected |
| Presentation configuration | Client constants only | Versioned hosted JSON, component allowlist, bounded copy/count, whole-unit fallback |

The first representative is the first existing Focus result, not a new recommendation or score. The Focus filter, ordering, industry caps, classification and broad candidate counts remain unchanged. A preview count limits tabs only, never membership. The full list and canonical tables remain available.

## Hosted presentation boundary

`public/discovery-layout.json` is served by Pages and fetched without cache on mount with a three-second timeout. `src/lib/discoveryLayout.ts` accepts version 1 and `leader-spotlight` only. Copy has length bounds; preview count must be an integer between 1 and 12. Unknown versions/components, malformed payloads and failures preserve the local default. React renders plain text; the payload cannot supply code, URLs, ranking rules, trade actions or database writes.

This is a limited configuration-driven presentation section, not Robinhood's full backend-generated view-model platform. Updating its copy/count requires publishing the configuration; it requires no client-code change. New renderable components still need client code. Data is still read through Folio's existing public APIs. No Supabase migration, Edge deployment or service-role access is needed.

## Chart truth and interaction

The spotlight reads existing `price_daily` history through `usePriceHistory`, up to 51 closes. It displays actual close/currency/date, not a live quote and not a synthetic line interpolated from multi-period returns. Missing history has no invented graph. The fallback daily snapshot has no row date in the current `LeaderRow` contract and is labelled `일간 종가 · 날짜 미제공`. Chart-period change is calculated from the displayed first/last close and explicitly labelled `표시 구간`.

Pointer exploration and a 44px accessible range input select existing dates. Vertical touch scrolling remains enabled. Tabs support arrows, Home/End and roving focus. Selection resets for stock/market changes. The primary action uses the existing stock-detail flow.

## Verification

See the latest `docs/harness/HANDOFF.md` entry for actual executed commands and outcomes. Browser checks are Chromium simulations; physical iPad/iPhone Safari is not verified.
