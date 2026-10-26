---
name: folio-identity
description: Use for Folio xx brand, Home visual identity, System/Light/Dark theme, loading screen, responsive mobile/iPad treatment, PWA icon/manifest and Robinhood-benchmark UI work.
---

## LEADER-RESEARCH-COVERFLOW-20261026 — approved leader research and responsive reading

- Publish `data/instinct-research-brief.json` after the existing leaderboard snapshot on every release/market refresh. Public equities only, existing displayed classes (correction overrides), exact market+ticker, class then RS order, max 20/market. Snapshot retrieval time is not the trading date. Missing/stale/future snapshot is unavailable with no invented targets. External Instinct must read this endpoint each run; Folio publication alone does not configure that task.
- Instinct researches those leaders using diverse original sources, facts/units/periods and risk/counter-evidence. Existing public news/private report JSON and image/table provenance remain; no fixed-company RSS fallback, private publication or extra model call. Keep diverse trend/other-company news and no news wheels; ranking and personal filters remain unchanged.
- News and latest private report share one horizontal native-scroll Cover flow in every orientation, centered snap, shallow perspective, visible 44px previous/next, arrow/Home/End keyboard controls, reduced motion and no document overflow. Reader/archive stay outside the rail, full-width and account scoped.
- Emphasize exact signed percentages; KR red/blue, US green/red only with explicit market, zero/unknown/mixed report prose neutral. Do not interpret numeric ranges as losses. Linked 20D fractional returns are labelled separately from article figures. Report related stocks use validated stored market+ticker only; no name inference or rewriting evidence.
- Launch keeps the original white image identity/2000ms. iOS standalone landscape uses oriented screen dimensions, not portrait screen.height; resize/visual viewport updates recenter visible ink. Browser centering tests are not physical Safari proof.
- Gates: Harness/build/identity/four-screen and focused 390/834/1194/1440 Light/Dark Cover flow navigation/overflow, report account boundaries, signed-text preservation, brief freshness/identity/unit bounds and installed landscape/rotation launch geometry.



## DISCOVERY-CATALOG-1 / VISUAL-STYLE-1 — user direction (2026-10-13)

Discover stocks use a compact editorial banner, category menu (대형주 / 중소형주 / 전체 / ETF), one search and a responsive stock-card catalogue. Desktop has leadership filters at the upper left beneath the category menu; compact mobile/iPad uses four short leadership controls above cards. Keep first stock cards near the initial viewport, one-line horizontally scrollable recent history, optional detailed conditions and preserved category/market/sector/lens state. Obra token controls replace old animated Pebble/glass geometry **in this catalogue only**, with visible focus, >=44px targets and reduced motion. Preserve ranking, ETF independence, progressive rows, price history and missing states.

Desktop primary links are inset from the supplied wordmark. Mobile/iPad adds the menu as the rightmost fifth bottom action; the four existing destination labels/actions remain 오늘 / 발견 / 저널 / 여정. This supersedes earlier four-button-only and upper menu-icon placement constraints. Detail price/change use common 28px/16px tokens in portrait and landscape.

Photos use one display-only treatment across covers, journals, source images and discovery; supplied identity artwork is exempt. Settings offers existing Film + Modern and new decorative Vivid + Art photo/type presets, persists the selection, and keeps independent typography choices. Context-relevant personal photos retain priority and original uploads/backups stay intact. US instrument information on Journal/Journey cards uses ticker; KR retains names. No record identifiers or saved data change.



## FILM-MOTION-2 — latest user authority (2026-10-12)

- User chose an independent in-app film expression inspired by VSCO's published examples, not licensed VSCO presets or API integration. Generated defaults use modernist photographic composition. Apply the same subtle warm/faded display treatment to default and personal home-cover photos; preserve uploaded originals and backups unchanged.
- Keep four home sections fixed but give each a distinct cover size: staggered wide/narrow, tall/short desktop grid and varied phone aspect ratios.
- Image-only white loading holds for 2000ms, then Motion cross-fades into the home over 350–400ms. Reduced motion removes the reveal movement and fade; no loading copy or extra progress UI.
- Discover and stock detail chrome, action toolbar and bottom navigation consume root theme tokens in Light, Dark, System-light and System-dark. No forced dark footer or region may survive as a page-local exception. Verify the actual fixed bars and inactive buttons, not just the detail hero.



## RETRO-GESTURE-1 — latest user authority (2026-10-12)

