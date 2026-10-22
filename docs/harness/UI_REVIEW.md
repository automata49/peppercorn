## FOLIO-ETF-WATCH-ACTIONS-20261022 — latest UI acceptance

- SECTOR LEADERS is uppercase; ETF LEADERS / ETF 주도 종목 matches ETF MAP / ETF 주도 산업's kicker + title role. The ETF summary data and sorting remain untouched.
- Journey 관심종목 and 보유종목 allow searching and selecting by full company name or ticker, with market + code visible in each selection; duplicates and unsupported inputs show explicit feedback, cross-device data remains account-scoped.
- Basket / interest / Thesis quick actions provide observable state. Existing basket opens on repeat, interest duplicates report why they cannot be added again, Thesis opens the editable record with keyboard focus; preserve all saved records and fixed bottom navigation.
- Reference regressions: `tests/folio-actions-20261022.spec.ts` and `tests/folio-compact-market-20261021.spec.ts`.

## FOLIO-EDITORIAL-RESEARCH-THESIS-20261022 — approved design/workflow corrections

1. One type scale: Folio Insight (FOLIO INSIGHT / 핵심 요약) defines Level-3 English kicker + Korean H3. The shared EditorialHeading must match on all stock-detail tabs, Research and Thesis: title 22–30px, kicker 10–12px, restrained 12px meta. Level-2 page section 26–38px, minor labels 13–16px. Semantic headings and accessible names are required in portrait and landscape.
2. Research belongs to Discover → 리서치 기록. New notes may cover macro/sector/industry without a stock ticker. Record list and writing panel share account-scoped original research objects, with sourced observations below and advanced vertical comparison under progressive disclosure. Preserve record IDs, source verification, explicit confirm, blur-save, safe source URL validation, and cloud readiness failure feedback.
3. Thesis belongs to a selected stock with a single record list and editable analysis form (automated SEC/DART values read-only). Desktop/wide: record selector left and writer right. Mobile/iPad portrait: record picker above writer. Preserve record IDs/date, archived theses, typed percent/boolean values, protected new-record creation and account sync. Do not merge Thesis with Research.
4. Remove redundant grey decorative section rules around editorial blocks only. Retain active tab indicator, real table divisions, form input boundaries, focus outlines and semantic grouping.
5. Validate at 390/834/1440px, light/dark, with heading font scale matching Folio Insight; research notes create/edit/refresh and URL safety; Thesis new-record/edit/validation and no viewport overflow. Browser regression is not physical Safari certification.

## FOLIO-EDITORIAL-RESEARCH-THESIS-20261022 — approved information hierarchy & writing (2026-10-22)

- Treat 종목 상세 → Overview's **FOLIO INSIGHT / 핵심 요약** as a canonical semantic Level-2 style: uppercase English kicker 10px, Korean title 24–32px responsive Folio editorial, and optional subdued metadata. Apply to Leadership Check, Same Industry, Compare, Analysis, Financials and Thesis section heads; maintain Level-3 text/metric distinction without duplicating page headings or altering prices/market colors.
- Discover → 리서치 기록 is now a **writing-first workspace**, followed by sourced observation cards and a full research page for advanced comparison. Creating a macro/industry/sector note never requires a ticker. Records select by persistent ID; edits save to the original account-scoped research record on blur/change and preserve typed data plus source provenance. Bad/unsafe URLs are shown as errors instead of being saved. Cloud-not-ready rejects a creation/edit with visible feedback; do not suggest a save completed if it did not.
- Thesis: preserve distinct account-scoped analysis records and editing; arrange record list → selected stock/Thesis sheet → optional historical comparison. Selecting a missing-universe archive clears stale active stock while keeping the original editable note. Starting a Thesis without cloud readiness must not create an unsynced phantom record; initial notes keep the selected stock ID.
- Delete **only redundant interior grey borders** from nested stock-detail insights/snapshots/Thesis chrome and research cards. Keep functional tab selection underlines, focused inputs, metric/table separators, interactive affordances and theme/market semantics.
- Mobile 390px / iPad 834px portrait first; adapt 1366px landscape / 1440px desktop, Dark and Light. Test headings (kicker/title), research create/edit/reload without stock, source URL validation, Thesis create/edit/archived record, sync guards, comparison accessibility and no overflow. Save coordinates, versioned journals, investment classifications, financial read-only values and PDF/news rights do not change.

