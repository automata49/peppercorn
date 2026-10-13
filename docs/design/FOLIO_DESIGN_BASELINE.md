## DISCOVERY-CATALOG-1 / VISUAL-STYLE-1 — user direction (2026-10-13)

Discover stocks use a compact editorial banner, category menu (대형주 / 중소형주 / 전체 / ETF), one search and a responsive stock-card catalogue. Desktop has leadership filters at the upper left beneath the category menu; compact mobile/iPad uses four short leadership controls above cards. Keep first stock cards near the initial viewport, one-line horizontally scrollable recent history, optional detailed conditions and preserved category/market/sector/lens state. Obra token controls replace old animated Pebble/glass geometry **in this catalogue only**, with visible focus, >=44px targets and reduced motion. Preserve ranking, ETF independence, progressive rows, price history and missing states.

Desktop primary links are inset from the supplied wordmark. Mobile/iPad adds the menu as the rightmost fifth bottom action; the four existing destination labels/actions remain 오늘 / 발견 / 저널 / 여정. This supersedes earlier four-button-only and upper menu-icon placement constraints. Detail price/change use common 28px/16px tokens in portrait and landscape.

Photos use one display-only treatment across covers, journals, source images and discovery; supplied identity artwork is exempt. Settings offers existing Film + Modern and new decorative Vivid + Art photo/type presets, persists the selection, and keeps independent typography choices. Context-relevant personal photos retain priority and original uploads/backups stay intact. US instrument information on Journal/Journey cards uses ticker; KR retains names. No record identifiers or saved data change.

# Folio xx — Design Baseline v1.0

## PATAGONIA-DESKTOP-1 / DETAIL-CLARITY-1 — user direction (2026-10-13)

Desktop Home uses Patagonia-inspired full-width leading photography, a bold editorial headline, one clear story action and a three-story row. Reuse Folio photography and Motion; mobile/iPad compact composition, identity and destinations remain unchanged. Stock detail separates Overview (brief rules-based summary and two-axis checkup), Analysis (period RS/returns, one price chart and technical risk), Financials (filed financials/valuation), Thesis (user evidence/editor). Remove fixed generic marketing copy, duplicated Thesis preview, repeated key metrics/checklist and the chart repeated below every tab. Preserve data/ranking, missing-data states, save/edit, compare, watchlist and all four accessible tabs. This supersedes the earlier Obra Home desktop and detail-content arrangement.

## OBRA-RESPONSIVE-1 — user direction (2026-10-13)

Expand the Obra composition with screen size instead of a fixed 390px desktop column. Home uses an editorial heading beside the photo grid on wide screens; detail uses wide tabs, paired Insight/Thesis and readable data columns. Remove the black left rail throughout the app: desktop navigation is a theme-aware horizontal header. Compact bottom navigation and its four labels/actions remain unchanged. Preserve supplied identity, all tabs, data, record editing and Motion/photo behaviour. Supersedes the fixed-width and preserved-desktop-rail parts of OBRA-REFERENCE-1.


## OBRA-REFERENCE-1 — user direction (2026-10-13)

Implement the first Modern Magazine Obra preview's Home and stock-detail composition. Use its 390px editorial column, 24px gutter, 42px titles, compact 1.1/.9 two-column photo grid (10px gaps, 94px rows; 110px phone rows), 16px photo corners, flat detail rules and two inline actions. This supersedes FILM-MOTION-2 phone stacking and older detail glass/floating toolbar rules for these two surfaces. Preserve the existing bottom navigation unchanged, original photography priority/Motion dismissal, theme/market semantics, all Overview/Analysis/Financials/Thesis data/editing and chart/compare actions. Prototype question field opens the existing persistent Thesis editor. Device frame and mock-data text are preview-only.


## OBRA-EDITORIAL-1 — user direction 2026-10-12

