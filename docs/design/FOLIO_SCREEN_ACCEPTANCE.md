# Folio xx — four-screen acceptance contract

## OBRA-RESPONSIVE-1 — user direction (2026-10-13)

Expand the Obra composition with screen size instead of a fixed 390px desktop column. Home uses an editorial heading beside the photo grid on wide screens; detail uses wide tabs, paired Insight/Thesis and readable data columns. Remove the black left rail throughout the app: desktop navigation is a theme-aware horizontal header. Compact bottom navigation and its four labels/actions remain unchanged. Preserve supplied identity, all tabs, data, record editing and Motion/photo behaviour. Supersedes the fixed-width and preserved-desktop-rail parts of OBRA-REFERENCE-1.


## OBRA-REFERENCE-1 — user direction (2026-10-13)

Implement the first Modern Magazine Obra preview's Home and stock-detail composition. Use its 390px editorial column, 24px gutter, 42px titles, compact 1.1/.9 two-column photo grid (10px gaps, 94px rows; 110px phone rows), 16px photo corners, flat detail rules and two inline actions. This supersedes FILM-MOTION-2 phone stacking and older detail glass/floating toolbar rules for these two surfaces. Preserve the existing bottom navigation unchanged, original photography priority/Motion dismissal, theme/market semantics, all Overview/Analysis/Financials/Thesis data/editing and chart/compare actions. Prototype question field opens the existing persistent Thesis editor. Device frame and mock-data text are preview-only.


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


## SOURCE-NEWS-1 — automatic editorial connection (2026-10-11)

Today consumes a bounded static source feed produced after existing market refresh: explicitly registered public issuer RSS. Client checks source/issuer, date/expiry, model schema and photo attribution before use. Ranking, storage, private Thesis and financial calculations are unchanged. Valid licensed issuer-related photography is the exception to the older decorative-only cover rule; missing/failed photos keep the supplied Folio image. Brand/wordmark/launch artwork stays authoritative. Original article photos require reviewed reuse permission; related Commons images are explicitly distinguished and credited. AI output is a grounded **draft**, not verified analysis. Key absence/provider failure uses source titles and is disclosed. See `docs/LEADER_SOURCE_PIPELINE.md` for scope, quotas, exact source/rights gates and Actions-secret setup. Live model execution/semantic quality and publisher-photo permissions remain open until evidenced; offline tests do not prove activation.

## LEADER-EDITORIAL-1 — latest user direction (2026-10-11)

Today now centers **오늘의 주도주**: at most five stocks/ETFs from the unchanged Market Summary selection, in the same order and global market/category. This supersedes the older requirement for four personal/question/market/journey covers on Today only. The original personal collection/editors remain in Journal and Journey. Motion keeps shared frame/image/title expansion, reverse transition, focus restoration, scroll preservation and reduced motion. Primary navigation and supplied brand assets are unchanged.

Use existing Folio-token shadcn Button/Slot/CVA and Radix Dialog primitives; Obra Community is a component-system reference, not imported artwork or a copied Figma file. Today controls use 20px radii and covers 24px; other pages keep their existing baseline. Cards show instrument/class, one source-backed saved Research title or existing action guide, and provenance. Research requires explicit matching market+ticker, HTTP(S) source and a fact; rejected observations are excluded. Unknown/stale date, verification and fact/user interpretation remain explicit in detail. Approved decorative photography is labelled separately as **Folio 이미지 · 원문 사진 아님**.

SOURCE-NEWS-1 implements collection and licensed related imagery with an optional AI draft adapter. Live provider execution and publisher-original permissions remain open. Missing research has an explicit state; demo market data is labelled. Ranking, financial calculation, workspace save/sync, journal revisions/backups and identity are unchanged. Validate home/expanded cards at 390/834/1366/1440 Light/Dark and keep four-screen comparisons for other destinations.


## MAGAZINE-1 — latest user direction (2026-10-11)

The user chose a visual magazine with photography, large headings and fewer cards, while retaining **오늘 / 발견 / 저널 / 여정**. Subsequent steering explicitly preserves Today's four Motion cards and shared-element expansion/reverse behavior. This supersedes earlier requirements for a dense sidebar, two-level Journey tabs and duplicated personal galleries.

