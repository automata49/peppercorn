# Folio xx Visual Identity v2 — Robinhood benchmark

Decision date: 2026-10-05. This document records product-design principles, not a request to clone Robinhood.

## Design baseline authority

Implementation now follows [FOLIO_DESIGN_BASELINE.md](./FOLIO_DESIGN_BASELINE.md) as **Level 0**. This document still defines visual direction and information hierarchy, but sizes, spacing, icon metrics, wordmark geometry, touch targets, and app-icon masking rules must come from the baseline. Do not solve visual drift by appending another page-specific quality-pass override.

## Research method

Use [FOLIO_UI_RESEARCH.md](./FOLIO_UI_RESEARCH.md) for any Robinhood/platform benchmark. A reference must be converted into **evidence → reusable principle → Folio user intent → acceptance test**. Never copy brand styling, proprietary assets, wording, or trade-entry interaction merely because it exists in the reference.

Liquid Glass follows Apple’s functional-layer model: navigation, sticky controls, drawers/popovers and transient controls may use the glass tokens; analytical content remains on solid/standard surfaces. Light remains the fresh-install default.

## Benchmark: what Robinhood actually optimizes

Official Robinhood material consistently points to a small set of principles:

1. **Simple, intuitive, mobile-familiar.** Robinhood says its platform should be approachable regardless of experience and should use familiar mobile interaction patterns.
2. **Content-centric hierarchy.** Its design history emphasizes relevant information, clean typography and clear presentation so the user can make the decision rather than interpret the interface.
3. **Less is more.** The 2024 identity is rooted in black, white and neutrals, with one purposeful accent, sophisticated photography and an intentional modular layout system.
4. **One customer journey, secondary modules may degrade.** Robinhood's 2026 engineering writing describes the customer intent as a simple linear journey even when many services sit behind it. Folio applies the same product principle visually: the primary decision path must survive missing secondary information.
5. **Essential navigation stays obvious.** Robinhood introduced a bottom tab bar specifically to keep portfolio/watchlist/search and other frequent destinations easy to reach as the product expanded.
6. **Appearance is a product feature.** Robinhood exposes light, dark and system-aware appearance choices and an appearance preview. Folio keeps all three choices, with **Light as the first-run default** and System/Dark as explicit opt-in selections.

Official references:
- https://robinhood.com/us/en/policy/design/
- https://robinhood.com/us/en/newsroom/the-top-secret-robinhood-design-story/
- https://robinhood.com/us/en/newsroom/a-new-visual-identity/
- https://robinhood.com/us/en/newsroom/a-new-way-to-navigate-robinhood/
- https://robinhood.com/us/en/support/articles/accessibility-options/
- https://robinhood.com/us/en/careers/blog/customer-journey-the-first-principles-approach-to-sdlc/

## Authoritative visual reference

The **attached concept board's column 02 — “Sunset Editorial” (B)** is the source of truth for Folio UI identity. Do not reinterpret B into a new style. Generated moodboards, Robinhood screenshots and later exploratory visuals are references only and must never override the B column.

