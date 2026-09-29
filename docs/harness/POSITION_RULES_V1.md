# Position rules v1 — design, backtest and activation gate

Rule file: `analysis/fundamentals/rules/position_rules_v1.json` (`position-rules-v1`). Engine: `analysis/fundamentals/labels.py`. Backtest: `analysis/fundamentals/backtest.py`, workflow `.github/workflows/position-backtest.yml`. Every threshold and its basis lives in the rule file; this page records why, how it was tested and whether it may be shown.

## Scope

US only. KR has no point-in-time filing archive (a lookahead-free backtest is impossible) and no weighted diluted share basis for Value, so KR snapshots stay `insufficient_data` under v1. Four independent labels, one reason each, never combined. Any missing input — including price, the 10-year Treasury yield or the registrant SIC code — leaves the snapshot `insufficient_data` with no labels.

| Label | Values | Decided by |
|---|---|---|
| Type | Unprofitable, Cyclical, Fast Grower, Stalwart, Slow Grower | TTM operating income ≤ 0; else SEC SIC code in the declared cyclical industries; else 3-year TTM revenue CAGR ≥15% / ≥5% / below (Lynch) |
| Quality | High, Average, Low | ROIC (cyclicals: mean of annual points over the window) ≥15% with 12-quarter FCF conversion ≥70% and share growth ≤3% → High; ROIC <8% or 12-quarter FCF ≤0 → Low |
| Growth | Durable, Moderate, Weak | Non-cyclical: consistency of the last 12 TTM year-over-year changes, momentum and a 3% floor; cyclical: latest 12-quarter revenue vs the prior 12 quarters |
| Value | Attractive, Fair, Expensive, Speculative | Growth implied by the enterprise value in a 10-year DCF of FCF minus SBC, against bear/base/bull growth; discount rate = max(10-year Treasury, 2.5%) + 5% |

Not covered by v1, and stated in reasons where relevant: incremental ROIC, qualitative capital allocation, reinvestment runway and competitive evidence (they need cited filing text), and operating-lease adjustment beyond `US-ROIC-2`.

## Data changes made for the backtest

The SEC extraction was built around NVIDIA; a 43-company first run labelled only 54 of 387 observations. Changes, each covered by tests in `test_fundamentals.py`:

- Fallback tags fill only spans or dates with no primary tag, so a narrower concept never replaces a broader one: revenue (`RevenueFromContractWithCustomerIncludingAssessedTax`, `SalesRevenueGoodsNet`), net income (`NetIncomeLossAvailableToCommonStockholdersBasic`), operating cash flow (continuing operations), cash (including restricted cash), debt (`LongTermDebtAndCapitalLeaseObligations…` total and noncurrent families).
- `not_presented`: short-term investments, debt or the current portion count as zero only when no candidate concept has a value at any of the latest 8 quarter ends. This is `US-ROIC-2`; numbers for NVDA and Samsung are unchanged. The zero never becomes a stored fact.
- Fiscal Q4 weighted diluted shares are rarely filed, so the share basis may come from the previous quarter.
- `metrics.compute` no longer crashes when the latest TTM operating income is missing; the pre-2018 US statutory rate (35%) was added for backtest quarters.

Still not covered, so these companies or dates stay unlabelled: no operating income line (CVX, IBM, JNJ, NKE, NUE, PFE, DOW), captive finance arms (F, GM, CAT), 16-week fiscal quarters (COST, PEP), quarterly SBC not filed (T, VZ, WMT and others), and short registrant histories after reorganizations (DIS, AVGO).

## Backtest design

- Universe: 114 US non-financial large caps fixed in `backtest.py` before results were read (113 fetched; WBA is no longer in the SEC ticker list). Survivorship bias: all are listed today.
- Dates: nine half-year ends, 2018-06-30 to 2022-06-30. At each date only facts filed on or before it are used; price and 10-year yield are that day's close. The SIC code is the current one (SEC publishes no history) — a small lookahead.
- Outcomes on today's data: Quality → mean ROIC at +4, +8, +12 quarters; Growth → 3-year forward TTM revenue CAGR; Value → 3-year total return minus the same-date median of labelled companies; Type → maximum forward TTM revenue drawdown over 12 quarters.

## Pre-registered acceptance (set before the decisive run)

Activation (`"active": true` in the rule file) requires all of:

- A1 Quality: median forward ROIC strictly ordered High > Average > Low, each group n ≥ 10.
- A2 Growth: median forward revenue CAGR strictly ordered Durable > Moderate > Weak, each n ≥ 10.
- A3 Value: median forward excess return strictly ordered Attractive > Fair > Expensive, each n ≥ 10.
- A4 Type: median forward drawdown of Cyclical above the others, and type unchanged between consecutive dates in ≥ 80% of cases.
- A5 Coverage: at least 40 companies labelled at least once.

