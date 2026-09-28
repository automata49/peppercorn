# Position Growth 공시 원문 대조 — 2026-09-28

Baseline: [PoC workflow 36380836618](https://github.com/automata49/peppercorn/actions/runs/36380836618), artifact 10952184956. These are historical rows from that artifact; current live re-collection has not been run. Machine-readable expected figures and URLs are in `analysis/fundamentals/official_reference_2025.json`. Verify the artifact with `python analysis/fundamentals/reconcile.py <artifact.zip>`; the collector also fails if these expected rows differ.

| Company / period | Field | Official source and method | Expected | Artifact | Result |
|---|---|---|---:|---:|---|
| NVIDIA / 2025-07-27 | Revenue | [SEC Q2 10-Q](https://www.sec.gov/Archives/edgar/data/1045810/000104581025000209/nvda-20250727.htm), 3 months, USD millions | 46,743m | 46,743m | Match |
| NVIDIA / 2025-07-27 | Operating income | Same Q2 consolidated income statement | 28,440m | 28,440m | Match |
| NVIDIA / 2025-07-27 | Operating cash flow | [Q2](https://www.sec.gov/Archives/edgar/data/1045810/000104581025000209/nvda-20250727.htm) 6 months 42,779m − [Q1](https://www.sec.gov/Archives/edgar/data/1045810/000104581025000116/nvda-20250427.htm) 27,414m | 15,365m | 15,365m | Match |
| NVIDIA / 2025-07-27 | CapEx | Q2 cumulative purchases of PPE **and intangible assets** 3,122m − Q1 1,227m | 1,895m | 1,895m | Match |
| Samsung / 2025-03-31 | Revenue | [Official consolidated Q1 statements, p.7](https://images.samsung.com/kdp/ir/financial-info/2025/2025_con_quarter01_all.pdf), KRW millions | 79,140,503m | 79,140,503m | Match |
| Samsung / 2025-03-31 | Operating income | Same p.7, confirmed in [2025-04-30 corrected disclosure](https://www.samsung.com/sec/ir/reports-disclosures/public-disclosure/3555/) | 6,685,272m | 6,685,272m | Match |
| Samsung / 2025-03-31 | Operating cash flow | Official consolidated cash flow, p.10 | 16,580,866m | 16,580,866m | Match |
| Samsung / 2025-03-31 | CapEx | p.10 acquisition of PPE only | 12,127,934m | 12,127,934m | Match |
| Samsung / 2025-03-31 | Cash | Official consolidated balance sheet, p.5 | 53,161,004m | 53,161,004m | Match |
| Samsung / 2025-03-31 | Debt | p.5–6: 5,333,859m short term + 2,035,992m current long-term + 14,518m bonds + 3,759,579m long-term | 11,143,948m | 11,143,948m | Match |

SEC filing accessions: NVIDIA Q1 `0001045810-25-000116` filed 2025-05-28; Q2 `0001045810-25-000209` filed 2025-08-27. Samsung [DART Q1 report](https://opendart.fss.or.kr/xbrl/viewer/main.do?rcpNo=20250515001922) receipt `20250515001922` filed 2025-05-15. The earlier Samsung provisional release was corrected from 79.00/6.60 to 79.14/6.69 trillion KRW on 2025-04-30; compare definitive statement values, not the preliminary estimate.

## Definition and valuation gate

- Current PoC `ttm_fcf = operating_cash_flow − capex` does **not** have a common CapEx scope: NVIDIA's reported purchase line includes intangible assets, Samsung's OpenDART mapping takes only PPE. Samsung additionally spent **1,257,544m KRW** on intangible acquisition in Q1. For that quarter, PPE-only FCF is 16,580,866 − 12,127,934 = **4,452,932m KRW**, whereas FCF including intangible purchases is **3,195,388m KRW**. Do not compare or label across markets as a common FCF until the acquisition scope is normalized and tested. Preserve both components and the source line item; no silent substitution.
- `owner_earnings = FCF − SBC` in the PoC is only an SBC-adjusted proxy; it does not estimate maintenance capital spending. Samsung SBC is not collected; the value must remain unknown. Define owner earnings and ROIC invested capital/average period/tax assumptions with source-backed fixtures before Value labels.
- `market_metrics` and the Swing engine remain independent. Restatements need filing timestamps and accession history; Q2 observed data was unavailable until its 2025-08-27 filing.

## Current code changes and unclosed gates

- SEC duration tags are now selected per `(start,end)` instead of discarding history when the latest tag changes; USD and shares units are explicit. DART debt excludes breakdowns of the current portion and missing debt stays unknown. ROIC and net debt stop treating missing components as zero. Offline tests cover these failure cases.
- Current SEC `tag_by_period` is a convenience map, **not** a complete input lineage for a derived quarter. DART `fnlttSinglAcntAll` output lacks the receipt/date and arbitrary non-December fiscal-calendar handling. No raw response hashes, amendment-aware history or DB writes are implemented. These must precede a production migration/ingestion job.
- The ten matched values cover **one historical quarter per company**, not the last eight quarters or all balance sheet fields. Expand the independently checked official filings, including tag-switch, loss-making and alternate fiscal-year companies, before asserting phase 1 completion.
