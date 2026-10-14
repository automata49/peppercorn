## DISCOVERY-FILTER-2 — user direction (2026-10-14)

Discover's Filter & Sort starts collapsed in every orientation and opens an accessible left drawer. Category, market, leadership, sector, advanced conditions and local display sort live in that drawer; readable plain text with bold/underline selection replaces boxed controls. Stock cards and recent items have no border, filled box or shadow. Preserve market colours, real trends, missing states, saved filters, detail return and progressive loading. RS remains the default display order; optional 20D/name sorting never changes scores or classification. This supersedes DISCOVERY-CATALOG-1's always-visible filters and boxed cards only.

## DISCOVERY-CATALOG-1 / VISUAL-STYLE-1 — user direction (2026-10-13)

Discover stocks use a compact editorial banner, category menu (대형주 / 중소형주 / 전체 / ETF), one search and a responsive stock-card catalogue. Desktop has leadership filters at the upper left beneath the category menu; compact mobile/iPad uses four short leadership controls above cards. Keep first stock cards near the initial viewport, one-line horizontally scrollable recent history, optional detailed conditions and preserved category/market/sector/lens state. Obra token controls replace old animated Pebble/glass geometry **in this catalogue only**, with visible focus, >=44px targets and reduced motion. Preserve ranking, ETF independence, progressive rows, price history and missing states.

Desktop primary links are inset from the supplied wordmark. Mobile/iPad adds the menu as the rightmost fifth bottom action; the four existing destination labels/actions remain 오늘 / 발견 / 저널 / 여정. This supersedes earlier four-button-only and upper menu-icon placement constraints. Detail price/change use common 28px/16px tokens in portrait and landscape.

Photos use one display-only treatment across covers, journals, source images and discovery; supplied identity artwork is exempt. Settings offers existing Film + Modern and new decorative Vivid + Art photo/type presets, persists the selection, and keeps independent typography choices. Context-relevant personal photos retain priority and original uploads/backups stay intact. US instrument information on Journal/Journey cards uses ticker; KR retains names. No record identifiers or saved data change.

# Peppercorn — Codex

## PATAGONIA-DESKTOP-1 / DETAIL-CLARITY-1 — user direction (2026-10-13)

Desktop Home uses Patagonia-inspired full-width leading photography, a bold editorial headline, one clear story action and a three-story row. Reuse Folio photography and Motion; mobile/iPad compact composition, identity and destinations remain unchanged. Stock detail separates Overview (brief rules-based summary and two-axis checkup), Analysis (period RS/returns, one price chart and technical risk), Financials (filed financials/valuation), Thesis (user evidence/editor). Remove fixed generic marketing copy, duplicated Thesis preview, repeated key metrics/checklist and the chart repeated below every tab. Preserve data/ranking, missing-data states, save/edit, compare, watchlist and all four accessible tabs. This supersedes the earlier Obra Home desktop and detail-content arrangement.

## OBRA-RESPONSIVE-1 — user direction (2026-10-13)

Expand the Obra composition with screen size instead of a fixed 390px desktop column. Home uses an editorial heading beside the photo grid on wide screens; detail uses wide tabs, paired Insight/Thesis and readable data columns. Remove the black left rail throughout the app: desktop navigation is a theme-aware horizontal header. Compact bottom navigation and its four labels/actions remain unchanged. Preserve supplied identity, all tabs, data, record editing and Motion/photo behaviour. Supersedes the fixed-width and preserved-desktop-rail parts of OBRA-REFERENCE-1.


## OBRA-REFERENCE-1 — user direction (2026-10-13)

Implement the first Modern Magazine Obra preview's Home and stock-detail composition. Use its 390px editorial column, 24px gutter, 42px titles, compact 1.1/.9 two-column photo grid (10px gaps, 94px rows; 110px phone rows), 16px photo corners, flat detail rules and two inline actions. This supersedes FILM-MOTION-2 phone stacking and older detail glass/floating toolbar rules for these two surfaces. Preserve the existing bottom navigation unchanged, original photography priority/Motion dismissal, theme/market semantics, all Overview/Analysis/Financials/Thesis data/editing and chart/compare actions. Prototype question field opens the existing persistent Thesis editor. Device frame and mock-data text are preview-only.


## MULTI-USER-1 — user authority (2026-10-12)

Folio allows multiple independent user accounts. Supersedes all earlier single-owner/Setup Code restrictions: email registration uses GoTrue public signup with email verification and existing rate limits, never admin create/auto-confirm. Any valid Google PKCE session is accepted; enabling the Google provider is a separate configuration gate. Signup without a session displays confirmation instructions, not a signed-in state. Email confirmation returns to the login screen. All workspace cache keys are account-scoped, guests retain their own device records, and cloud writes require that account/resource's successful read. Late responses after account changes must not affect the new session. Keep database auth.uid() RLS and security_invoker views. Photo/ink notebooks remain device-local and account-scoped; do not imply cloud sync.


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


