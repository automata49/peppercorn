---
name: folio-identity
description: Use for Folio xx brand, Home visual identity, System/Light/Dark theme, loading screen, responsive mobile/iPad treatment, PWA icon/manifest and Robinhood-benchmark UI work.
---

Read `docs/harness/CONTRACT.md`, `docs/harness/HANDOFF.md`, **`docs/design/FOLIO_DESIGN_BASELINE.md` first**, then `docs/design/FOLIO_IDENTITY_V2.md` before editing.

Hard rules:
- The seven identity files supplied by the user on 2026-10-07 are the pixel source of truth. Do not reconstruct or regenerate them from the older concept board.
- Wordmark must use `public/folio-brand-wordmark-light.webp` / `public/folio-brand-wordmark-dark.webp` through `FolioWordmark`. Do not restore live `Folio` + `FolioMark.tsx`, plain-text xx, or newly generated lettering.
- Primary installed-app icons `folio-b-icon-*` are static size derivatives of `public/folio-brand-icon-black.webp`. `scripts/generate-b-app-icons.mjs` is verification-only and must not draw a new mark. The supplied glossy/light icon files are approved reference variants.
- Loading uses the supplied portrait `public/folio-brand-launch.webp` at **9:16** with restrained GSAP reveal/pan only. It already contains Folio branding, so no second caption/footer wordmark may overlay it.
- Home identity imagery uses the supplied `public/folio-brand-typography.webp` and `public/folio-brand-photography.webp`; the former generated motif SVG and old C photography file are retired.
- Typography in functional UI follows Inter / Neue-Grotesk editorial proportions: clean grotesk, regular large numerals, tight display tracking, restrained uppercase metadata.
- Light is the first-run/default appearance. System and Dark remain explicit user selections; OS dark preference must not silently override a fresh Folio session.
- Robinhood is a benchmark for hierarchy, simplicity and interaction economy only. Do not copy its branding, colours or trade-entry UI, and do not hide core Sector/ETF content merely to mimic progressive disclosure.
- DISCOVERY-JOURNEY-2 owns Home → Explore → Detail → Thesis → Tracking. Home starts with **오늘의 시장**, a compact summary of the same signal path used by **시장 신호** (market breadth → leading sector → ETF RS leader); its `전체 보기 →` opens **시장 신호**. After the category selector, **오늘의 주도주** appears before the four leadership buttons. Explore has exactly two user-facing classification axes: category **대형주 / 중소형주 / 전체 / ETF** and equity leadership **핵심 주도 / 주도 후보 / 강세 전환 / 조정 중**. The first three categories are one equity family; `/` visibly separates the ETF category. Position must not return as an Explore category or visible product label. **시장 신호** is the Market Signal destination and lays out the sector heatmap → ETF industry map → ETF summary open by default. Home ETF and 시장 신호 share the same global market pool and `etf_rs_rank` ordering. Detail keeps Overview / Analysis / Financials / Thesis; Financials may consume the existing internal filing snapshot pipeline without exposing its legacy pipeline name.
- 3D is restricted to the shallow Leadership Pulse presentation. It must not change counts, ranking, classification or imply a new score.
- The current brand is **Folio Sunset Editorial + Pebble Liquid Glass**. Apply it to every product page and section, including Home, Explore, Detail, Thesis, Tracking, 시장 신호, Temperature, Watchlist, Portfolio, Journal, Leaderboard, Universe, Settings, dialogs and grids. Light uses Paper `#F4F1EC`, warm Surface `#EFE9E3`, Warm Sand `#E8DED4`, Ink `#111113` and restrained Plum/Magenta/Coral/Amber accents. Pebble Liquid Glass is a controlled interaction motif for major regions and classification controls: warm translucent fill, blur/saturation, inset highlight and subtly irregular beach-stone radii. Keep nested numerical metrics and table rows unboxed. Legacy blue/white workspace styling must not survive as a second visual system.
- Preserve System / Light / Dark and persisted theme behavior.
- Use MARKET-COLORS-1 market-specific finance colours and preserve all investment logic. Brand colour never changes gain/loss meaning, leadership class, RS, stage, sector rank or Position Growth rules.
- Compact Dashboard uses the Folio brand bar rather than a duplicate Dashboard titlebar. Touch iPad follows the same Sunset Editorial + Pebble Liquid Glass language.
- The launch screen is the supplied Folio hero only: no overlay caption/footer, Peppercorn logo/text co-branding, or `logo.webp`.
- Superseded `folio-app-icon-*`, `folio-icon-*`, `folio-identity-*`, generic `icon-*`, legacy wordmark and old Apple-touch assets must stay deleted.
- The visual identity regression gate is fixed at 390 / 834 / 1366 / 1440 CSS px.
- Level-0 sizes/spacing/icon/wordmark/app-icon rules come from `src/design/folio-baseline.css`. Do not append a new “quality pass / V4 / V5” override block; change the baseline token or owning component and add regression coverage.

Workflow:
1. Inspect the authoritative B artwork and shared source components before editing.
2. Keep one information hierarchy across breakpoints; change density, not identity or meaning.
3. Verify phone 390px, iPad 834px, touch iPad Pro 1366px and desktop 1440px, including Light and Dark where affected.
4. Run `npm run harness:check`, `npm run build`, `npm run test:visual-identity`, `npm run test:identity`, then the relevant/full `npm run test:ui`.
5. Report measured behavior and exact test outcomes. Physical Safari remains unverified unless actually tested.

Resolve paths from the Peppercorn repository root. If installed as a plugin outside Peppercorn, locate the repository first; do not apply these policies to another project.


- MARKET-COLORS-1 / FLAT-METRICS-1 / PEBBLE-REGIONS-1 (user decision 2026-10-07): The secondary destination is **시장 신호**, retaining expanded sector → ETF content and Home's existing full-view link. KR signed changes use red gains / blue losses; US uses green gains / red losses. The nearest instrument/sector market owns colours, including mixed-market rows, daily/live returns, detail, grids and market-specific heatmap legends; zero/missing stays neutral. Colours are display-only and never alter ranking, classification or pass/fail status. Major regions (including 오늘의 주도주) and all four leadership controls share Pebble Liquid Glass: translucent paper-based fill, blur/saturation, inset highlight and beach-stone radii. Nested numerical metrics stay unboxed; non-gradient surfaces share the same theme paper base. This supersedes the prior selector-only glass restriction and flat major-region styling.

- LEADERSHIP-GLASS-2 (user decision 2026-10-07 18:58 KST): Home and Explore controls **핵심 주도 / 주도 후보 / 강세 전환 / 조정 중** use the same borderless Liquid Glass rounded rectangles (24px radius), never oval/percentage radii or coloured edge strips. Explore's group wrapper is unboxed with spacing between controls. Selected state uses a subtle coral-tinted glass fill and readable theme ink, never the legacy black fill; keyboard focus remains visible. Labels/counts retain safe padding, minimum touch sizes, and Light/Dark readability. This overrides beach-stone geometry for these four controls only; stock-category pebbles and major-region styling stay unchanged.
