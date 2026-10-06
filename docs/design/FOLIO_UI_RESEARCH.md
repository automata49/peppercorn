# Folio xx — UI Benchmark & Research Protocol

Status: **required design-research method**  
Decision date: 2026-10-06

This protocol turns external UI references into Folio product decisions without cloning another product. The goal is to learn interaction structure, information hierarchy, motion logic and material usage, then validate the adaptation against Folio's job: **discover leadership → understand evidence → form a thesis → track a decision**.

## 1. Evidence order

Use sources in this order:

1. Current first-party product surfaces and first-party design/engineering writing.
2. Current platform guidance (Apple HIG for iOS/iPadOS interaction and materials).
3. Repeatable screen captures from the live product at named viewport/device sizes.
4. Secondary articles/community discussion only as hypotheses, never as design authority.

Record source date and observation date. Do not infer a design rule from a single screenshot when behavior across states is unknown.

## 2. Robinhood benchmark — what to measure

Robinhood is a benchmark for **decision clarity**, not Folio branding or trade-entry UI.

For each studied flow, capture these dimensions:

| Dimension | Measure | Folio translation |
| --- | --- | --- |
| Entry moment | What can be understood in 3–5 seconds? | Market/leader context before dense metrics |
| Primary hierarchy | Largest/first object and first action | One leader/evidence story, not a dashboard wall |
| Progressive disclosure | What is hidden until intent is shown? | Details, heatmaps, full lists and secondary metrics behind disclosure |
| Navigation | Number and stability of top-level destinations | Stable quick nav; deeper research stays nested |
| Scan path | Reading order and alignment | Market → leader → evidence → sector → analysis |
| State feedback | Selected, loading, stale, empty, error | Visible but quiet state language; no layout jump |
| Motion | What state change does motion explain? | Orientation/selection feedback only; no decorative churn |
| Density | Visible choices and competing CTAs | One obvious next action per focal region |
| Recovery | Can secondary failure block the main intent? | Primary leader/analysis journey survives missing secondary modules |

The research output is a **principle + evidence + Folio hypothesis + acceptance test**, never “make it look like Robinhood.”

## 3. Folio decision funnel

The target information hierarchy is:

**Home:** Market context → representative leader → price/momentum evidence → leadership classes → leading sector → market temperature → optional exploration.

**Stock:** Identity/current context → Swing evidence → Position evidence → Thesis/risks → user decision record.

The first viewport should answer:

1. **What matters now?**
2. **Why is it worth attention?**
3. **Where do I go next?**

If a module does not help one of these questions, it moves behind progressive disclosure or to a deeper page.

## 4. Liquid Glass research rule

Follow Apple’s material hierarchy rather than applying blur as decoration.

- Liquid Glass belongs to the **functional layer**: top navigation, compact brand/navigation bars, tab bars, sticky filter/tool controls, drawers/popovers and transient controls.
- Analytical **content stays on solid/standard surfaces**. Charts, tables, thesis cards and data panels do not become glass cards.
- Transparency must have a readable solid fallback.
- Do not stack several translucent layers over one another.
- Use restrained color in glass controls so Folio content and the Sunset Editorial mark remain the focus.
- Test reduced transparency / increased contrast behavior conceptually even when the web platform cannot reproduce every native iOS setting.

## 5. Canonical research viewports

Every major visual hypothesis is checked at:

- **390×844** — phone
- **834×1194** — iPad portrait class
- **1366×768** — compact desktop
- **1440×900** — desktop

Also test touch behavior on the iPad-class layout. A desktop screenshot scaled down is not evidence of mobile quality.

## 6. Experiment loop

For each benchmark idea:

1. **Observe** — capture the current external behavior and Folio’s current behavior.
2. **Abstract** — write the reusable principle without brand-specific styling.
3. **Map** — state the Folio user intent it improves.
4. **Prototype** — change the smallest owning component/token.
5. **Measure** — compare hierarchy, tap depth, first-viewport density and state clarity.
6. **Regression-check** — brand geometry, data semantics, accessibility and canonical viewports.
7. **Keep/revert** — keep only when the Folio decision path is clearer.

Do not accumulate “quality pass” CSS generations. A successful experiment must resolve into a Level-0 token, an owning component, or a documented exception.

## 7. Acceptance heuristics

A UI change is a net improvement when:

- Fresh install opens in **Light**.
- First phone viewport presents one primary analytical story rather than multiple equal-weight panels.
- Top-level navigation remains predictable and reachable.
- Secondary data is available without competing with the primary story.
- Glass is confined to navigation/control layers and content remains legible.
- No new visual vocabulary conflicts with Sunset Editorial B.
- Wordmark/app icon/icon stroke/spacing stay on the Level-0 baseline.
- Investment calculations, classifications and ranking semantics are unchanged unless the task explicitly changes them.

## 8. Current first-party references

- Robinhood, “Introducing a New Visual Identity Reflecting Robinhood’s Growth and Vision for the Future” (2024-10-10): https://robinhood.com/us/en/newsroom/a-new-visual-identity/
- Robinhood Engineering, “Customer Journey: The First Principles Approach to SDLC” (2026-09-02): https://robinhood.com/us/en/careers/blog/customer-journey-the-first-principles-approach-to-sdlc/
- Apple HIG, Materials: https://developer.apple.com/design/human-interface-guidelines/materials
- Apple HIG, Layout: https://developer.apple.com/design/human-interface-guidelines/layout
- Apple, Adopting Liquid Glass: https://developer.apple.com/documentation/TechnologyOverviews/adopting-liquid-glass
- Apple HIG, Tab bars: https://developer.apple.com/design/human-interface-guidelines/tab-bars

Re-check first-party references before making a new benchmark decision; external products and platform guidance change.