## MAGAZINE-1 — latest user direction (2026-10-11)

For the four primary pages, apply the MAGAZINE-1 exception in `docs/design/FOLIO_SCREEN_ACCEPTANCE.md`: photography, large headings and fewer boxed regions; Today retains its original four Motion covers. Journal owns writing and all personal records; Journey owns investment-only review, watchlist and holdings with one level of tabs. Auxiliary tools move to the menu. This supersedes older primary-region glass and nested tracking requirements below; market/ranking/storage and supplied identity remain authoritative.

## FOUR-SCREENS-1 — current review authority (2026-10-10)

Read `docs/design/FOLIO_SCREEN_ACCEPTANCE.md` and `docs/harness/UI_REVIEW.md` for Today/Discover/Journal/Journey work. Primary navigation is **오늘 / 발견 / 저널 / 여정**; older analytical Home placement applies to **시장 요약** only. Preserve the approved Motion home. Screen completion requires the acceptance IDs, not just passing current-screen screenshots. Run `npm run test:four-screens` in addition to the existing gates; report the explicitly open product gaps. Notebook Paper/glass and analytical major-region/leadership glass follow their current contracts, not the historical selector-only restriction.

Read `docs/harness/CONTRACT.md` before work and `docs/harness/HANDOFF.md` before continuing a task. Those shared documents govern UI, formatting, analysis and Pepper AI Analyst.

For Folio brand, Home, responsive UI, theme, loading or PWA work, read `docs/design/FOLIO_DESIGN_BASELINE.md` first, then `docs/design/FOLIO_IDENTITY_V2.md`, and use both `folio-identity` and `pepper-ui` from `.agents/skills/`. Current visual contract: **Folio Sunset Editorial + Pebble Liquid Glass** on desktop, mobile and iPad. Supplied B wordmark/icon/launch/typography artwork remains pixel-authoritative; C remains photography treatment only. Warm Paper/Surface/Sand replaces generic white chrome, and Pebble Liquid Glass covers major regions and leadership controls as well as the grouped stock-category selector (**대형주 / 중소형주 / 전체 / ETF**, with `/` before ETF). Robinhood is an information-architecture benchmark, never a visual clone. Preserve investment classification and ranking; market-specific display colours follow MARKET-COLORS-1.

Run `npm run harness:check`; for UI/brand changes also run `npm run build`, `npm run test:identity`, then the relevant/full browser suite. Use `.codex/agents/` reviewers for substantial cross-domain changes; keep one writer per file. Never claim an unrun test or unconfigured AI provider is active.


- MARKET-COLORS-1 / FLAT-METRICS-1 / PEBBLE-REGIONS-1 (user decision 2026-10-07): The secondary destination is **시장 신호**, retaining expanded sector → ETF content and Home's existing full-view link. KR signed changes use red gains / blue losses; US uses green gains / red losses. The nearest instrument/sector market owns colours, including mixed-market rows, daily/live returns, detail, grids and market-specific heatmap legends; zero/missing stays neutral. Colours are display-only and never alter ranking, classification or pass/fail status. Major regions (including 오늘의 주도주) and all four leadership controls share Pebble Liquid Glass: translucent paper-based fill, blur/saturation, inset highlight and beach-stone radii. Nested numerical metrics stay unboxed; non-gradient surfaces share the same theme paper base. This supersedes the prior selector-only glass restriction and flat major-region styling.

- LEADERSHIP-GLASS-2 (user decision 2026-10-07 18:58 KST): Home and Explore controls **핵심 주도 / 주도 후보 / 강세 전환 / 조정 중** use the same borderless Liquid Glass rounded rectangles (24px radius), never oval/percentage radii or coloured edge strips. Explore's group wrapper is unboxed with spacing between controls. Selected state uses a subtle coral-tinted glass fill and readable theme ink, never the legacy black fill; keyboard focus remains visible. Labels/counts retain safe padding, minimum touch sizes, and Light/Dark readability. This overrides beach-stone geometry for these four controls only; stock-category pebbles and major-region styling stay unchanged.

- STOCK-CARDS-2 / TRACKING-GLASS-1 (user decision 2026-10-07 20:17 KST): shared stock/ETF cards contain no initials avatar. KR displays company/fund name first with ticker secondary; US keeps ticker first and name secondary. Readable name/price/meta tokens scale with screen width; cards reflow by available container width, including phone/tablet landscape and portrait and desktop. Preserve actual trends, prices, returns, rankings and click targets. Tracking tabs 관심종목 / 보유종목 / 투자일지 use the same borderless rounded Liquid Glass and readable selected-state/focus treatment as leadership controls.
