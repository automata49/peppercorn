---
name: pepper-ui
description: Use for Pepper responsive layout, typography, navigation, tables, Dashboard, stock dialog and visual-regression changes.
---

## LEADER-RESEARCH-COVERFLOW-20261026 — approved leader research and responsive reading

- Publish `data/instinct-research-brief.json` after the existing leaderboard snapshot on every release/market refresh. Public equities only, existing displayed classes (correction overrides), exact market+ticker, class then RS order, max 20/market. Snapshot retrieval time is not the trading date. Missing/stale/future snapshot is unavailable with no invented targets. External Instinct must read this endpoint each run; Folio publication alone does not configure that task.
- Instinct researches those leaders using diverse original sources, facts/units/periods and risk/counter-evidence. Existing public news/private report JSON and image/table provenance remain; no fixed-company RSS fallback, private publication or extra model call. Keep diverse trend/other-company news and no news wheels; ranking and personal filters remain unchanged.
- News and latest private report share one horizontal native-scroll Cover flow in every orientation, centered snap, shallow perspective, visible 44px previous/next, arrow/Home/End keyboard controls, reduced motion and no document overflow. Reader/archive stay outside the rail, full-width and account scoped.
- Emphasize exact signed percentages; KR red/blue, US green/red only with explicit market, zero/unknown/mixed report prose neutral. Do not interpret numeric ranges as losses. Linked 20D fractional returns are labelled separately from article figures. Report related stocks use validated stored market+ticker only; no name inference or rewriting evidence.
- Launch keeps the original white image identity/2000ms. iOS standalone landscape uses oriented screen dimensions, not portrait screen.height; resize/visual viewport updates recenter visible ink. Browser centering tests are not physical Safari proof.
- Gates: Harness/build/identity/four-screen and focused 390/834/1194/1440 Light/Dark Cover flow navigation/overflow, report account boundaries, signed-text preservation, brief freshness/identity/unit bounds and installed landscape/rotation launch geometry.



## FOLIO-TAB-RAIL-JOURNAL-COVER-20261022 — current tab and cover authority

Discover, Journal and Journey use the same three-column editorial tabs with a 2px ink underline on the active tab only; remove their decorative full-width grey rails and the stock-detail tab rail without removing focus outlines, functional tab underlines or record/table separators. Journal's MY PAGES uses the existing coverPhoto('journal',photoStyle) asset: keep it visible with a full-width band on phones while preserving the new-page button and the compact bilingual top masthead. Validate 390/834/1194/1440px, image load, tab switches, accessibility and no horizontal overflow.

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

Read the UI/formatting sections in `docs/harness/CONTRACT.md`. For Folio brand/Home/theme/loading/PWA work also read `docs/design/FOLIO_IDENTITY_V2.md` and use the `folio-identity` skill.

Locate the existing shared component and CSS tokens before editing. Reuse shared primitives such as `StockRows`, `DecisionList`, disclosures, navigation icons and table tokens. Preserve data/calculation contracts while changing presentation.

Responsive / identity contract:
- **Folio Sunset Editorial + Pebble Liquid Glass** is the current visual system on desktop, mobile and iPad. Supplied B identity artwork remains pixel-authoritative; compact layouts may change density and navigation placement but not identity.
- Use the committed B wordmark/icon/launch/motif artwork instead of recreating them with text, CSS X geometry or generic gradients.
- Retained **시장 요약** (`dashboard`) hierarchy is brand → Total/KR/US → **오늘의 시장** signal summary → category selector → **오늘의 주도주** → leadership classes → Insight. `오늘의 시장 > 전체 보기` opens **시장 신호**. The Market Signal page keeps sector and ETF core analysis expanded.
- Touch targets, no-horizontal-overflow and System/Light/Dark behavior are acceptance criteria. Progressive disclosure remains for secondary/dense editors, but must not hide the core sector heatmap or ETF analysis on 시장 신호.
- Pebble Liquid Glass is shared by major regions and primary classification controls: **대형주 / 중소형주 / 전체 / ETF**, with a visible `/` before ETF. Keep translucent warm glass, blur/saturation, inset highlight and irregular beach-stone radii; Keep nested numerical metrics and table rows unboxed.
- C is photography treatment only through the committed C photography asset; it is not chrome for cards/navigation and its flowing-wave motif is not a Folio UI motif.
- Robinhood can inform hierarchy and interaction economy, never Folio branding or colour.