- Home keeps exactly 오늘 / 발견 / 저널 / 여정. Context-relevant user journal photos take priority: today's records, leader-linked investment records, latest journal, and investment journey respectively. Without an available personal photo, use the four modern Vintage/Retro defaults `folio-retro-{today,discover,journal,journey}.webp`. Generated decorative photos are not article evidence. Supplied wordmark/icon/launch remain authoritative.
- Journal and Review thumbnail cards use subtle neutral Liquid glass (translucent surface, blur, inset highlight and quiet depth), retaining gallery sizing/search/date grouping.
- Motion home and journal details have no visible X. A small accessible pull handle, downward pull from the top, desktop cover drag, outside click and Escape dismiss. Ordinary scrolling, text editing and ink gestures are preserved; dirty journal dismissal still requires confirmation. Reverse motion restores the opener's focus and scroll, with reduced-motion support.
- Google login checks provider readiness before redirecting so disabled/unavailable providers show an in-app email fallback. Deploy the PKCE-capable auth function; never delete an account following a refused OAuth login. Provider credentials, callback and app redirect settings remain an explicit configuration gate; readiness is not proof of a completed Google login.



## LIFESTYLE-HOME-1 — latest user authority (2026-10-12)

This supersedes LEADER-EDITORIAL-1 home placement, warm-surface and forced-dark analysis rules.
- Launch: one original `folio-brand-wordmark-light.webp` image on pure white for 2000ms, independent of selected theme; no generated lettering or themed wrapper.
- Default Light: black ink on white, neutral gray structural surfaces. Dark/System remain explicit selections; Sunset is restricted to quiet typography/rules/selected accents, never a page-wide field. All stock detail/chart/actionbar colours inherit the same root palette, with market gain/loss semantics preserved.
- Home is a lifestyle overview of the user's journey, exactly four shared-element Motion photo cards: 오늘 / 발견 / 저널 / 여정. Each cover has its label and one single-line summary; no stock roster or numerical analysis on the cover.
- Expanded 오늘 reads public source changes and the user's leader-linked journal records; source dates/draft states stay explicit. 발견 previews existing leaders without changing selection/ranking. 저널 summarizes life/records, source Insights, saved Thesis and trading journals. 여정 revisits hypotheses, counter-evidence, revisions and next review dates; no automatic rewriting of private records.
- Journal and investment-only Review use Motion thumbnails, responsive photo-gallery columns, text search, dependent local-calendar year/month/day filters and grouping, and 40-record progressive batches. Preserve photo/ink/edit/revision/backup/atomic-save behaviour and original cloud record IDs. No new live AI, arbitrary channel ingestion or historical cash-flow claims.
- Verify white image launch in both themes, four fixed covers, all four expanded flows, date filters and pagination, original record actions, and stock detail contrast at 390/834/1366/1440 portrait/landscape Light/Dark. Update and inspect changed four-screen references; passing a new reference is regression evidence, not physical Safari proof.



## FOUR-SCREENS-1 — current review authority (2026-10-10)

Read `docs/design/FOLIO_SCREEN_ACCEPTANCE.md` and `docs/harness/UI_REVIEW.md` for Today/Discover/Journal/Journey work. Primary navigation is **오늘 / 발견 / 저널 / 여정**; older analytical Home placement applies to **시장 요약** only. Preserve the approved Motion home. Screen completion requires the acceptance IDs, not just passing current-screen screenshots. Run `npm run test:four-screens` in addition to the existing gates; report the explicitly open product gaps. Notebook Paper/glass and analytical major-region/leadership glass follow their current contracts, not the historical selector-only restriction.

Read `docs/harness/CONTRACT.md`, `docs/harness/HANDOFF.md`, **`docs/design/FOLIO_DESIGN_BASELINE.md` first**, then `docs/design/FOLIO_IDENTITY_V2.md` before editing.