## FOLIO-REPORT-WHEEL-20261022 — report/news filter scope (2026-10-22)

- Discover → 시장 신호 → MARKET & COMPANIES: **리포트** mode displays PDF research reports without the market or stock-category vertical wheels. Apply equally to signed-in lists and signed-out/empty/error cases on every viewport.
- **뉴스** mode alone mounts market / stock-category FilterWheels. Switching to 리포트 removes the controls from DOM and accessibility tree; switching to 뉴스 restores persisted selections. Leave 종목 검토 wheels untouched.
- Preserve private PDF access, source/rights, news freshness, saved filters, 44px hit targets and stock rankings. Regression: reports have zero wheels; news has two functioning wheels; mode toggles preserve selections; 390/834/1440px no horizontal overflow.

## FOLIO-INK-TABS-BACK-20261022 — approved responsive correction (2026-10-22)

- Journal read-first ink preview frames actual stroke bounds, not the mostly-empty 1000-wide writing paper. Fit to available reading width and permit vertical scrolling for longer ink. Never resave, migrate or alter original stroke coordinates; thumbnail and editable paper views retain original geometry.
- In stock Overview, basket / interest / Thesis actions follow content at the **same bottom position** as Analysis / Financials / Thesis. Preserve cloud-write guards, live state, selected instrument and existing Thesis routing.
- Discover tabs show 시장 신호 / 종목 검토 / 리서치 기록, preserving their original signal / stocks / topics internal IDs, content and history. Discover and Journey (재검토 / 관심종목 / 보유종목) use stock-detail's flat three-column underline tabs, type >=15px on phone/iPad portrait, controls >=44px, visible keyboard focus and theme-aware ink.
- One canonical page route owns Back. Popstate must not repaint the already-current route when closing a child drill, and page transitions should not wait in a blank state or remount because an unrelated tab changed. Edge-swipe, header button and native browser Back agree; preserve reduced-motion behavior and fixed navigation.
- Regression: 390px phone, 834px portrait iPad, 1366px landscape, 1440px desktop; Light/Dark, tab selection and reload, journal ink legibility, long/short labels and page restoration. Chromium tests do not certify physical Safari. No source rights, user data, market classifications or rankings change.

## FOLIO-MARKET-LEADERS-WHEEL-20261021 — approved compact correction (2026-10-21)

- Discover → 종목: MARKET LEADERS / 주도 종목 matches Market Signal's Sector Leaders / 주도 섹터 editorial typography (eyebrow, headline, scale, line height and spacing) while Filter & Sort remains right-aligned.
- Leadership wheel ALWAYS renders all equity choices in order: 핵심 주도, 주도 후보, 강세 전환, 조정 중, 전체. Compact 128px portrait / 136px wide viewport shows a legible adjacent option and retains actual vertical scrolling to the last choice; never replace it with a one-label static display.
- Native touch swipes, momentum/scroll settlement, click, ArrowUp/Down and persisted selection must update the same stock filter. A non-programmatic scroll must commit even when no pointerdown event was emitted. A programmatic recenter must not change the filter. ETF stays independent, with non-equity classifications disabled; no change to ranks, counts or market colours.
- Regression: computed heading styles equal Signal; all five wheel DOM options exist and are scroll-reachable; active option is centered, swipe/click/keyboard select and refresh restore it at 390px, 834px, 1194px, 1440px; no page horizontal overflow. Preserve reduced-motion and minimum 44px touch target.

## FOLIO-WORKFLOW-20261021-B — approved revision (2026-10-21)