Run `npm run build` and `npm run test:identity` for identity/responsive changes, then relevant/full `npm run test:ui`. Report measured layout and behavior, not a visual guess.

Resolve paths from the Peppercorn repository root. If installed as a plugin outside Peppercorn, locate the repository first; do not apply its policies to another project.


- MARKET-COLORS-1 / FLAT-METRICS-1 / PEBBLE-REGIONS-1 (user decision 2026-10-07): The secondary destination is **시장 신호**, retaining expanded sector → ETF content and Home's existing full-view link. KR signed changes use red gains / blue losses; US uses green gains / red losses. The nearest instrument/sector market owns colours, including mixed-market rows, daily/live returns, detail, grids and market-specific heatmap legends; zero/missing stays neutral. Colours are display-only and never alter ranking, classification or pass/fail status. Major regions (including 오늘의 주도주) and all four leadership controls share Pebble Liquid Glass: translucent paper-based fill, blur/saturation, inset highlight and beach-stone radii. Nested numerical metrics stay unboxed; non-gradient surfaces share the same theme paper base. This supersedes the prior selector-only glass restriction and flat major-region styling.

- LEADERSHIP-GLASS-2 (user decision 2026-10-07 18:58 KST): Home and Explore controls **핵심 주도 / 주도 후보 / 강세 전환 / 조정 중** use the same borderless Liquid Glass rounded rectangles (24px radius), never oval/percentage radii or coloured edge strips. Explore's group wrapper is unboxed with spacing between controls. Selected state uses a subtle coral-tinted glass fill and readable theme ink, never the legacy black fill; keyboard focus remains visible. Labels/counts retain safe padding, minimum touch sizes, and Light/Dark readability. This overrides beach-stone geometry for these four controls only; stock-category pebbles and major-region styling stay unchanged.

- STOCK-CARDS-2 / TRACKING-GLASS-1 (user decision 2026-10-07 20:17 KST): shared stock/ETF cards contain no initials avatar. KR displays company/fund name first with ticker secondary; US keeps ticker first and name secondary. Readable name/price/meta tokens scale with screen width; cards reflow by available container width, including phone/tablet landscape and portrait and desktop. Preserve actual trends, prices, returns, rankings and click targets. Tracking tabs 관심종목 / 보유종목 / 투자일지 use the same borderless rounded Liquid Glass and readable selected-state/focus treatment as leadership controls.

## LIFETIME-JOURNEY-1 — user decision 2026-10-10 (current)

This decision supersedes older Home/navigation placement rules only. Primary navigation is **오늘 / 발견 / 저널 / 여정**. Today follows the Motion App Store editorial demo: four large cover cards in a staggered 3:2 / 2:3 desktop grid, one-column phone layout, shared frame/image/title expansion into an accessible detail, and reverse transition to the original card. Covers contain the latest own page, a question/due review, discovery, and journey; supplied assets remain authoritative. The former analytical Home remains accessible as **시장 요약** (`dashboard`); its existing market/category/leader/ETF parity contracts still apply there. Discover retains the existing stock analysis and ranking. Journal links to the canonical Thesis, Research and Trading Journal editors. Journey adds a read-only personal timeline before interest/holdings/trade tabs. No screening, ranking, market colours or supplied brand assets change.

Six implementation stages: Folio-token shadcn-style Button/Slot/CVA primitives; Radix Tabs and Dialog focus/keyboard behavior; Motion shared-element journal card transitions respecting reduced motion; lazily loaded Lightweight Charts actual daily close zoom (existing PriceRsChart remains the default); lazy Tiptap structured journal editor with photo, vector ink, questions and dated revisions; Ticker-inspired web digit transitions retaining exact accessible values (no Android package). Existing GSAP owns launch only.

New lifetime entries are **device-local, account-scoped IndexedDB**, explicitly labelled, with JSON export/import; existing cloud workspaces are unchanged. No claim of cloud sync, OCR, native PencilKit or live AI. Pen/mouse ink is implemented; physical Apple Pencil/Safari fidelity requires device validation. Backup imports do not overwrite existing records. Per-entry atomic writes preserve other tabs and reject stale same-record edits. Notebook payload is limited before saving to preserve export/import round trips. Questions are editable answers from fixed prompts, not generated investment advice.

Keep body content legible on Paper. Glass is for interactive controls and transient surfaces; existing analytical glass contracts remain. Minimum 44px controls, canonical 390/834/1366/1440 checks, supplied wordmark, default Light, Dark/System, and existing chart gap/RS rules remain acceptance criteria. New notebook tests cover create/reload/revision, concurrent tabs, backups, photo/ink, keyboard tabs, reduced motion and real-close chart.


