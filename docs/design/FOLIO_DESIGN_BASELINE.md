# Folio xx — Design Baseline v1.0

## FOUR-SCREENS-1 — current review authority (2026-10-10)

Read `docs/design/FOLIO_SCREEN_ACCEPTANCE.md` and `docs/harness/UI_REVIEW.md` for Today/Discover/Journal/Journey work. Primary navigation is **오늘 / 발견 / 저널 / 여정**; older analytical Home placement applies to **시장 요약** only. Preserve the approved Motion home. Screen completion requires the acceptance IDs, not just passing current-screen screenshots. Run `npm run test:four-screens` in addition to the existing gates; report the explicitly open product gaps. Notebook Paper/glass and analytical major-region/leadership glass follow their current contracts, not the historical selector-only restriction.

Status: **Level 0 / authoritative**  
Decision date: 2026-10-06

This file exists to stop iterative visual drift. Future design work starts from this baseline; it does not invent a new visual system per screen.

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

## LIFETIME-JOURNEY-1 — user decision 2026-10-10 (current)

This decision supersedes older Home/navigation placement rules only. Primary navigation is **오늘 / 발견 / 저널 / 여정**. Today follows the Motion App Store editorial demo: four large cover cards in a staggered 3:2 / 2:3 desktop grid, one-column phone layout, shared frame/image/title expansion into an accessible detail, and reverse transition to the original card. Covers contain the latest own page, a question/due review, discovery, and journey; supplied assets remain authoritative. The former analytical Home remains accessible as **시장 요약** (`dashboard`); its existing market/category/leader/ETF parity contracts still apply there. Discover retains the existing stock analysis and ranking. Journal links to the canonical Thesis, Research and Trading Journal editors. Journey adds a read-only personal timeline before interest/holdings/trade tabs. No screening, ranking, market colours or supplied brand assets change.

Six implementation stages: Folio-token shadcn-style Button/Slot/CVA primitives; Radix Tabs and Dialog focus/keyboard behavior; Motion shared-element journal card transitions respecting reduced motion; lazily loaded Lightweight Charts actual daily close zoom (existing PriceRsChart remains the default); lazy Tiptap structured journal editor with photo, vector ink, questions and dated revisions; Ticker-inspired web digit transitions retaining exact accessible values (no Android package). Existing GSAP owns launch only.

New lifetime entries are **device-local, account-scoped IndexedDB**, explicitly labelled, with JSON export/import; existing cloud workspaces are unchanged. No claim of cloud sync, OCR, native PencilKit or live AI. Pen/mouse ink is implemented; physical Apple Pencil/Safari fidelity requires device validation. Backup imports do not overwrite existing records. Per-entry atomic writes preserve other tabs and reject stale same-record edits. Notebook payload is limited before saving to preserve export/import round trips. Questions are editable answers from fixed prompts, not generated investment advice.

Keep body content legible on Paper. Glass is for interactive controls and transient surfaces; existing analytical glass contracts remain. Minimum 44px controls, canonical 390/834/1366/1440 checks, supplied wordmark, default Light, Dark/System, and existing chart gap/RS rules remain acceptance criteria. New notebook tests cover create/reload/revision, concurrent tabs, backups, photo/ink, keyboard tabs, reduced motion and real-close chart.