The share of observations whose realized growth reached the price-implied growth is reported for Value as information only.

History. The first full run (fixed 9% discount rate, drawdown-based cyclicals) is recorded here because it motivated two design changes made before this gate was set: Quality and Growth were ordered, Type passed its drawdown test but classified KO, PG, ABT, DHR (divestitures), MSFT (impairment) and ADBE (subscription transition) as cyclical, and Value was not ordered (Attractive +0.5%, Fair +6.1%, Expensive −2.5%) with 59% of observations Expensive under a 9% rate that ignored 2018–2022 yields. The changes: cyclicals by SIC industry (Lynch's definition) with drawdowns kept as evidence, and a point-in-time discount rate. Thresholds were not tuned to returns.

## Result of position-rules-v1 (run 36574949420, commit 952d635)

386 of 1,018 observations labelled across 60 companies. Activation: **no**.

| Test | Result |
|---|---|
| A1 Quality, forward ROIC | pass: High 40.4% (n 116) > Average 14.4% (39) > Low 6.6% (22) |
| A2 Growth, forward revenue CAGR | **fail**: Durable 9.3% (205) > Moderate 5.1% (110), but Weak 5.2% (71) |
| A3 Value, forward excess return | pass: Attractive +5.5% (74) > Fair +2.3% (134) > Expensive −4.0% (159) |
| A4 Type | pass: Cyclical forward drawdown 12.3% vs 2.5%; stability 88% |
| A5 Coverage | pass: 60 companies |

Value, informational: realized growth reached the implied growth in 69% of Attractive, 51% of Fair and 14% of Expensive observations.

Diagnosis. v1 made growth Weak whenever the latest TTM change was negative. Many such observations were 2020 shocks (for example SBUX, MCD, BKNG) that rebounded, so Weak and Moderate had the same forward growth.

## position-rules-v1.1 (pre-registered before any v1.1 run)

Single change: Weak requires sustained weakness — 3-year TTM revenue CAGR below 0%, or fewer than 50% of the last 12 TTM changes positive. A negative latest change still prevents Durable. Every other rule and threshold is identical to v1. `position-rules-v1` stays in the repository as the failed candidate.

Because this change was informed by the in-sample result, v1.1 is activated only if A1–A5 pass on both:

1. the in-sample dates (2018-06-30 … 2022-06-30), and
2. holdout dates never used for any design decision: 2014-06-30, 2014-12-31, … 2017-12-31 (eight half-year ends).

If either fails, v1.1 stays inactive and no label is shown.

## Result of position-rules-v1.1 (run 36582942133, commit 1ee4b51)

Activation: **no**. The in-sample gate passed; the holdout gate failed A1 and A3, so v1.1 stays `"active": false` and no Position label is written or shown.

| Test | In-sample 2018–2022 (386 labelled, 60 companies) | Holdout 2014–2017 (268 labelled, 46 companies) |
|---|---|---|
| A1 Quality, forward ROIC | pass: 40.4% (116) > 14.4% (39) > 6.6% (22) | **fail**: 37.2% (84) > 19.3% (21), Low 19.6% with only 5 observations |
| A2 Growth, forward revenue CAGR | pass: 9.3% (205) > 5.3% (123) > 4.7% (58) | pass: 8.0% (129) > 5.6% (82) > 2.1% (57) |
| A3 Value, forward excess return | pass: +5.5% (74) > +2.3% (134) > −4.0% (159) | **fail**: Attractive −0.8% (70) < Fair +7.1% (64); Expensive −5.4% (118) lowest |
| A4 Type | pass: drawdown 12.3% vs 2.5%, stability 88% | pass: 9.7% vs 0.9%, stability 88% |
| A5 Coverage | pass: 60 | pass: 46 |

Value, informational (realized growth reached implied): in-sample 69% / 51% / 14%, holdout 90% / 69% / 24% for Attractive / Fair / Expensive. The implied-growth ordering held in both periods; the return ordering did not hold between Attractive and Fair in 2014–2017.

Reading. High Quality and Durable Growth separate clearly in both periods, cyclical typing predicts drawdowns, and Expensive is the weakest return group in both. What did not replicate is the top of Value (Attractive vs Fair returns) and a Low Quality group large enough to test. The holdout has now been used, so it cannot validate a further revision: the next candidate needs fresh out-of-sample data (for example a different universe of companies, or post-2022 dates as they mature), and its acceptance must again be fixed before it runs.

## position-rules-v1.2: replication on a new universe (pre-registered 2026-09-30, before any run on it)

v1.2 has the same rules and thresholds as v1.1; only the version and gate differ, so its snapshots can be told apart from the failed candidate. It is tested on `UNIVERSE_B` in `backtest.py`: 118 US non-financial S&P 500 members that are not in the first universe and are still listed (banks, insurers, REITs and utilities excluded), fixed before any run on them.

Activation requires A1–A5, unchanged, on universe B at both date sets: 2018-06-30 … 2022-06-30 and 2014-06-30 … 2017-12-31. If either fails, v1.2 stays inactive. If both pass, v1.2 may be activated with the universe A 2014–2017 failure (A1 Quality: too few Low observations; A3 Value: Attractive below Fair) recorded here as a known limitation.

## Result of position-rules-v1.2 (run 36587461497, commit 30911a8)

Activation: **no**. Universe B: 116 of 118 fetched (HOLX and EA are no longer in the SEC ticker list).

| Test | Universe B 2018–2022 (438 labelled, 67 companies) | Universe B 2014–2017 (276 labelled, 58 companies) |
|---|---|---|
| A1 Quality, forward ROIC | pass: 18.1% (27) > 8.2% (23) > 5.4% (27) | **fail**: 18.3% (21) > 10.6% (17) > 3.2%, but Low has only 5 |
| A2 Growth, forward revenue CAGR | pass: 9.1% (253) > 6.1% (118) > 5.7% (67) | pass: 8.0% (170) > 4.7% (69) > 1.7% (37) |
| A3 Value, forward excess return | **fail**: Attractive +0.9% (87) < Fair +2.1% (133); Expensive −0.8% (193) | **fail**: Attractive −6.6% (63) < Fair +8.3% (90); Expensive +2.7% (111) |
| A4 Type | pass: drawdown 7.6% vs 2.8%, stability 89% | pass: 1.5% vs 0.3%, stability 88% |
| A5 Coverage | pass: 67 | pass: 58 |

Value, informational (realized growth reached implied): 76% / 38% / 17% (2018–2022) and 71% / 51% / 10% (2014–2017) for Attractive / Fair / Expensive.

## What four tests say (universe A and B, two periods each)

- Growth (A2) and Type (A4) passed all four tests.
- Quality ordered High > Average > Low in every test; it failed only where the Low group had 5 observations (both 2014–2017 tests), so its evidence is limited by sample size, not contradicted.
- Value's return ordering held in one of four tests. Attractive beat Fair on forward returns only in universe A 2018–2022. What held in all four is the claim the label actually computes: realized growth reached the price-implied growth far more often for Attractive (69–90%) than Fair (38–69%) or Expensive (10–24%). As a forecast of excess returns the label is not supported.

Consequence. Because the contract requires all four labels together, no rule version can be activated while Value fails. Every sample prepared so far (both universes, both periods) has now been used; a revised Value definition — for example one judged on implied versus realized growth instead of returns — needs its claim, gate and fresh data (a third universe or matured post-2022 dates) fixed before it runs.

## position-rules-v2: Value as an expectations label (pre-registered 2026-09-30, before any run on universe C)

Decision (user, 2026-09-30): Value is redefined as what it computes — how much growth today's price requires relative to the company's own record — not as a forecast of returns.

Change from v1.2, and nothing else: Value labels are renamed Undemanding / Reasonable / Demanding / Speculative (same DCF, discount rate, bear/base/bull and thresholds as v1.2), and Value's acceptance test is replaced. Type, Quality and Growth rules and their tests are unchanged.

Sample: `UNIVERSE_C` in `backtest.py`, 106 US non-financial companies in neither earlier universe, still listed, same exclusions, fixed before any run on them. All 17 half-year dates (2014-06-30 … 2022-06-30) are pooled, because both earlier 2014–2017 Quality failures came from a Low group of 5 observations.

Activation requires all of, on that pooled sample:

- A1 Quality, A2 Growth, A4 Type, A5 Coverage: unchanged definitions.
- A3′ Value expectations: the share of observations whose realized 3-year forward revenue CAGR reached the price-implied growth is strictly ordered Undemanding > Reasonable > Demanding, each group n ≥ 10, with Undemanding above 50% and Demanding below 50% (the label points the right way more often than not in both directions).

Limitation stated in advance: implied growth is for owner earnings (FCF minus SBC) and is compared with realized revenue growth, a proxy; base growth comes from past revenue growth, so the test partly reflects growth persistence. Forward excess returns stay in the report as information only. Per-period results are reported but not gated.

## Result of position-rules-v2 (run 36589951886, commit c442aa2)

Activation: **no**. Universe C: 104 of 106 fetched (CTRA and IPG are no longer in the SEC ticker list). Pooled 2014–2022: 670 of 1,770 observations labelled, 70 companies.

| Test (gated: pooled) | Pooled 2014–2022 | 2018–2022 (info) | 2014–2017 (info) |
|---|---|---|---|
| A1 Quality, forward ROIC | **fail**: 17.6% (37) > 14.1% (27) > 13.7% (7): Low n below 10 | 18.2% > 14.5% > 13.7% (Low 7) | 15.3% > 13.6%, Low 0 |
| A2 Growth, forward revenue CAGR | **fail**: Durable 6.2% (300), Moderate 5.8% (230), Weak 6.6% (136) | 7.4% / 5.0% / 8.8% | 5.0% / 6.6% / 6.0% |
| A3′ Value, realized reached implied | pass: 71% (161) > 44% (159) > 26% (273) | 76% / 42% / 25% | 65% / 47% / 28% |
| A4 Type | **fail**: drawdown 5.5% vs 3.7%, but stability 78% (< 80%) | stability 76% | pass (83%) |
| A5 Coverage | pass: 70 | 67 | 55 |

Forward excess return (information only): Undemanding +2.9%, Reasonable +3.0%, Demanding −3.9% pooled.

Reading. The redefined Value claim held on a third, untouched universe in both periods. Growth, which passed all four earlier tests, did not separate on universe C, and Type was less stable there; Quality kept its order, but the Low group again had too few observations. A defect in the test harness was noticed while reading this result and is recorded, not fixed retroactively: forward ROIC outcomes are computed without the `not_presented` convention that the labels use, so companies with no debt or no short-term investments drop out of the Quality outcome (hence the small Quality groups). Correcting it changes the test and must be validated on data not yet seen.

## Evidence across all five runs

| | A 2018–22 | A 2014–17 | B 2018–22 | B 2014–17 | C pooled |
|---|---|---|---|---|---|
| Quality order High > Average > Low | yes | yes (Low n 5) | yes | yes (Low n 5) | yes (Low n 7) |
| Growth (A2) | pass | pass | pass | pass | **fail** |
| Type (A4) | pass | pass | pass | pass | **fail** (stability 78%) |
| Value returns (v1.x A3) | pass | fail | fail | fail | not gated |
| Value expectations (v2 A3′ definition) | 69/51/14 | 90/69/24 | 76/38/17 | 71/51/10 | 71/44/26 |

No rule version has passed a full pre-registered gate. All remain `"active": false`, and no Position label may be written or shown.

## Walk-forward improvement (from 2026-09-30)

Decision (user, 2026-09-30): rules cannot be perfect, so they improve continuously on post-2022 outcomes as they mature, with minimal model-token use. Implementation: `analysis/fundamentals/forward.py`, monthly workflow `.github/workflows/position-forward.yml`, ledger on the `position-ledger` branch (runs from other branches write `position-ledger-test`). No LLM is called; a person or assistant is involved only when the workflow opens a review issue.

Protocol, fixed before the first step:

- Universe: the 338 companies of universes A, B and C. Label dates: every quarter end from 2023-03-31 up to the run date, using only filings up to that date.
- Outcome harness v2: forward ROIC now applies the same `not_presented` convention as the labels (v1 dropped companies without a debt or short-term investment line, which shrank the Quality groups). For information only, not as validation: re-running v2 on universe C with harness v2 gave Quality groups of 160 / 177 / 125 (A1 ordered), Growth and Type still failed.
- Seal: each candidate's labels per date are written once to `predictions/<candidate>/<date>.json` and never rewritten; git history on the ledger branch shows when.
- Maturity: a date's 3-year outcome counts from date + 3 years + 120 days. A candidate is evaluated only on dates that matured after it was frozen. The first forward outcome matures on 2026-10-28 (the 2023-06-30 labels).
- Gate: the same A1–A5 as the v2 gate (A3 = expectations) on the pooled forward dates. With at least 4 forward dates, a failing candidate is retired; a passing one is reported as ready for review and an issue is opened. Nothing is activated automatically.
- Improvement: when fewer than 6 candidates are live, the best candidate by fitness on already-matured history (2014–2022 backtest dates plus matured forward dates) is mutated one grid step per parameter (`MUTATION_SPACE`); up to 2 neighbours that score at least as well are frozen. Fitness = acceptance criteria passed + a bounded separation margin + a small type-stability term. Only thresholds in the grid change; the rule structure, windows, SIC industries and data rules do not.
- Seed: `position-rules-v2` as candidate `wf-…` (its id is a hash of the rule content).

Limits stated in advance: several candidates are tested on the same forward dates, so a pass is weaker evidence than a single pre-registered test; the review should weigh how many candidates were live. Forward dates overlap (quarterly labels, 3-year outcomes), so consecutive dates are not independent. The earliest possible review is after 2024-03-31 matures (2027-07-29), later for candidates frozen afterwards.
