# Folio xx — Design Baseline v1.0

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
- Loading uses the supplied **9:16** portrait hero. Do not revert to the former 508:235 landscape composition.
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

- Launch B hero keeps **508:235** composition; no portrait crop.
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
