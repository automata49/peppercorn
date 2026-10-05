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

## Folio interpretation

Robinhood's neon green is not copied. Folio keeps its own identity:

- **Base on every device:** Sunset Editorial — black/white, warm paper, typographic hierarchy, flat rules, sparse dividers and minimal card chrome. Desktop, mobile and iPad use the same visual system.
- **Accent only:** Fluid Market — plum → magenta → coral → amber is not a mobile theme. It is limited to the xx brand mark, a selected chart point/focus cue and the C-style photography/launch atmosphere. Core charts and navigation stay editorial/monochrome.
- **Brand mark:** text-native `Folio xx`; `Folio` follows theme foreground, `xx` carries the sunset spectrum.
- **App icon:** black field + large sunset xx. It must read at small iOS home-screen sizes and does not change with the in-app theme.
- **Semantic finance colours:** positive/negative remain independent functional colours. Sunset colour never means gain/loss.

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

Compact layouts do not use a separate C/Fluid-Market UI. They use B/Sunset Editorial: plain warm-paper or near-black surfaces, monochrome chart line, text-led tabs, square/flat dividers, editorial evidence columns and list-like sector rows. Rounded cards, glowing gradient backgrounds and chromatic navigation are avoided. Sunset colour remains a small brand/focus accent so the product stays recognisably Folio without weakening financial legibility.

## Non-negotiable implementation rules

- No change to leadership classification, RS, Trend Template, Position Growth, sector ranking or market data.
- Daily-close history is honest: the home period tabs never imply intraday data.
- Missing chart history degrades to a clear empty state; it does not block navigation or class/sector summaries.
- System / Light / Dark affect surfaces and typography; the installed home-screen icon is static because iOS/Android own that shell.
- Compact Dashboard uses the brand bar instead of a second `Dashboard` titlebar.
- Dense tables are secondary on phone; desktop can expose more without changing the information model.
- Motion is short, user-triggered and reduced under `prefers-reduced-motion`.