Hard rules:
- The seven identity files supplied by the user on 2026-10-07 are the pixel source of truth. Do not reconstruct or regenerate them from the older concept board.
- Wordmark must use `public/folio-brand-wordmark-light.webp` / `public/folio-brand-wordmark-dark.webp` through `FolioWordmark`. Do not restore live `Folio` + `FolioMark.tsx`, plain-text xx, or newly generated lettering.
- Primary installed-app icons `folio-b-icon-*` are static size derivatives of `public/folio-brand-icon-black.webp`. `scripts/generate-b-app-icons.mjs` is verification-only and must not draw a new mark. The supplied glossy/light icon files are approved reference variants.
- Loading uses `public/folio-brand-launch.webp` for portrait and `public/folio-brand-launch-landscape.webp` for landscape screens >=700 CSS px. The wide artwork's legacy left-side copy is masked and replaced only with the current canonical `FolioWordmark` plus restrained brand copy; never expose the retired embedded wordmark/xx. GSAP remains reveal/pan/progress only.
- Home identity imagery uses the supplied `public/folio-brand-typography.webp` and `public/folio-brand-photography.webp`; the former generated motif SVG and old C photography file are retired.
- Typography in functional UI follows Inter / Neue-Grotesk editorial proportions: clean grotesk, regular large numerals, tight display tracking, restrained uppercase metadata.
- Light is the first-run/default appearance. System and Dark remain explicit user selections; OS dark preference must not silently override a fresh Folio session.
- Robinhood is a benchmark for hierarchy, simplicity and interaction economy only. Do not copy its branding, colours or trade-entry UI, and do not hide core Sector/ETF content merely to mimic progressive disclosure.
- DISCOVERY-JOURNEY-2 governs the retained analytical **시장 요약** → Explore → Detail → Thesis → Tracking flow. In that analytical workspace only, the summary starts with **오늘의 시장**, a compact summary of the same signal path used by **시장 신호** (market breadth → leading sector → ETF RS leader); its `전체 보기 →` opens **시장 신호**. After the category selector, **오늘의 주도주** appears before the four leadership buttons. Explore has exactly two user-facing classification axes: category **대형주 / 중소형주 / 전체 / ETF** and equity leadership **핵심 주도 / 주도 후보 / 강세 전환 / 조정 중**. The first three categories are one equity family; `/` visibly separates the ETF category. Position must not return as an Explore category or visible product label. **시장 신호** is the Market Signal destination and lays out the sector heatmap → ETF industry map → ETF summary open by default. Home ETF and 시장 신호 share the same global market pool and `etf_rs_rank` ordering. Detail keeps Overview / Analysis / Financials / Thesis; Financials may consume the existing internal filing snapshot pipeline without exposing its legacy pipeline name.
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

- STOCK-CARDS-2 / TRACKING-GLASS-1 (user decision 2026-10-07 20:17 KST): shared stock/ETF cards contain no initials avatar. KR displays company/fund name first with ticker secondary; US keeps ticker first and name secondary. Readable name/price/meta tokens scale with screen width; cards reflow by available container width, including phone/tablet landscape and portrait and desktop. Preserve actual trends, prices, returns, rankings and click targets. Tracking tabs 관심종목 / 보유종목 / 투자일지 use the same borderless rounded Liquid Glass and readable selected-state/focus treatment as leadership controls.

## LIFETIME-JOURNEY-1 — user decision 2026-10-10 (current)

This decision supersedes older Home/navigation placement rules only. Primary navigation is **오늘 / 발견 / 저널 / 여정**. Today follows the Motion App Store editorial demo: four large cover cards in a staggered 3:2 / 2:3 desktop grid, one-column phone layout, shared frame/image/title expansion into an accessible detail, and reverse transition to the original card. Covers contain the latest own page, a question/due review, discovery, and journey; supplied assets remain authoritative. The former analytical Home remains accessible as **시장 요약** (`dashboard`); its existing market/category/leader/ETF parity contracts still apply there. Discover retains the existing stock analysis and ranking. Journal links to the canonical Thesis, Research and Trading Journal editors. Journey adds a read-only personal timeline before interest/holdings/trade tabs. No screening, ranking, market colours or supplied brand assets change.

Six implementation stages: Folio-token shadcn-style Button/Slot/CVA primitives; Radix Tabs and Dialog focus/keyboard behavior; Motion shared-element journal card transitions respecting reduced motion; lazily loaded Lightweight Charts actual daily close zoom (existing PriceRsChart remains the default); lazy Tiptap structured journal editor with photo, vector ink, questions and dated revisions; Ticker-inspired web digit transitions retaining exact accessible values (no Android package). Existing GSAP owns launch only.

New lifetime entries are **device-local, account-scoped IndexedDB**, explicitly labelled, with JSON export/import; existing cloud workspaces are unchanged. No claim of cloud sync, OCR, native PencilKit or live AI. Pen/mouse ink is implemented; physical Apple Pencil/Safari fidelity requires device validation. Backup imports do not overwrite existing records. Per-entry atomic writes preserve other tabs and reject stale same-record edits. Notebook payload is limited before saving to preserve export/import round trips. Questions are editable answers from fixed prompts, not generated investment advice.

Keep body content legible on Paper. Glass is for interactive controls and transient surfaces; existing analytical glass contracts remain. Minimum 44px controls, canonical 390/834/1366/1440 checks, supplied wordmark, default Light, Dark/System, and existing chart gap/RS rules remain acceptance criteria. New notebook tests cover create/reload/revision, concurrent tabs, backups, photo/ink, keyboard tabs, reduced motion and real-close chart.
