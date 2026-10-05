# Folio motion architecture

Views compose reusable components; calculation and history loading remain in lib modules.

| Layer | Responsibility | Entry point |
| --- | --- | --- |
| Views | Select stock and open detail | App.tsx |
| Chart | History, benchmark, period and accessible scrub | components/PriceRsChart.tsx |
| Controls | Reusable period selection | components/PeriodToggle.tsx |
| Layout | ResizeObserver with cleanup | lib/useElementWidth.ts |
| Numbers | Exact text and changed-digit feedback | components/motion/AnimatedNumber.tsx |
| Interaction motion | Duration, easing, reduced motion and cancellation | motion/system.ts |
| Brand | Existing launch timeline | GSAP in App.tsx |

Use AnimatedNumber only for focal changing values, not every cell of a table. Values update immediately; animation never fabricates intermediate prices. Sheet and panel motion operates on the surface once; nested sections do not stagger. Reduced-motion disables JavaScript interactions. Existing CSS tokens continue to govern Radix overlays, menus and presses.

The digit effect is entry feedback, not an odometer. Period changes still reset chart exploration and render the exact new geometry; chart morph is not implemented in this change. Missing history and missing benchmark remain explicit. This layer does not interpret arbitrary server UI or add Lottie assets. Future renderable view models should reference an allowlisted component registry, not animation or executable code from the server.
