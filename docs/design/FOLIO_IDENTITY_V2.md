# Folio xx Visual Identity v2 — Robinhood benchmark

Decision date: 2026-10-05. This document records product-design principles, not a request to clone Robinhood.

## Benchmark: what Robinhood actually optimizes

Official Robinhood material consistently points to a small set of principles:

1. **Simple, intuitive, mobile-familiar.** Robinhood says its platform should be approachable regardless of experience and should use familiar mobile interaction patterns.
2. **Content-centric hierarchy.** Its design history emphasizes relevant information, clean typography and clear presentation so the user can make the decision rather than interpret the interface.
3. **Less is more.** The 2024 identity is rooted in black, white and neutrals, with one purposeful accent, sophisticated photography and an intentional modular layout system.
4. **One customer journey, secondary modules may degrade.** Robinhood's 2026 engineering writing describes the customer intent as a simple linear journey even when many services sit behind it. Folio applies the same product principle visually: the primary decision path must survive missing secondary information.
5. **Essential navigation stays obvious.** Robinhood introduced a bottom tab bar specifically to keep portfolio/watchlist/search and other frequent destinations easy to reach as the product expanded.
6. **Appearance is a product feature.** Robinhood exposes light, dark and system-aware appearance choices and an appearance preview. Folio keeps System / Light / Dark as first-class modes.

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
- **Wordmark:** bold black/white “Folio” plus the compact angular/interlocked double-x mark shown in B. Implementation is deliberately clean rather than a screenshot crop: the `Folio` text uses the B grotesk proportions and the mark comes from `folio-b-xx-light.png` / `folio-b-xx-dark.png`, extracted from the exact B icon geometry. The xx is plum → magenta → coral/amber. Plain text “x x”, rounded letterforms, noisy raster crops, a punch-card emblem or a newly invented mark are not acceptable substitutes.
- **App icon:** B's near-black rounded-square tile with the small centered angular xx mark. User correction 2026-10-06 fixes the icon mark at approximately **31.25% of tile width** with a **1.72:1 xx bounding-box aspect**, optically centered. The icon must derive from the exact interlocked B mark; do not reuse the earlier oversized/wide treatment. A warm-sand alternate may be used only where a light preview is appropriate. Do not use a full-gradient tile as the primary icon.
- **Typography:** Inter / Neue-Grotesk style grotesk. Large headings are clean, confident and tightly set; captions use restrained uppercase tracking. Avoid decorative type or overly rounded fintech styling.
- **Motif:** B's editorial motif language = monochrome landscape/rock silhouette, sparse technical line work, isolated warm sun/disc, and disciplined words such as DISCIPLINE / INSIGHT / PERSPECTIVE / FREEDOM. The flowing multicolour wave belongs to C and is not Folio's primary motif.
- **Photography:** C's photography *treatment* may be borrowed: warm sunset light, shallow depth of field, human-scale optimism, restrained blur/bokeh. It is photography treatment only, not a C UI system.
- **Palette:** Ink Black `#0B0B0D`, Warm Sand `#E8DED4`, Plum `#54265F`, Magenta `#A34F78`, Coral `#F06A45`, Amber `#F5A24A`. Warm off-white reading surfaces are allowed as B's paper field.
- **Semantic finance colours:** gain/loss colours remain functional and independent from the brand palette.

Robinhood is benchmarked only for product hierarchy, simplicity, familiar navigation and progressive disclosure. Its green, trade-entry visual language and branding are not Folio identity.

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
9. 핵심 / 후보 / 전환 compact cards.
10. Secondary disclosure: full Focus roster, momentum/live view.
11. 주도 섹터.
12. 시장 온도계.
13. ETF / market exploration.

This is deliberately **not** a dense dashboard. The first screen answers: *where is leadership, how is the representative leader behaving, and what should I inspect next?*

## Mobile / iPad visual rule

Desktop, mobile and iPad all use B/Sunset Editorial. Compact layouts use the same wordmark, app-icon family, typography, palette discipline and motif logic as desktop: warm-paper or near-black surfaces, monochrome chart line, text-led tabs, flat dividers, editorial evidence columns and list-like sector rows. Rounded-card accumulation, glowing gradients, chromatic navigation and C's flowing-wave UI are prohibited. C remains photography treatment only.

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