1. Audit the app's page / section / subsection editorial hierarchy with one bilingual typography contract: uppercase English kicker, Korean heading, shared semantic h1/h2/h3 and spacing. Do not add duplicate page titles where SectionHeading already owns the region.
2. Discover opens on 시장 신호. "주도 종목 →" switches to its canonical 종목 tab (not a duplicate full-metrics drill page). Direct Market Signal shortcuts also select this tab.
3. Route all Journey Watchlist / Portfolio shortcuts into 여정 → 관심 종목 / 보유 종목; render the same underlying account-scoped records once. Store Discover/Journey tab state in route history so native and in-app Back restore the exact preceding view; no modal history push.
4. Research, Watchlist, Portfolio, Thesis records and Trading Journal use shared vertical field-by-row / record-by-column comparison editing. Automatic/source values are read-only; user-entered numeric and boolean values retain their types, with existing delete confirmation preserved. Input commits preserve IDs, units and cloud-sync pathways. More columns are horizontally scrollable; mobile retains >=44px controls.
5. All vertical wheels use readable native-inspired Liquid Glass (CSS web approximation), visible selected preview, all options scrollable, keyboard/touch scrolling and reduced motion/transparency fallbacks. Equity leadership order is 핵심 주도, 주도 후보, 강세 전환, 조정 중, 전체; ETF is independent of equity leadership.
6. Keep all existing market classifications, KR/US colors, rankings, source rights, Folio brand, journaling records and theme. Verify 390px iPhone, 834px iPad portrait, 1366px landscape, 1440px desktop; light/dark, long labels, tab/back/restoration, and source read-only editing. CI/browser emulator success is not real Safari certification.

## FOLIO-WORKFLOW-20261021 — latest user authority (2026-10-21)

Discover / Market Signal / detail / Journal use one continuous reversible workflow: discover leaders → source and stock → save interest/Thesis → read original Journal → explicitly edit/review. Mobile and iPad portrait set the baseline; landscape/desktop reflow without smaller touch targets.

1. MARKET & COMPANIES / 시장과 기업의 새 소식 lives in 시장 신호, not above 주도 종목. Private PDF reports remain the default; public news adds independently persisted market and stock-category vertical wheels. Preserve report privacy and source provenance, expiry and original-image rights. The inline and direct Market Signal routes share the same editorial surface.
2. Discover's stock list starts with one 주도 종목 title and right-aligned Filter & Sort above market / category / leadership vertical wheels. The **right-edge drawer** controls every filter: market, size, leadership, sector, local sort, list/cards, advanced lens. All selections persist per-device across reloads, with an explicit entire-market and entire-leadership choice. An active category tap is idempotent. A market change clears dependent sector state only after a real change.
3. The selected wheel row has high-contrast neutral transparent Liquid Glass, with opaque fallback, 3D rotation and dynamic preview. All physical tap rectangles remain at least 44px even when label transforms; touch vertical scroll, ArrowUp/Down and scroll settle must work. Reduce motion when requested.
4. Stock detail button Back, edge-swipe and native Back restore the exact previous route once. Popstate owns route restoration; do not create a duplicate navigation push or a delayed Today redirect.
5. Overview's redundant introduction is removed. Stock detail's basket/interest/Thesis actions are unboxed, list-toggle-like editorial controls. Interest creates a real account-scoped watchlist record; Thesis creates or opens the selected stock's persisted analysis **inside its own Thesis tab**, preserving the original stock and no phantom navigation. Keep owner-read-before-write and show pending/error appropriately.
6. Menu auxiliary destinations group as 저널 · 리서치 and 여정 · 추적. Journal cards first open a read-only record with rich text/photo/ink; a deliberate 수정 action enters the existing guarded editor, preserving revisions/backups/account sync.
7. Do not alter market ranking/classification, ETF separateness, KR/US colours, source rights, private data, Today identity, or add extra AI/model/news ingestion for this UI request.

Verification: harness:check, TS/Vite build, discovery/news/detail/Journal/menu interaction tests, four-screen snapshots (390/834/1366/1440 Light/Dark), orientation/overflow, reload and touch hit boxes. Simulator success never claims real Safari verification.

Review responsive right-edge drawer, selected 3D wheel state/tap geometry, signal-only news, stable Back after at least one second, Journal read-before-edit, and dark/light contrast.

## JOURNAL-VIEW-1 — optional layouts (2026-10-16)