All destinations share Obra/shadcn semantic component tokens, 44px controls, keyboard-focus and disabled states. Home, large headings and key statements use the shared editorial typography roles with Modern/Classic/Art expressions; numeric data and functional UI keep the grotesk stack. See `FOLIO_OBRA_EDITORIAL.md`. This supersedes older Today-only Obra scope and the single-family rule for editorial titles only. Supplied identity, theme, approved Motion/glass surfaces and finance logic remain authoritative.

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


## WORDMARK-LAUNCH-1 — user direction (2026-10-11)
Launch shows only the canonical theme-aware FolioWordmark centered on theme paper for 2000ms, then dismisses. No hero, tagline or progress bar. This supersedes all older hero-launch requirements; supplied artwork files remain available for other uses. Session-seen behavior is preserved.


## SOURCE-NEWS-1 — automatic editorial connection (2026-10-11)

Today consumes a bounded static source feed produced after existing market refresh: explicitly registered public issuer RSS. Client checks source/issuer, date/expiry, model schema and photo attribution before use. Ranking, storage, private Thesis and financial calculations are unchanged. Valid licensed issuer-related photography is the exception to the older decorative-only cover rule; missing/failed photos keep the supplied Folio image. Brand/wordmark/launch artwork stays authoritative. Original article photos require reviewed reuse permission; related Commons images are explicitly distinguished and credited. AI output is a grounded **draft**, not verified analysis. Key absence/provider failure uses source titles and is disclosed. See `docs/LEADER_SOURCE_PIPELINE.md` for scope, quotas, exact source/rights gates and Actions-secret setup. Live model execution/semantic quality and publisher-photo permissions remain open until evidenced; offline tests do not prove activation.

## LEADER-EDITORIAL-1 — latest user direction (2026-10-11)

Today now centers **오늘의 주도주**: at most five stocks/ETFs from the unchanged Market Summary selection, in the same order and global market/category. This supersedes the older requirement for four personal/question/market/journey covers on Today only. The original personal collection/editors remain in Journal and Journey. Motion keeps shared frame/image/title expansion, reverse transition, focus restoration, scroll preservation and reduced motion. Primary navigation and supplied brand assets are unchanged.

Use existing Folio-token shadcn Button/Slot/CVA and Radix Dialog primitives; Obra Community is a component-system reference, not imported artwork or a copied Figma file. Today controls use 20px radii and covers 24px; other pages keep their existing baseline. Cards show instrument/class, one source-backed saved Research title or existing action guide, and provenance. Research requires explicit matching market+ticker, HTTP(S) source and a fact; rejected observations are excluded. Unknown/stale date, verification and fact/user interpretation remain explicit in detail. Approved decorative photography is labelled separately as **Folio 이미지 · 원문 사진 아님**.

SOURCE-NEWS-1 implements collection and licensed related imagery with an optional AI draft adapter. Live provider execution and publisher-original permissions remain open. Missing research has an explicit state; demo market data is labelled. Ranking, financial calculation, workspace save/sync, journal revisions/backups and identity are unchanged. Validate home/expanded cards at 390/834/1366/1440 Light/Dark and keep four-screen comparisons for other destinations.


## FOUR-SCREENS-1 — current review authority (2026-10-10)

Read `docs/design/FOLIO_SCREEN_ACCEPTANCE.md` and `docs/harness/UI_REVIEW.md` for Today/Discover/Journal/Journey work. Primary navigation is **오늘 / 발견 / 저널 / 여정**; older analytical Home placement applies to **시장 요약** only. Preserve the approved Motion home. Screen completion requires the acceptance IDs, not just passing current-screen screenshots. Run `npm run test:four-screens` in addition to the existing gates; report the explicitly open product gaps. Notebook Paper/glass and analytical major-region/leadership glass follow their current contracts, not the historical selector-only restriction.

Status: **Level 0 / authoritative**  
Decision date: 2026-10-06

This file exists to stop iterative visual drift. Future design work starts from this baseline; it does not invent a new visual system per screen.

## MAGAZINE-1 exception — 2026-10-11

