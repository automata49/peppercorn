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
- Palette remains Ink Black `#0B0B0D`, Warm Sand `#E8DED4`, Plum `#54265F`, Magenta `#A34F78`, Coral `#F06A45`, Amber `#F5A24A`.
- Semantic gain/loss colours remain functional and independent from the brand palette.
- Robinhood is benchmarked only for product hierarchy, simplicity, familiar navigation and progressive disclosure. Its branding, colours and trade-entry UI are not Folio identity.

## Home information architecture

Compact Dashboard primary flow:

1. Folio xx brand + menu.
2. Total / KR / US.
3. One representative leader.
4. Large price + current selected-period return.
5. One large daily-close chart.
6. 1D / 1W / 1M / 3M / 1Y / ALL.
7. Alternate Focus leaders as small chips.
8. RS rank / industry rank / 52W-high distance.
9. One restrained **Leadership Pulse** that summarizes 핵심 / 후보 / 전환 without duplicating the stock list.
10. Three class buttons open their existing quick classified lists.
11. One explicit **분석 허브** path owns deep stock selection and analysis.
12. 주도 섹터 → 시장 온도계 → ETF / market exploration.

The former separate Focus roster and “추가 보기 · 모멘텀 / 현재가” disclosure are removed from Home. The first screen answers: *where is leadership, how is the representative leader behaving, and what should I inspect next?*

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

Desktop, mobile and iPad all use B/Sunset Editorial. Warm editorial paper is the shell; the approved dark mobile/product boards permit near-black **focal investing surfaces** for Leadership Overview and Analysis so the analytical path feels concentrated and premium. Compact layouts use the same wordmark, app-icon family, typography, palette discipline and motif logic as desktop: warm-paper shell, near-black focal analysis surfaces, restrained sunset accents, text-led tabs, editorial evidence columns and list-like sector rows. Rounded-card accumulation, glowing gradients, chromatic navigation and C's flowing-wave UI are prohibited. C remains photography treatment only.

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
