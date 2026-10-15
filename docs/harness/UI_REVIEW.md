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
