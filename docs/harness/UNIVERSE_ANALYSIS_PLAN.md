# Leaderboard universe, 종목 분석 and Composite — plan and status (2026-10-03)

User decisions (2026-10-03): no full-market expansion; an investable universe (UNIVERSE-2) with the proposed floors;
keep Supabase; 종목 분석 gets search, a Swing/fundamental summary, a vertical input sheet and a compare view;
Composite Rating goes ahead as option B (separate reference rating, inactive until pre-registered gates pass).

## 1. UNIVERSE-2

| | US | KR |
|---|---|---|
| Scope | NASDAQ + NYSE + NYSE American | KOSPI + KOSDAQ |
| Excluded | warrants, units, rights, preferred, depositary, notes, SPAC/blank checks, funds, LPs, royalty trusts | preferred (code not ending in 0), 스팩, 리츠/인프라 투융자, 관리종목, 투자주의 환기, 거래정지 |
| Price | ≥ $5 | ≥ 1,000원 |
| Market cap | ≥ $300M | ≥ 1,000억원 |
| Trading value | ≥ $5M | ≥ 20억원 |
| Buffer | existing members leave only below 70% of a floor | same |
| Always active | equities in any user's watchlist, portfolio, analysis or journal (UNIVERSE-USER-1) | same |

Benchmarks: Russell 3000 (exchange-wide start, $1/$30M floors, SPAC/LP exclusions, looser test for members),
KRX300 (KOSPI+KOSDAQ together, administrative/caution/SPAC/new-listing exclusions), IBD 50 (liquidity before ranking).

Trading value: a stock already in the universe uses its own `traded_value_20d`; a new candidate uses the listing's
one-session value (screener `lastsale × volume`, KRX `Amount`). A single session favours stocks that are busy that
day, which tilts new entrants toward current momentum; after the first sync their own 20-session value applies.

### Simulation (run 37097896804 attempt 2, Universe report, 2026-10-03, read-only)

| | US | KR |
|---|---|---|
| Listing candidates | 7,072 | 2,725 |
| UNIVERSE-2 included | 2,633 | 595 |
| Current (v1) priced | 1,149 | 351 |
| Added / removed | 1,502 / 18 | 283 / 39 |
| RS rank change of kept stocks p10/p50/p90 | +1 / +2 / +3 | −17 / −13 / −2 |
| 핵심 주도 v1 → v2 | 29 → 67 | 4 → 10 |
| 주도 후보 v1 → v2 | 84 → 214 | 10 → 21 |
| 강세 전환 v1 → v2 | 7 → 23 | 12 → 23 |

Reported names: OKLO, 대덕전자 (353200) and 지엔씨에너지 (119850) all pass the screen (지엔씨에너지 classifies as 주도 후보
in the simulation). Totals: 3,228 equities (run 37097388399 before the BRKB/BFB ticker fix: 2,632 US, 20 removed) (my earlier estimate was US 1,800–2,200 and KR 700–900; US is larger and KR
smaller). KR ranks of existing stocks drop by a median 13 points because the added KOSPI/KOSDAQ names are, on this
date, stronger than the index constituents; this is the population effect the CONTRACT asks to disclose.
The simulation mirrors the SQL formulas in Python on Yahoo prices; production values can differ slightly.

Found during the run: the KRX-DESC listing cache has no file for the last 15 days and every KOSPI200/KOSDAQ150
source (KRX direct and pykrx now need a KRX login, TradingView and ETF-holdings proxies matched 0), so the current v1
weekly sync is expected to fail validation on its next run (it does not import, so production data stays as is).
UNIVERSE-2 does not depend on those sources; it skips index labels and the listing-date rule when they are missing.
WiseIndex WICS coverage varied between runs (592/595; then 555/595, which the existing 95% guard refused; the retry passed),
so a weekly v2 sync can fail on a bad WICS day without importing; rerun it.

Switch: Actions → `Sync investment universe` with `universe_version` 2 (or set the repository variable
`UNIVERSE_VERSION=2` for the weekly schedule), after deploying `universe-import` (bounds raised to 5,000).

## 2. Infrastructure

- RETENTION-1: `prune_market_history()`; workflow `Market retention (production)`: migrate → dry-run → prune; weekly
  pruning only when the repository variable `MARKET_RETENTION_SCHEDULE=apply`.
- LEADERBOARD-STATIC-1: snapshot `data/leaderboard.json` on GitHub Pages after each market refresh; the live function
  remains for manual refresh and as fallback.
- Workspace fix: instrument lookup paged past PostgREST's 1,000-row limit; inactive instruments still resolve.

## 3. 종목 분석

Search (ticker, name, 초성; recent stocks), CHECKUP-1 summary (Swing + filed fundamentals, pass/neutral/fail from
existing thresholds; 2×2 map; no combined score), compare up to four stocks, vertical sheet (my input | filed | check)
on the same record as the list grid.

## 4. COMPOSITE-1 (option B)

Pre-registered in `analysis/composite.py` (`COMPOSITE_RULES`, `active: false`). Stage A (price-only: RS estimate 30%,
industry group RS 15%, 52W high 15%, accumulation/distribution 10%, re-weighted) is tested by `Composite backtest`
against RS-only on the same rows: A1 top-decile mean excess return higher, A2 wins ≥ 55% of dates, A3 quintiles
monotonic (Spearman ≥ 0.9), A4 positive in both halves, A5 ≥ 24 dates and ≥ 30 names per top decile.
Stage B adds filed EPS (20%) and SMR (10%) through the US point-in-time SEC path; KR stays price-only.
Limits: the population is today's universe (survivorship bias), Yahoo adjusted prices, no transaction costs.

### Stage A result (run 37097986354, 2026-10-03; 6 years, rebalance every 21 sessions, 63-session forward excess return)

| | dates | top decile size | Composite top decile | RS-only top decile | win rate | quintile Spearman | halves | gates |
|---|---|---|---|---|---|---|---|---|
| US | 57 | 103 | +1.94% | +6.81% | 32% | 0.0 | −0.51% / +4.18% | A1–A4 ✗, A5 ✓ → **fail** |
| KR | 54 | 33 | +5.16% | +3.88% | 56% | 1.0 | +6.71% / +3.61% | all ✓ → pass |
| pooled | 111 | 69 | +2.69% | +6.14% | 43% | 0.0 | +3.03% / +3.90% | A1–A3 ✗ → **fail** |

In the US the Composite dilutes momentum: the RS-only top decile did better, and the lowest Composite quintile
(+4.73%) beat the middle ones, which also reflects survivorship bias (today's survivors that were weak then).
The pre-registration did not state whether the gates apply per market or pooled, so the Composite stays inactive.
Next options (each a new, pre-registered decision): keep it off; or a KR-only reference rating with an out-of-sample
check (e.g. later dates or a universe including delisted names); stage B (filed EPS/SMR) for the US.

## Order of production steps (a person runs these)

1. Merge; deploy `workspace` and `universe-import` (Edge function deploy).
2. `Market retention (production)`: migrate (apply), dry-run, then prune (apply).
3. `Sync investment universe` with version 2; the next `Refresh market analysis` prices and ranks the new names.
4. Composite: review the stage A result; activation is a separate reviewed change.