Exact B rules:
- **Wordmark:** bold black/white “Folio” plus the compact angular/interlocked double-x mark shown in B. Product UI renders “Folio” as live Inter / Neue-Grotesk typography and renders the xx from the original vector geometry in `src/components/FolioMark.tsx`. No screenshot crop, raster wordmark, pasted lettering or plain-text xx is allowed. The vector uses the B proportions and fixed plum → magenta → coral/amber transition and is the shared source-of-truth geometry for the visible mark. **In a wordmark the xx is lowercase-scale: its rendered height is 1ex, matching the lowercase “o” height, not the cap height.** Its layout box uses the vector's native **184:104 (~1.77:1)** aspect; never stretch X/Y independently.
- **App icon:** B's near-black rounded-square tile with the assertive centered angular xx mark. `scripts/generate-b-app-icons.mjs` rasterizes the same original interlocked vector geometry procedurally; it must not read a raster xx source. The approved-board mark occupies approximately **58% of tile width** with an approximately **1.77:1 bounding-box aspect**, optically centered. The central negative diamond is mandatory. The left x transitions Plum → Magenta; the right x transitions Magenta → Coral → Amber. Those colours are fixed and must not inherit the surrounding text colour. A warm-sand alternate may be used only as a preview, never as the primary installed icon.
- **Typography:** Inter / Neue-Grotesk style grotesk. Large headings are clean, confident and tightly set; captions use restrained uppercase tracking. Avoid decorative type or overly rounded fintech styling.
- **Compact fit:** phone launch keeps the source 508:235 B composition inside the safe horizontal frame; do not re-crop it into a tall portrait card. The home B motif is secondary and deliberately short on phone. Navigation icons use one quiet monoline system; active state may gain contrast but not become visibly chunky.
- **Phone optical lock:** compact header is 60px; phone `Folio` is 25px with an **x-height (1ex) interlocked xx**; top/bottom navigation icons are 20px monoline; active navigation uses a short 16px rule instead of a heavy filled state. The phone motif image stays at roughly 108–122px high so it supports the editorial system instead of taking over the screen.
- **Motif:** `public/folio-b-motif.svg` is an original vector construction of B's editorial language: monochrome rock/coast silhouette, lone human figure, sparse technical line work and an isolated warm sun/disc. It is not a crop or pasted artwork from the concept board. The flowing multicolour wave belongs to C and is not Folio's primary motif.
- **Photography:** C's photography *treatment* may be borrowed: warm sunset light, shallow depth of field, human-scale optimism, restrained blur/bokeh. It is photography treatment only, not a C UI system.
- **Palette:** Ink Black `#0B0B0D`, Warm Sand `#E8DED4`, Plum `#54265F`, Magenta `#A34F78`, Coral `#F06A45`, Amber `#F5A24A`. Warm off-white reading surfaces are allowed as B's paper field.
- **Semantic finance colours:** gain/loss colours remain functional and independent from the brand palette.

Robinhood is benchmarked only for product hierarchy, simplicity, familiar navigation and progressive disclosure. Its green, trade-entry visual language and branding are not Folio identity.

## Home information architecture

Folio’s product journey is now explicit:

**Home → Market Signal → Leadership → Stock → Thesis → Decision**

Home is deliberately shallow. Its primary content is limited to:

1. **Market regime** — a display-only synthesis of existing breadth/trend facts; never a new trading signal.
2. **Four leadership states** — 핵심 주도 / 주도 후보 / 강세 전환 / 조정 중.
3. **Today 3–5 Focus stocks** — names first; detailed RS/return/fundamental evidence is deferred.
4. **One Insight sentence** — currently labelled `AI INSIGHT · STRUCTURED` because it is deterministic synthesis, not a live generative model opinion.

Home does **not** show the former hero price chart, sector table, market-temperature card, ETF exploration, full Focus roster or dense period metrics. Total/KR/US remains a functional filter.

**Market Signal** owns market breadth, MA50/MA200 participation, 52W-high proximity, advance/decline, Sector Leadership, market temperature and optional ETF/heatmap exploration.

**Leadership** owns class/sector narrowing and a ranked stock list. It may show comparison metrics such as RS and a compact return, but it does not expose the full stock evidence stack.

**Stock** is the existing analysis surface. Detailed period returns, 52W position, Swing evidence, filed fundamentals and Position Growth appear only after a stock is chosen.

**Thesis** remains the user’s judgement area. **Decision** routes that thesis into the Journal/tracking workflow.

This is progressive disclosure: every deeper step adds evidence only after the user expresses intent.

## Analysis experience

Folio uses one linear analysis journey inspired by Robinhood's content-first simplicity, without copying its trade UI:

