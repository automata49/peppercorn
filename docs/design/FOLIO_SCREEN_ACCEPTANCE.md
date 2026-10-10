# Folio xx — four-screen acceptance contract

Decision: **2026-10-10 / FOUR-SCREENS-1**. This is the current completion contract for **오늘 / 발견 / 저널 / 여정**. Read it before evaluating these screens.

## Authority and scope

- The attached `image(6).png`, preserved byte-for-byte as [folio-lifetime-ui-concept.png](references/folio-lifetime-ui-concept.png), defines content hierarchy, editorial density and the four destinations. Its example stock prices, dates, photographs and handwriting are illustrative; never fabricate them in production.
- The later approved Motion home direction remains authoritative for Today: four cover cards, a staggered 3:2 / 2:3 wide grid, a single phone column, shared card/image/title expansion and reverse transition. Do not regress to an analytical dashboard or require the concept's single-hero composition literally.
- Supplied 2026-10-07 wordmark/icon/launch artwork remains pixel-authoritative. The concept's plain-text wordmark is not a replacement asset. Level-0 typography, spacing, touch targets, theme and market-colour contracts remain in force.
- Earlier Home/navigation instructions refer to **시장 요약** (`dashboard`) only. The secondary destination is **시장 신호**. Major analytical regions and leadership/tracking controls retain their existing Liquid Glass contracts; notebook reading content stays on Paper, with glass for controls and transient surfaces.
- This change establishes requirements and regression coverage; it does not implement the open product gaps below. A passing current-screen snapshot must never be reported as full concept acceptance.

## Screen completion criteria

| ID | Screen | Required result | Current evidence / remaining gap |
| --- | --- | --- | --- |
| TODAY-1 | 오늘 | Date and a reflective invitation precede own latest page, a question/due review, discovery and journey covers. One clear write action remains accessible. Missing records have an honest first-page state. | Four Motion covers, local latest record, fixed questions/due reviews and `새 페이지 쓰기` exist. Reflective invitation / concept wording hierarchy still needs a product pass. |
| TODAY-2 | 오늘 | Enter opens the chosen cover; close/Escape returns focus and preserves scroll. Reduced motion retains the same information. | Covered by `lifetime.spec.ts`; screenshots cover the populated landing state. |
| DISCOVER-1 | 발견 | `변화하는 세상을 읽다` leads into **주제 / 종목 / 시장 신호**. Each tab has an actual destination and keeps state when returning from detail. | **Open:** currently a stock-list workspace; topic/signal tabs and the editorial header are not implemented. |
| DISCOVER-2 | 발견 | Topic view has a source-backed editorial cover and an observation → company connection; then 오늘의 주도주 with categories and four leadership classes. Empty/stale sources are explicit. | **Open:** topic cover/feed absent. Existing stock rows, size controls and four class controls remain regression-protected. Do not invent an AI-energy story or new ranking. |
| JOURNAL-1 | 저널 | `나의 생각이 쌓이는 곳`, **전체 / 일상 / 투자**, own-record search, photos/ink/text and a clear write action. Filter/search preserve record identity. | Implemented; populated gallery and category labels have screenshot/behavior coverage. |
| JOURNAL-2 | 저널 | An investment page presents **내 가설 / 반대 증거** as separate saved, editable fields. Text, photos and editable vector ink keep dated revisions and honest storage labels. | **Open:** photo/ink/question-answer/revisions exist, but separate hypothesis/counter-evidence fields and a photo collage do not. Any schema extension must preserve existing entries and backups. |
| JOURNEY-1 | 여정 | `그때의 나, 지금의 나`; dated personal timeline, real photos/writing and links to exact original records. **회고 / 관심·보유** remain a clear product grouping with the existing underlying tools available. | Timeline and exact record opening exist. **Open:** current tabs are 회고 / 관심종목 / 보유종목 / 투자일지; the concept grouping remains a product decision to implement. |
| JOURNEY-2 | 여정 | Show the original judgement and later changed judgement with dates, evidence and user wording. `자산 흐름 펼치기` uses sourced portfolio data, with explicit unavailable/empty states. | **Open:** revision counts/history exist, but direct judgement comparison and the asset-flow disclosure do not. A revision count alone is insufficient. |
| SHARED-1 | All four | When the shell displays branding, show exactly one supplied wordmark. Compact non-Today screens may retain their existing page-title header. Use the same Paper/Surface/Ink and role-based typography; KR names first, no initials avatar; labels stay readable and controls remain accessible. | Existing identity and functional suites remain required. The concept identifies each compact screen by its page title. |
| SHARED-2 | All four | No horizontal overflow at 390×844, 834×1194, touch 1366×1024 and desktop 1440×900. Light/Dark snapshots exist for every screen. Phone/tablet navigation retains ≥44px targets; physical Safari/Apple Pencil needs actual device evidence. | New `four-screen-visual.spec.ts` compares 32 committed PNGs; existing responsive/functional suites supply deeper interaction checks. |

## Regression versus approval

`tests/four-screen-visual.spec.ts-snapshots/` is a **regression-only baseline of the current implementation**, not a claim that the concept is complete. Seeded local records include photo, ink, one dated revision and both life/investment kinds. Live and preferred static market responses, date, locale, timezone, theme, browser and viewport are deterministic. Screenshots contain real app rendering; they are not screenshots of the concept board. Pixel tests capture the fixed visible viewport, with mobile/touch emulation and taps on phone/tablet and mouse input on desktop. They assert the expected pointer/hover media. Full-page Chromium capture can reapply device metrics and change those media mid-capture; it is excluded. Content below the fold and deeper interactions remain covered by the existing behavioral suites, and neither proves physical Safari.

The test uses `toHaveScreenshot`, checks every image has decoded and waits for fonts/market readiness. It preserves content, navigation and styling in the comparison. Do not mask the entire screen or auto-update screenshots in CI. A missing snapshot fails CI.

Generate candidates locally with `npm run test:four-screens -- --update-snapshots=all`, inspect each changed Light/Dark screen, then rerun without updates. Use the repository's pinned Playwright Chromium on Linux with Noto CJK and Liberation fonts (CI's browser dependencies and `fonts-noto-cjk`). Font preflight fails if either family is missing. Commit reviewed PNGs alongside the change. Snapshot thresholds are small raster tolerances, not permission to change hierarchy. Report open IDs whenever claiming four-screen completion.

## Definition of done

1. A product change closes the applicable open IDs above with source and interaction evidence; update this table in the same diff.
2. Run `npm run harness:check`, `npm run build`, `npm run test:identity`, `npm run test:four-screens` and relevant/full `npm run test:ui`.
3. Inspect phone/iPad/desktop renders, record exact outcomes in HANDOFF and separate device limits from verified behavior.
4. Reviewers use this contract and the current source. Historical HANDOFF entries and superseded Home rules never override it.
