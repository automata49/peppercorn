# Peppercorn Capital

Peppercorn Capital is a dedicated investment workspace replacing the legacy Google Sheets + Apps Script dashboard.

## Architecture

GitHub → Supabase Edge Functions / Postgres → Peppercorn Web App

Google Sheets is retained only as a migration and backup source.

## Web Workspace v0.2

Included:
- Dashboard
- Leaderboard
- editable Watchlist
- editable Portfolio
- Stock Analysis
- editable Research Notes
- editable Trading Journal
- Universe
- Supabase Auth + RLS
- persistent personal workspace
- automated Yahoo market-price ingestion
- automated RS / MA / ATR / RSI / Leader / Next Leader classification
- GitHub Pages deployment

## Live Supabase

Project: `Peppercorn Capital`  
Region: Seoul (`ap-northeast-2`)

Migrated on 2026-09-26:
- 656 unique instruments
- 1,337 Universe membership rows
- 739 ETF membership links
- 600 initial leaderboard metric snapshots as of 2026-09-25

Public market data is exposed through the `leaderboard` Edge Function. Browser code does not contain a Supabase database secret.

Personal data is stored behind Supabase Auth and RLS:
- Watchlist
- Portfolio
- Research Notes
- Trading Journal

Only the authenticated user's rows are readable or writable.

## Automated refresh

Supabase Cron runs market refresh batches on UTC Monday-Friday:

- 22:10–22:16 UTC: 7 market-data batches
- 22:25 UTC: RS ranking and classification finalization

This corresponds to approximately 07:10–07:25 KST Tuesday-Saturday and captures the prior US session plus the latest KR session.

The refresh flow is:

```
cron
  → refresh-market Edge Function
  → Yahoo daily prices
  → price_daily / market_metrics
  → finalize_latest_metrics()
  → RS Rank / Leader / Next Leader / Stage / Action Guide
```

The refresh credential is generated inside the private database schema and is not committed to GitHub.

## Security

- RLS enabled on personal tables
- Edge workspace requires a valid user JWT
- public market endpoint is read-only
- server/service credentials are never committed to frontend source
- private runtime secrets are stored outside the exposed public schema
- Supabase Security Advisor: no current warnings after the 2026-09-26 setup

## Local development

Node.js 22+

```bash
npm install
npm run dev
```

## Backup

Legacy snapshot before rebuild:
- GitHub branch: `backup/pre-webapp-rebuild-2026-09-26`
- Google Sheet: `Peppercorn Capital - Backup 2026-09-26`
- Universe snapshot: `migration/universe_snapshot_2026-09-26.csv`

## Core screening rules

- Leader RS Rank >= 70
- Leader within 25% of 52-week high
- Breakout zone within 5% of high
- Breakout volume >= 1.4x
- Pullback <= 2 ATR from MA50
- Extended >= 5 ATR
- Overextended >= 7 ATR
- Max stop reference 8%
- Next Leader uses volatility-adaptive 52-week drawdown:
  - allowed drawdown = `-MAX(25%, MIN(45%, ATR20% × 6))`
  - hard floor = -45%
  - below -30% requires stronger trend recovery

## Source layout

- `src/` — React web app
- `supabase/schema.sql` — core database schema
- `supabase/functions/` — deployed Edge Function source
- `analysis/` — original Python analysis engine/reference implementation
- `migration/` — legacy migration snapshots
