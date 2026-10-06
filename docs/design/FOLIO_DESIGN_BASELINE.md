# Folio xx — Design Baseline v1.1

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

## 2. Non-negotiable brand geometry

- Wordmark is live **Folio** text + the vector `FolioMark`.
- The xx mark keeps its native **184:104 (~1.769:1)** aspect. Never scale X/Y independently.
- Phone wordmark: **Folio 25px + lowercase-scale xx**. The xx height is **1ex** — optically the same height as the lowercase “o”, never cap-height / uppercase-X scale.
- App/home-screen icon: square full-bleed artwork. **Do not bake rounded/transparent corners into the PNG**; iOS/Android apply the platform mask.
- App-icon xx occupies **58% of tile width**, keeps the 184:104 aspect, remains optically centered, and keeps the negative center diamond.
- Brand mark colour is context-independent: **Plum #54265F → Magenta #A34F78** on the left x and **Magenta → Coral #F06A45 → Amber #F5A24A** on the right x. It must not inherit page text colour.

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

- **Light is the first-run/default experience.** Base paper is now bright editorial `#FAF8F5`; Ink stays `#111113`; deep black stays `#0B0B0D` for deliberate focal contrast only.
- Solid analytical content uses `#FFFFFF` and secondary `#F1EDE8`; it does not become translucent simply to look “glass.”
- Liquid Glass is a **functional layer**, not a card style. Use the Level-0 glass tokens only for navigation, sticky filters/tool controls, drawers/popovers and transient controls.
- Glass baseline: 68–82% white material, 22px blur, 1.18 saturation, 10% ink border and restrained elevation. Always provide an opaque fallback.
- Card radius baseline: **14px**.
- Control radius baseline: **10px**.
- Glass/floating functional radius baseline: **18px** when a floating container actually needs a shape; do not turn ordinary content into pills.
- Pills are only for tags, segmented toggles, and true status chips.
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
- Header, sticky market tabs and bottom navigation share the same **bright functional-glass family** so content can move beneath them without turning analytical panels translucent.
- Active state uses a short quiet rule; no oversized filled pill.
- Search/menu/tab placement stays predictable; glass may change material depth, never navigation semantics.

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
- Light-first shell and manifest colors match `#FAF8F5`.
- Glass appears only on functional layers; primary charts/tables/analysis content remain solid and readable.
- Benchmark-driven changes follow `FOLIO_UI_RESEARCH.md` and state the Folio intent they improve.