Journal and Journey's 재판단 each offer a visible, accessible 카드형/목록형 switch at the content heading. Journal defaults to photo-led cards; Journey defaults to its priority-ordered decision list. Persist view choices separately in device localStorage (`folio-journal-view`, `folio-journey-view`), never altering record IDs, data, review order, private cloud notebooks, filters, batching or navigation. Journal list rows are text-only (no image, ink thumbnail or decorative linked-record cover), showing date, category, optional ticker, title and a short excerpt. Journal cards retain their images. Journey's list is likewise text-only; Journey cards retain decision status, judgement, next check, evidence disclosure, original and re-review actions. Both layouts must be readable at 390/834/1366px, respect selected theme and accessibility, preserve search/calendar and survive reload; storage denial must not break the UI. Check `tests/journal-view-mode.spec.ts` as well as existing editorial/decision/four-screen checks.

## JOURNAL-EDITORIAL-1 — user direction (2026-10-15)

Journal and Journey extend the Patagonia-inspired Folio editorial hierarchy beneath the unchanged shared SectionHeading. Landscape >=700px and desktop >=1024px place search/calendar in a left column; portrait keeps inline filters and a two-column gallery. Journal/Review cards use neutral translucent Liquid Glass with inset highlights and a readable overlapping glass caption; opaque fallback and reduced transparency are supported. Preserve dates, grouping, 40-record batches, original linked editors, private PDF readers, backup/import, Motion/focus, and dirty-edit protection. Journey prioritizes investment reflections; existing asset disclosure follows the records, and review/watchlist/holdings remain a single tab level. New destination/caption labels have no arrows or “으로” suffix. Supplied identity, shared title/image sizes, themes, market semantics and stored data remain unchanged. CSS approximates glass, not native Apple rendering.

## PATAGONIA-HOME-2 — user direction (2026-10-15)

Today extends the Patagonia-inspired photo-led composition to landscape viewports: full-bleed lead photo, centered editorial heading and short copy, one visible story action, then Discover/Journal/Journey photographs. Landscape places the three secondary covers in one row. Per the latest user correction, portrait preserves the existing staggered TWO-column photo grid and matte heading above it; no portrait hero/swipe redesign. An accessible direct destination row links Discover/Journal/Journey without removing existing card previews. Keep all four existing Motion expansions, original personal-photo priority, supplied identity, bottom navigation, search/basket and reduced motion. This supersedes the compact staggered Home grid in OBRA-REFERENCE-1 and desktop-only scope of PATAGONIA-DESKTOP-1. Folio uses its own content/photos; no Patagonia artwork is copied.

## DISCOVERY-NEWS-1 — user direction (2026-10-15)

Discover adds a source-backed editorial news strip above its stock tabs/catalogue, inspired by Patagonia's down-jacket listing. Keep shared page-title/image dimensions. Up to four newest public official issuer items, exact market+ticker matching, seven-day publication window and original expiry; image, instrument/industry eyebrow, headline, short summary, dated source and original/security links. Portrait uses horizontal swipe previews; landscape uses three/four columns. Reuse the existing validated RSS/image pipeline without extra browser/model calls. Explicit original/related/decorative photo labels and attribution remain; no fabricated latest news or macro claims. The optional news strip takes precedence over older first-card-in-initial-viewport expectations. Preserve screening, market colors, private reports and the hidden Today Gemini section.

## RESPONSIVE-BASKET-1 — user direction (2026-10-15)

Filter & Sort stays open as a nonmodal left sidebar at >=1024px or landscape >=480px; compact portrait uses the existing accessible drawer. Rotation preserves selections and closes the old modal. Discover / Journal / Journey share SectionHeading typography and image dimensions; Today keeps its distinct composition and removes its visible “홈” masthead label. Every page has accessible header search and basket icons. Cards and stock detail add deduplicated market+ticker entries to an account-scoped, device-local basket with remove, reopen and reload persistence. Basket is a research collection, never an order flow. Discover stock cards have neutral translucent Liquid Glass surfaces, blur, inset highlights and 24px corners, with sibling detail/add buttons and >=44px targets. Preserve ranking, filters, ETF semantics, theme/market colors and notebook data. This supersedes DISCOVERY-FILTER-2's always-collapsed and unboxed-card rules only. Browser CSS approximates Liquid Glass; native Apple rendering is not claimed.