- Sidebar exposes the four primary destinations; existing market/data/editing workspaces remain available from **도구 및 설정**.
- Discover separates 종목 / 주제 / 시장 신호. Topics no longer repeat the stock finder underneath. Default 종목 retains direct stock exploration; sourced topics and expanded sector/ETF analysis retain their actual data semantics.
- Journal owns writing and the complete personal collection: photographic lead entry, restrained excerpts, category/search; handwriting/questions and backup are optional disclosures. Legacy specialized editors live in the auxiliary menu.
- Journey owns **investment** review and holdings. Single-level 회고 / 관심종목 / 보유종목 replaces nested tabs; life entries and the photo gallery are excluded. Dated investment summaries link to exact original records; original/current evidence is available through an explicit comparison disclosure. Trading Journal remains an auxiliary tool.
- The three redesigned pages use large regular headings and unboxed Paper regions. Supplied identity, market colours and classification/ranking remain unchanged. Today retains the original staggered cover geometry/artwork/motion.


Decision: **2026-10-10 / FOUR-SCREENS-1**. This is the current completion contract for **오늘 / 발견 / 저널 / 여정**. Read it before evaluating these screens.

## Authority and scope

- The attached `image(6).png`, preserved byte-for-byte as [folio-lifetime-ui-concept.png](references/folio-lifetime-ui-concept.png), defines content hierarchy, editorial density and the four destinations. Its example stock prices, dates, photographs and handwriting are illustrative; never fabricate them in production.
- The later approved Motion home direction remains authoritative for Today: four cover cards, a staggered 3:2 / 2:3 wide grid, a single phone column, shared card/image/title expansion and reverse transition. Do not regress to an analytical dashboard or require the concept's single-hero composition literally.
- Supplied 2026-10-07 wordmark/icon/launch artwork remains pixel-authoritative. The concept's plain-text wordmark is not a replacement asset. Level-0 typography, spacing, touch targets, theme and market-colour contracts remain in force.
- Earlier Home/navigation instructions refer to **시장 요약** (`dashboard`) only. The secondary destination is **시장 신호**. Major analytical regions and leadership/tracking controls retain their existing Liquid Glass contracts; notebook reading content stays on Paper, with glass for controls and transient surfaces.
- The original FOUR-SCREENS-1 change established requirements and regression coverage. The 2026-10-11 page-structure implementation below fills the documented gaps where existing data supports them. Passing regression snapshots alone is still not full concept acceptance.

## Screen completion criteria

| ID | Screen | Required result | Current evidence / remaining gap |
| --- | --- | --- | --- |
| TODAY-1 | 오늘 | 오늘의 주도주, existing market/category selection ≤5, image/title/provenance cards; personal writing remains in Journal. | LEADER-EDITORIAL-1 implementation: unchanged Market Summary funnel/order; sourced saved research or existing action guide; explicit missing source and decorative image. **SOURCE-NEWS-1:** issuer RSS, grounded AI draft adapter, licensed related photos. **Open:** live provider quality/activation and publisher-original permissions. |
| TODAY-2 | 오늘 | Enter opens selected leader cover; close/Escape returns focus and preserves scroll; detail opens existing stock analysis. Reduced motion retains information. | `today-leaders.spec.ts` covers all four widths in Light/Dark, sources, stale/rejected/cross-market notes, missing/empty and Market Summary ordering. New Today screenshots require review. |
| DISCOVER-1 | 발견 | `변화하는 세상을 읽다` leads into **종목 / 주제 / 시장 신호**. Each tab has an actual destination and keeps state when returning from detail. | Implemented: editorial heading plus keyboard-accessible **종목 / 주제 / 시장 신호**, defaulting to 종목. Existing filters and selected tab survive stock detail/return. Signal uses the existing expanded sector → ETF workspace; the separate destination is retained. |
| DISCOVER-2 | 발견 | Topic view has a source-backed editorial cover and an observation → company connection. 종목 separately owns 오늘의 주도주 with categories and four leadership classes. Empty/stale sources are explicit. | Implemented from saved Research notes with an HTTP(S) source and observation fact: supplied decorative imagery, factual observation, explicitly labelled user interpretation, source/date/verification, and a link to a matched company. Notes older than 30 days and absent sources are explicit. Existing categories, four class controls and ranked rows are isolated in 종목. No external news feed, invented topic or new ranking. |
| JOURNAL-1 | 저널 | `나의 생각이 쌓이는 곳`, **전체 / 일상 / 투자**, own-record search, photos/ink/text and a clear write action. Filter/search preserve record identity. | Implemented; populated gallery and category labels have screenshot/behavior coverage. |
| JOURNAL-2 | 저널 | An investment page presents **내 가설 / 반대 증거** as separate saved, editable fields. Text, photos and editable vector ink keep dated revisions and honest storage labels. | Implemented: separate saved **내 가설 / 반대 증거**, up to four resized photos with individual removal and collage, existing editable ink and dated revisions. Optional fields preserve legacy entries and version-1 backups; search covers the new fields. Payload limits and account-scoped device storage remain. |
| JOURNEY-1 | 여정 | `그때의 나, 지금의 나`; investment-only dated review summaries and links to exact original records. **회고 / 관심종목 / 보유종목** provide one level of navigation. Life records and photographic collections belong to Journal. | MAGAZINE-1: one level of **회고 / 관심종목 / 보유종목**. Investment-only dated summaries and exact original-record links replace the duplicated personal/photo timeline; 매매 기록 remains in the auxiliary tools. |
| JOURNEY-2 | 여정 | Show the original judgement and later changed judgement with dates, evidence and user wording. `자산 흐름 펼치기` uses sourced portfolio data, with explicit unavailable/empty states. | Implemented: investment-only original/current user judgement, separate dates and evidence in an explicit comparison disclosure. `자산 흐름 펼치기` shows actual entered quantity/cost and available market valuation with correct listing currency; differing currencies, missing prices and empty holdings are explicit. **Open:** historical asset-flow/performance series require transaction/cash-flow data that the app does not have; no simulated history is shown. |
| SHARED-1 | All four | When the shell displays branding, show exactly one supplied wordmark. Compact non-Today screens may retain their existing page-title header. Use the same Paper/Surface/Ink and role-based typography; KR names first, no initials avatar; labels stay readable and controls remain accessible. | Existing identity and functional suites remain required. The concept identifies each compact screen by its page title. |
| SHARED-2 | All four | No horizontal overflow at 390×844, 834×1194, touch 1366×1024 and desktop 1440×900. Light/Dark snapshots exist for every screen. Phone/tablet navigation retains ≥44px targets; physical Safari/Apple Pencil needs actual device evidence. | `four-screen-visual.spec.ts` now has 32 reviewed page-structure PNGs generated on Ubuntu 24.04 with pinned Chromium and complete fonts. The preceding implementation passed 24/24; updated magazine candidates require fresh review and comparison, recorded in HANDOFF. Document-pages interactions cover all four widths. The pre-existing 1366px touch brandbar clipping was fixed in the owning tablet styles; visible brandbar buttons are checked for ≥44px size and vertical containment. Physical Safari/Apple Pencil remains unverified. |