1. **Leadership scope:** 핵심 / 후보 / 전환 / 전체 / Position.
2. **Stock selection:** one persistent, readable list under search; no second hidden “목록에서 고르기” layer.
3. **Price momentum:** the existing `PriceRsChart` composition and interaction stay intact. Identity changes are limited to B typography, surfaces, rules and restrained accent use.
4. **Depth tabs:** Overview / Analysis / Financials / Thesis replace nested disclosures. Overview owns the structured Folio Insight and essential stats; Analysis owns leadership/Swing evidence; Financials owns filed Position fundamentals; Thesis owns the user's own judgement and record.
5. **Folio Insight:** is currently deterministic structured signal synthesis from loaded price/RS/filing data. It may look editorial and thesis-led, but must not be presented as a live generative-AI opinion until a provider passes the analyst contract/evals.
6. **My Thesis:** remains the user's judgement/record area and stays separate from automated evidence.

The 3D treatment is deliberately limited to the CSS-only Leadership Pulse: a shallow perspective ring that visualizes class counts. The ring and the three Core / Watch / Turnaround navigation cards are one decision surface; do not duplicate the same counts in a second summary block. It is presentation-only and never changes or implies an investment score.

## Mobile / iPad visual rule

Primary compact quick navigation follows the decision journey: **홈 / 신호 / 리더십 / Stock**. Watchlist, Portfolio, temperature, Leaderboard, Universe and Settings remain available through the drawer rather than competing in the four-slot quick nav.

Desktop, mobile and iPad all use B/Sunset Editorial. Warm editorial paper is the shell; the approved dark mobile/product boards permit near-black **focal investing surfaces** for Leadership Overview and Analysis so the analytical path feels concentrated and premium. Compact layouts use the same wordmark, app-icon family, typography, palette discipline and motif logic as desktop: warm-paper shell, near-black focal analysis surfaces, restrained sunset accents, text-led tabs, editorial evidence columns and list-like sector rows. Rounded-card accumulation, glowing gradients, chromatic navigation and C's flowing-wave UI are prohibited. C remains photography treatment only.

## Visual Identity cleanup lock

The active product identity is **Folio xx / Sunset Editorial B only**. Peppercorn may remain a repository or company/project name, but it is not a second visible brand in the app shell or launch screen.

- Active visual assets are limited to the live/vector B wordmark, procedurally generated B app-icon family, B launch hero, original vector B motif and the explicitly secondary C photography-treatment image.
- Superseded punch-card, generic `folio-icon-*`, generated `folio-identity-*`, old `folio-app-icon-*`, legacy wordmark and generic `icon-*` assets must not remain in deployable source/root locations.
- Launch footer uses the Folio xx lockup only; it must not show `logo.webp` or “Peppercorn Capital”. The loading page must never expose the internal concept label “Sunset Editorial”.
- Identity CSS must not keep raster mark switching, screenshot wordmarks or alternate launch compositions underneath the B Exact Lock.
- Canonical visual-regression widths are **390 / 834 / 1366 / 1440 CSS px**. `npm run test:visual-identity` and `npm run test:identity` must pass before identity-related work is approved.

## Non-negotiable implementation rules

- No change to leadership classification, RS, Trend Template, Position Growth, sector ranking or market data.
- Daily-close history is honest: the home period tabs never imply intraday data.
- Missing chart history degrades to a clear empty state; it does not block navigation or class/sector summaries.
- System / Light / Dark affect surfaces and typography; the installed home-screen icon is static because iOS/Android own that shell.
- Compact Dashboard uses the brand bar instead of a second `Dashboard` titlebar.
- Dense tables are secondary on phone; desktop can expose more without changing the information model.
- Motion is short, user-triggered and reduced under `prefers-reduced-motion`.
- Loading may animate the B top-image composition with GSAP, but the composition itself must remain B: black editorial field + monochrome portrait/landscape + sunset edge + exact Folio xx lockup. Motion must not transform it into a Fluid Market wave scene.
- Identity implementation reviews compare against the B concept first: wordmark geometry, icon proportion, typography, motif and image treatment are acceptance criteria, not optional decoration.
