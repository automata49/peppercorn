# Folio xx Visual Identity v2 — Robinhood benchmark

Decision date: 2026-10-05. This document records product-design principles, not a request to clone Robinhood.

## Design baseline authority

Implementation now follows [FOLIO_DESIGN_BASELINE.md](./FOLIO_DESIGN_BASELINE.md) as **Level 0**. This document still defines visual direction and information hierarchy, but sizes, spacing, icon metrics, wordmark geometry, touch targets, and app-icon masking rules must come from the baseline. Do not solve visual drift by appending another page-specific quality-pass override.

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

The **seven identity files supplied by the user on 2026-10-07** are the current source of truth. They supersede prior reconstructed/vector approximations of the B board while preserving the same Sunset Editorial direction.

Canonical supplied assets:
- **Loading hero:** `public/folio-brand-launch.webp` — supplied 9:16 portrait/sunset Folio artwork. It already contains the wordmark and brand copy, so the loading UI must not overlay a second caption or footer logo.
- **Installed icon source:** `public/folio-brand-icon-black.webp` — supplied near-black icon. `folio-b-icon-180/192/512/512-maskable.png` are static size derivatives only; do not redraw or reinterpret the xx.
- **Wordmark:** `public/folio-brand-wordmark-light.webp` and `public/folio-brand-wordmark-dark.webp`, derived only for transparent/light-dark surface use from the supplied wordmark file. `FolioWordmark` displays these assets directly.
- **Typography:** `public/folio-brand-typography.webp` — supplied “Know The Market. Know Yourself.” poster.
- **Photography:** `public/folio-brand-photography.webp` — supplied portrait/sunset treatment with geometric line work.
- **Alternate icon references:** `public/folio-brand-icon-glossy.webp` and `public/folio-brand-icon-light.webp` remain part of the approved identity asset set, but the black flat icon is the installed-app default.

Hard rules:
- Do not reconstruct the wordmark, xx, hero, typography poster or photography from code, SVG geometry, generated text, or a new image-generation pass.
- Do not bring back `FolioMark.tsx`, the generated motif SVG, the old launch hero, or the old photography asset as active sources.
- Typography inside the app UI remains Inter / Neue-Grotesk style grotesk; the supplied typography poster is imagery, not a replacement for functional UI text.
- Palette remains Ink Black `#0B0B0D`, Paper `#F4F1EC`, warm structural Surface `#EFE9E3`, Warm Sand `#E8DED4`, Plum `#54265F`, Magenta `#A34F78`, Coral `#F06A45`, Amber `#F5A24A`. Pure white must not become the default Light product surface.
- Semantic gain/loss colours remain functional and independent from the brand palette.
- Robinhood is benchmarked only for product hierarchy, simplicity, familiar navigation and progressive disclosure. Its branding, colours and trade-entry UI are not Folio identity.

## Home information architecture

User decision 2026-10-07 supersedes the former representative-leader hero Home.

1. Supplied Folio brand + market selection.
2. **오늘의 시장** = compact market-signal summary: market breadth (MA50 with MA200 context) → leading sector → ETF RS leader. It adds no regime score. Its `전체 보기 →` opens **섹터>ETF**.
3. Stock category selector = **대형주 / 중소형주 / 전체 / ETF** using the branded Pebble Liquid Glass treatment; default = 대형주.
4. **오늘의 주도주** = at most five stocks from the unchanged Focus funnel within the selected equity size pool, or the same ranked ETF pool used by 섹터>ETF when ETF is selected. It shows ticker/name, actual 20-session mini trend, daily price and explicitly labeled 20D return.
5. Four equity leadership navigation buttons appear **below 오늘의 주도주**: 핵심 주도 / 주도 후보 / 강세 전환 / 조정 중.
6. One deterministic Folio Insight sentence; no live generative-AI claim.
7. Existing supplied Typography / Photography artwork as secondary identity imagery.

**섹터>ETF** owns the sector summary/heatmap followed immediately by ETF industry and ETF RS exploration. These core sections are always expanded; Howard Marks temperature remains secondary. Home contains no representative-leader chart or duplicated list/summary layers.

## Analysis experience

- Primary navigation: 홈 / 탐색 / Thesis / 추적.
- Explore: one market/search/category/leadership/sector/lens-filter list, with 20-row progressive pages and mini trends loaded in batches of at most 10 IDs. The primary category control is exactly **대형주 / 중소형주 / 전체 / ETF**. The equity leadership control is exactly **핵심 주도 / 주도 후보 / 강세 전환 / 조정 중**; it is disabled for ETF. Position is not a visible Explore category or product label. No separate hidden focus roster.
- The stock-category control uses the branded **Pebble Liquid Glass** treatment: the first three equity categories read as one family, a visible `/` separates ETF, and irregular translucent warm-glass shapes are restricted to this selector.
- Home ETF and **섹터>ETF** share the exact same global market pool and `etf_rs_rank` ordering; there is no independent ETF-market state that can make the two Top 5 lists disagree.
- Selecting a stock opens Detail; the list is replaced, not stacked above the chart. Return to list preserves filters. Primary Explore navigation clears hidden global query/sector state.
- Detail preserves the existing PriceRsChart and Overview / Analysis / Financials / Thesis depth. These retain their existing evidence and semantics.
- Thesis workspace uses existing analysis records and exact record identity for editing multiple dates of the same ticker. The editable records grid remains progressively disclosed.
- Tracking groups the existing Watchlist / Portfolio / Journal editors without changing their stored fields, auto enrichment or sync.
- Folio Insight remains deterministic structured signal synthesis. My Thesis remains the user's own judgement.

Existing supplied artwork and the Level-0 visual baseline remain authoritative. The generated structural mockup is not a replacement identity source.

## Mobile / iPad visual rule

Desktop, mobile and iPad all use **Folio Sunset Editorial + Pebble Liquid Glass**. The selected appearance governs the **entire product surface**: Home, Explore, Detail, Thesis, Tracking, 섹터>ETF, Temperature, Watchlist, Portfolio, Journal, Leaderboard, Universe, Settings and dialogs all consume the same Folio paper/surface/ink/rule/type/sunset tokens. Light stays light end-to-end; Dark/System-dark may use the approved near-black focal treatment. Compact layouts keep the same wordmark, app-icon family, typography, palette discipline and motif logic as desktop, with restrained sunset accents, text-led tabs, editorial evidence columns and list-like rows. Legacy blue/white workspace styling, rounded-card accumulation, glowing gradients, chromatic navigation and C's flowing-wave UI are prohibited. C remains photography treatment only.

## Visual Identity cleanup lock

The active product identity is **Folio xx / Sunset Editorial B only**. Peppercorn may remain a repository or company/project name, but it is not a second visible brand in the app shell or launch screen.

- Active visual assets are limited to the user-supplied wordmark derivatives, user-supplied black app-icon derivatives, supplied 9:16 launch hero, supplied Typography poster and supplied Photography treatment.
- Superseded punch-card, generic `folio-icon-*`, generated `folio-identity-*`, old `folio-app-icon-*`, legacy wordmark and generic `icon-*` assets must not remain in deployable source/root locations.
- Loading is the supplied 9:16 hero itself; no secondary Folio footer/caption, `logo.webp`, “Peppercorn Capital”, or internal “Sunset Editorial” label may be overlaid.
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