## Regression versus approval

`tests/four-screen-visual.spec.ts-snapshots/` is a **regression-only baseline of the current implementation**, not a claim that the concept is complete. Seeded local records include a two-photo collage, ink, structured investment fields, one dated revision and both life/investment kinds. Saved research and holdings are deterministic test fixtures; topic prose is explicitly labelled as test writing. Live and preferred static market responses, date, locale, timezone, theme, browser and viewport are deterministic. Screenshots contain real app rendering; they are not screenshots of the concept board. Pixel tests capture the fixed visible viewport, with mobile/touch emulation and taps on phone/tablet and mouse input on desktop. They assert the expected pointer/hover media. Full-page Chromium capture can reapply device metrics and change those media mid-capture; it is excluded. Content below the fold and deeper interactions remain covered by the existing behavioral suites, and neither proves physical Safari.

The test uses `toHaveScreenshot`, checks every image has decoded and waits for fonts/market readiness. It preserves content, navigation and styling in the comparison. Do not mask the entire screen or auto-update screenshots in CI. A missing snapshot fails CI.

Generate candidates locally with `npm run test:four-screens -- --update-snapshots=all`, inspect each changed Light/Dark screen, then rerun without updates. Use the repository's pinned Playwright Chromium on **Ubuntu 24.04** (the pinned browser CI runner): install the **complete browser dependencies** with `npx playwright install --with-deps chromium`, then `fonts-noto-cjk`. Font preflight requires Noto CJK, Liberation Sans and **WenQuanYi Zen Hei** (`fonts-wqy-zenhei`, included in Chromium's Linux dependencies). Noto alone does not reproduce Chromium's current CJK fallback. Commit reviewed PNGs alongside the change. Snapshot thresholds are small raster tolerances, not permission to change hierarchy. Report open IDs whenever claiming four-screen completion.

## Definition of done

1. A product change closes the applicable open IDs above with source and interaction evidence; update this table in the same diff.
2. Run `npm run harness:check`, `npm run build`, `npm run test:identity`, `npm run test:four-screens` and relevant/full `npm run test:ui`.
3. Inspect phone/iPad/desktop renders, record exact outcomes in HANDOFF and separate device limits from verified behavior.
4. Reviewers use this contract and the current source. Historical HANDOFF entries and superseded Home rules never override it.
