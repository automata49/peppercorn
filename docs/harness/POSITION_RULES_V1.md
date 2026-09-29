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

## Result of position-rules-v1.1

Pending the run recorded below.