The latest user direction in `FOLIO_SCREEN_ACCEPTANCE.md` retains Today's approved Motion cards while simplifying Discover/Journal/Journey into a visual magazine. Large regular editorial headings, unboxed primary content and single-level Journey navigation override the earlier major-region glass/tab grouping on these primary pages only. Branding, touch sizing, themes, market colours and calculations remain authoritative.

## 1. Authority order

When two rules conflict, use this order:

1. **This baseline + `src/design/folio-baseline.css`**
2. Approved concept board **B / Sunset Editorial**
3. `FOLIO_IDENTITY_V2.md` for product hierarchy and page intent
4. Component/page-specific styling

A page-level tweak may not silently override Level 0. Any exception must be documented next to the component and added to regression coverage.

## 2. Non-negotiable supplied brand artwork

The seven user-supplied identity files approved on **2026-10-07** supersede reconstructed geometry.

- Wordmark uses the supplied Folio xx artwork through `FolioWordmark`. `folio-brand-wordmark-light.webp` is the light-surface derivative and `folio-brand-wordmark-dark.webp` is the dark-surface derivative of the same supplied source. Do not redraw the lettering or xx.
- Phone wordmark renders at **25px high** and preserves the supplied artwork's intrinsic aspect ratio. Do not independently scale the xx.
- App/home-screen icons are static derivatives of the supplied near-black app-icon artwork. `scripts/generate-b-app-icons.mjs` is verification-only and must never procedurally redraw the mark.
- Installed icons are full square before the platform mask; iOS/Android own final corner masking.
- The supplied icon's centered negative diamond, pale left stroke and Plum/Magenta/Coral/Amber transition must remain visually intact.
- Loading has two approved orientation sources: supplied **9:16** portrait `folio-brand-launch.webp` and approved wide B composition `folio-brand-launch-landscape.webp` for landscape screens >=700 CSS px. The retired `folio-b-launch-hero.webp` path must not return; the wide image is used only through the new canonical path with its legacy left copy masked.
- Home identity imagery uses the supplied Typography and Photography files; the former generated motif SVG is retired.

## 3. Grid and alignment

Use a 4px base grid.

| Token | Baseline |
| --- | ---: |
| Phone gutter | 16px |
| Wordmark xx height | 1ex = lowercase “o” height |
| Tablet gutter | 18px |
| Desktop gutter | 28px |
| Compact header | 60px |
| Minimum touch target | 44×44px |
| Bottom-nav item height | 52px |
| Spacing scale | 4 / 8 / 12 / 16 / 24 / 32 / 48px |

Rules:
- Header, toolbar, content title, cards, and lists share the same left edge for the current viewport.
- Text is left-aligned by default. Center alignment is reserved for numeric summaries, empty states, and deliberate editorial moments.
- Do not create a new gutter for an individual section.
- Do not fix alignment with arbitrary `translateX`, negative margins, or one-off padding unless a component explicitly owns that behavior.

## 4. Typography baseline

Primary stack: Inter / Neue-Haas-style grotesk / Helvetica Neue / system Korean fallback.

| Role | Size / line | Weight |
| --- | --- | ---: |
| Page title | 28 / 32 | 650 |
| Section title | 18 / 24 | 650 |
| Subhead | 15 / 20 | 620 |
| Body | 14 / 20 | 450–500 |
| Secondary | 12 / 18 | 450–500 |
| Metadata | 11 / 16 | 600 |
| Hero number | 32 / 36 | 500–560 |

- Korean text uses `word-break: keep-all`; do not split a Korean word to satisfy a narrow card.
- Uppercase tracking is limited to metadata/kicker labels.
- Do not use a different font family for an isolated card.
- Numbers use tabular numerals where comparison matters.
- Typography is aligned by role, not by whichever size happens to fit a screen.

## 5. Icon baseline

All navigation/action icons use `AppIcon`.