## FOLIO-WORKFLOW-20261021-B — latest contract (2026-10-21)
- Mobile and iPad portrait are the reference view; preserve >=44px touch targets on landscape and desktop.
- Discover opens at **시장 신호**, with single canonical **종목** tab for leadership. The redundant MARKET MAP/시장 신호/주도 종목 → header is deleted; tabs own navigation.
- Browser Back, in-app Back, and edge gesture share one history index. Navigation entries include Discover and Journey tab state; modal drill navigation must never manipulate page history or redirect to Today.
- Journey owns 재검토 / 관심 종목 (Watchlist) / 보유 종목 (Portfolio); menu shortcuts open those exact tabs and account records, never parallel versions.
- Research, watchlist, portfolio, analysis records and trading journal share a vertically transposed editable comparison: field rows, instrument/record columns, read-only sourced attributes immutable, explicit edit commit and account sync.
- All wheel options remain mounted, centered via vertical scroll, selected text contrast and neutral Liquid Glass, with opaque and reduced-motion fallbacks. Equity leadership order: 핵심 주도 / 주도 후보 / 강세 전환 / 조정 중 / 전체. ETF remains class-independent.
- Page, section and subsection labels share bilingual editorial hierarchy: uppercase English kicker, legible Korean heading, common type rhythm; preserve Today cover identity, no gratuitous duplicate headings.
- Add workflow regression gates for default tabs, back-stack, wheel visibility, menu shortcuts, comparison orientation and persistency. No new AI ingestion, score calculations or copy of native Apple code.

## FOLIO-COMPACT-MARKET-20261021 (supersedes prior Signal hero and wheel dimensions)
- All portrait wheel viewports: 128px with 44px interactive rows and centered Liquid Glass selection; wide viewports: 136px and 48px rows. Keep pan-y, snap, correct settlement, 44px minimum hit targets and reduced-motion/transparency fallbacks.
- Discover's Signal tab has no MARKET MAP title/button row; do not reintroduce a secondary Stocks CTA. Single navigation is the Discover tab switch.
- SECTOR LEADERS / 주도 섹터, SECTOR MAP / 시장 지표 · 섹터 히트맵, ETF MAP / ETF 주도 산업, ETF LEADERS / ETF 주도 종목 exactly follow the MARKET & COMPANIES / 시장과 기업의 새 소식 editorial font scale, weights and eyebrow spacing. Remove double ETF h2 and the top-level '홈과 동일한 … ETF RS 순위' description.
- Sector/ETF heatmaps, ranking data, click-through dialogs, summaries and market/stock filters remain untouched. Test 390, 834, 1194, 1440 px and include title parity, layout/scrolling and absence of redundant content.

## FOLIO-MARKET-LEADERS-WHEEL-20261021 — approved correction

- MARKET LEADERS / 주도 종목 reuses Market Signal's bilingual editorial typography; no separate enlarged Obra title scale in Stocks.
- The equity leadership vertical wheel includes 핵심 주도 / 주도 후보 / 강세 전환 / 조정 중 / 전체, all native-scroll reachable and legible with a compact viewport and >=44px targets. Swipe/settle, keyboard, direct click, persistence and value recenter behave consistently even without pointerdown. ETF has no equity-leadership classification.
- Verify the stock-heading typography against Sector Leaders and the five wheel values through 390/834/1194/1440px regression. Preserve all downstream filters, calculations, nav and reduced motion.

## SECTOR-STANDING-V2 — US sector normalization and representative leadership (2026-10-23)

US source-sector aliases Process Industries/Non-Energy Minerals → Materials, Energy Minerals → Energy, Electronic Technology → Information Technology are display-only, preserving raw provenance. Leading sectors require >=5 members with RS and MA50 coverage plus >=1 core/candidate; other groups remain in full-view references and heatmaps, never top-five or Home leader. Composite score weights: median RS 45%, leader share 25%, valid MA50 breadth 20%, absolute leader count 10%, with n<20 confidence discount; tie-break deterministic. Home, Market Signal desktop/mobile and the full ranked dialog must agree; 0-leader or one-name RS outliers must not rank. Preserve stock class, Group-Rank-1 industry ordering, ETFs, source data and drilldowns. Tests cover 390/834/1440px and malformed / missing samples.