# Current Folio UI review procedure

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


Use for read-only identity, responsive UI and completion review. Read CONTRACT, the current HANDOFF entry, FOLIO_DESIGN_BASELINE, FOLIO_IDENTITY_V2, FOLIO_LIFETIME_UI and **docs/design/FOLIO_SCREEN_ACCEPTANCE.md**. The latter owns four-screen completion and explicitly lists open gaps.

1. Verify primary **오늘 / 발견 / 저널 / 여정**. Today keeps the approved Motion covers and accessible reverse transition. Earlier analytical Home placement belongs to **시장 요약** only. **시장 신호** retains expanded sector → ETF analysis and the shared ranked ETF pool.
2. Check the supplied wordmark, installed black-icon derivatives, portrait/wide launch assets and legacy-wide-copy mask. Do not redraw brand assets or substitute the concept board's example lettering. Keep Light-first, Dark/System, role typography, shared AppIcon and market-specific signed colours.
3. Apply the latest MAGAZINE-1 exception: matte primary regions, four primary sidebar links, single-level Journey review/watchlist/holdings, Journal collection with optional tools collapsed. Journey excludes life/photo galleries and duplicate trading journals. Today retains its original Motion cards. Check Paper notebook content; glass on interactive/transient notebook surfaces, analytical major regions and leadership/tracking controls under their existing contracts. The obsolete selector-only glass restriction does not apply.
4. Evaluate each affected acceptance ID. Topic tabs/cover, structured hypothesis/counter-evidence, judgement comparison and asset flow remain open until implemented. Do not infer completeness from installed libraries, revision counts, exported screenshots or passing regression-only snapshots.
5. Require harness/build/identity, four-screen PNG comparisons and relevant interaction tests. Inspect actual/expected/diff evidence. Snapshot updates need visual review; CI never updates them. Check 390/834/1366/1440 Light/Dark coverage, touch/focus/overflow and preserved data/ranking/storage semantics.
6. Return severity, file, reproducible evidence, exact executed checks and outstanding acceptance IDs. Physical Safari/Pencil claims require device evidence. Stay read-only and never approve unrun checks.

- ComparisonSheet typed input preservation: null→number inputs must remain numeric for score formulas, true/false selector values must remain booleans, and '관리' deletion retains its confirmation modal and cloud sync. Regression test on analysis records.

## FOLIO-COMPACT-MARKET-20261021 — approved refinement
- Reference surfaces are iPhone and iPad **portrait**; preserve native wheel vertical gesture, independent column scrolling, fixed selected indicator, 44px minimum hit rows, keyboard access, reduced motion/transparency, with correct landscape/desktop adaptation.
- All vertical wheels (Stock filters and News filters) use a **128px** scrolling viewport on portrait, **136px** on wide layouts; selection center uses matching padding, not a clipped decorative scale. Compress heading and inter-row whitespace but never touch target size.
- Discover → Market Signal removes the **MARKET MAP / 시장 신호 / 주도 종목 →** redundant hero row entirely. Discover tab remains the single navigation route.
- Match MARKET & COMPANIES / 시장과 기업의 새 소식 font metrics exactly for **Sector Leaders / 주도 섹터**, **SECTOR MAP / 시장 지표 · 섹터 히트맵**, and **ETF MAP / ETF 주도 산업** (eyebrow, headline, spacing and responsive scale). Maintain semantic headings without duplicate ETF industry heading.
- Remove the top-level ETF / "홈과 동일한 … ETF RS 순위를 이어서 봅니다" copy, but retain ETF industry heatmap, ranked top-five list, data source, dialogs and all selection mechanics.
- Gates: mobile 390, iPad 834 portrait, 1194 landscape, desktop 1440; verify selected wheel and touch targets/independent scrolling, typography parity, no page overflow, absent duplicate row/copy and unchanged map + ETF interactions. Bypass no existing checks; add only targeted regressions.