- ViewBox: **24×24**
- Rendered size: **20×20**
- Stroke: **1.55**
- Active stroke maximum: **1.75**
- Caps/joins: round
- Default: outline only, no mixed filled/outline families
- Every tappable icon sits in a **minimum 44×44** target

Do not paste Unicode icons, emoji, arbitrary SVGs, or a second icon library into navigation. A new symbol is added to `AppIcon.tsx` using the same optical language.

## 6. Surfaces and shape language

B is editorial, not bubbly-fintech.

- Light is first-run default.
- Paper: `#F4F1EC`; structural light surface: `#EFE9E3`; Warm Sand: `#E8DED4`; Ink: `#111113`; deep black: `#0B0B0D`.
- Pure white is **not** a default panel/card/input/dialog fill. In Light, product surfaces use Paper → warm Surface → Warm Sand hierarchy; white is reserved for deliberate high-contrast details or supplied artwork.
- Card radius baseline: **14px**.
- Control radius baseline: **10px**.
- Pills are only for tags, segmented toggles, and true status chips.
- **Pebble Liquid Glass** is the one deliberate exception for the primary stock-category selector: **대형주 / 중소형주 / 전체** form the equity pebble group, followed by a visible `/` and a separate **ETF** pebble. Use translucent warm-surface glass, blur/saturation, inset highlight and subtly irregular beach-stone radii. Do not turn panels, tables, metric cards or navigation into glass bubbles.
- Primary hierarchy comes from spacing, type, rules, and contrast—not extra shadows.
- Do not mix three different corner-radius families in one viewport.

## 7. Image baseline

- Loading uses two approved Sunset Editorial compositions. Portrait screens keep the supplied **9:16** `folio-brand-launch.webp`; landscape screens at >=700 CSS px use the approved wide B hero as `folio-brand-launch-landscape.webp`. The landscape file's legacy left-side copy is covered by the launch mask and replaced with the current canonical `FolioWordmark`, so xx geometry never regresses. iPhone portrait fills the viewport; iPad portrait stays poster-like; phone/iPad landscape and desktop use the wide composition without stretching. Rotation reflows through CSS media queries with no image distortion.
- B motif is secondary. On phone it stays **108–122px** high.
- C photography treatment is secondary editorial imagery, not the primary UI language.
- Imagery never pushes the first analytical decision below the fold merely for decoration.

## 8. Compact navigation baseline

Phone/tablet:
- Header 60px.
- Wordmark vertically centered optically, not mathematically stretched.
- Search/menu icons: 20px inside 44px targets.
- Market tabs: minimum 44px height.
- Bottom nav: 20px icons, 11px labels, 52px minimum item height.
- Active state uses a short quiet rule; no oversized filled pill.

## 9. Change policy

This is the key rule for future work:

**Do not append another “quality pass / V4 / V5” override block to fix drift.**

Instead:
1. Change a Level-0 token if the baseline itself is wrong.
2. Change the owning component if one component is wrong.
3. Add a documented exception only when the product genuinely needs one.
4. Add/adjust a regression test in the same change.

Visual changes are not complete until the canonical viewports pass: **390 / 834 / 1366 / 1440 CSS px**.

## 10. Definition of done

A visual-identity change is complete only when:
- `npm run harness:check` passes.
- `npm run test:identity` passes.
- Touch-target tests pass.
- Home-screen icon is square/full-bleed before OS masking and the xx aspect is not distorted.
- Wordmark, icon stroke, typography roles, and gutters match this baseline.
- The built Pages output is checked, not only source CSS.


- MARKET-COLORS-1 / FLAT-METRICS-1 / PEBBLE-REGIONS-1 (user decision 2026-10-07): The secondary destination is **시장 신호**, retaining expanded sector → ETF content and Home's existing full-view link. KR signed changes use red gains / blue losses; US uses green gains / red losses. The nearest instrument/sector market owns colours, including mixed-market rows, daily/live returns, detail, grids and market-specific heatmap legends; zero/missing stays neutral. Colours are display-only and never alter ranking, classification or pass/fail status. Major regions (including 오늘의 주도주) and all four leadership controls share Pebble Liquid Glass: translucent paper-based fill, blur/saturation, inset highlight and beach-stone radii. Nested numerical metrics stay unboxed; non-gradient surfaces share the same theme paper base. This supersedes the prior selector-only glass restriction and flat major-region styling.

