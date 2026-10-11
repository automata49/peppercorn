# Peppercorn — Codex

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