- LEADERSHIP-GLASS-2 (user decision 2026-10-07 18:58 KST): Home and Explore controls **핵심 주도 / 주도 후보 / 강세 전환 / 조정 중** use the same borderless Liquid Glass rounded rectangles (24px radius), never oval/percentage radii or coloured edge strips. Explore's group wrapper is unboxed with spacing between controls. Selected state uses a subtle coral-tinted glass fill and readable theme ink, never the legacy black fill; keyboard focus remains visible. Labels/counts retain safe padding, minimum touch sizes, and Light/Dark readability. This overrides beach-stone geometry for these four controls only; stock-category pebbles and major-region styling stay unchanged.

- STOCK-CARDS-2 / TRACKING-GLASS-1 (user decision 2026-10-07 20:17 KST): shared stock/ETF cards contain no initials avatar. KR displays company/fund name first with ticker secondary; US keeps ticker first and name secondary. Readable name/price/meta tokens scale with screen width; cards reflow by available container width, including phone/tablet landscape and portrait and desktop. Preserve actual trends, prices, returns, rankings and click targets. Tracking tabs 관심종목 / 보유종목 / 투자일지 use the same borderless rounded Liquid Glass and readable selected-state/focus treatment as leadership controls.

## LIFETIME-JOURNEY-1 — user decision 2026-10-10 (MAGAZINE-1 overrides page roles)

This decision supersedes older Home/navigation placement rules only. Primary navigation is **오늘 / 발견 / 저널 / 여정**. Today follows the Motion App Store editorial demo: four large cover cards in a staggered 3:2 / 2:3 desktop grid, one-column phone layout, shared frame/image/title expansion into an accessible detail, and reverse transition to the original card. Covers contain the latest own page, a question/due review, discovery, and journey; supplied assets remain authoritative. The former analytical Home remains accessible as **시장 요약** (`dashboard`); its existing market/category/leader/ETF parity contracts still apply there. Discover retains the existing stock analysis and ranking. Journal links to the canonical Thesis, Research and Trading Journal editors. Journey adds a read-only personal timeline before interest/holdings/trade tabs. No screening, ranking, market colours or supplied brand assets change.

Six implementation stages: Folio-token shadcn-style Button/Slot/CVA primitives; Radix Tabs and Dialog focus/keyboard behavior; Motion shared-element journal card transitions respecting reduced motion; lazily loaded Lightweight Charts actual daily close zoom (existing PriceRsChart remains the default); lazy Tiptap structured journal editor with photo, vector ink, questions and dated revisions; Ticker-inspired web digit transitions retaining exact accessible values (no Android package). Existing GSAP owns launch only.

New lifetime entries are **device-local, account-scoped IndexedDB**, explicitly labelled, with JSON export/import; existing cloud workspaces are unchanged. No claim of cloud sync, OCR, native PencilKit or live AI. Pen/mouse ink is implemented; physical Apple Pencil/Safari fidelity requires device validation. Backup imports do not overwrite existing records. Per-entry atomic writes preserve other tabs and reject stale same-record edits. Notebook payload is limited before saving to preserve export/import round trips. Questions are editable answers from fixed prompts, not generated investment advice.

Keep body content legible on Paper. Glass is for interactive controls and transient surfaces; existing analytical glass contracts remain. Minimum 44px controls, canonical 390/834/1366/1440 checks, supplied wordmark, default Light, Dark/System, and existing chart gap/RS rules remain acceptance criteria. New notebook tests cover create/reload/revision, concurrent tabs, backups, photo/ink, keyboard tabs, reduced motion and real-close chart.
