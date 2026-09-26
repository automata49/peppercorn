# Peppercorn Capital

Peppercorn Capital is a dedicated investment workspace replacing the legacy Google Sheets + Apps Script dashboard.

## Architecture

GitHub → Python analysis engine → Supabase → Peppercorn Web App

Google Sheets is retained only as a migration and backup source.

## Web Workspace v0.1

Included:
- Dashboard
- Leaderboard
- editable Watchlist
- editable Portfolio
- Stock Analysis
- editable Research Notes
- editable Trading Journal
- Universe
- Supabase schema + RLS
- Python RS / MA / ATR / RSI / stage engine
- GitHub Pages deployment
- scheduled market-analysis workflow scaffold

## Live Supabase

Project: `Peppercorn Capital`
Region: Seoul (`ap-northeast-2`)

Migrated on 2026-09-26:
- 656 unique instruments
- 1,337 Universe membership rows
- 600 leaderboard metric snapshots as of 2026-09-25
- 739 ETF membership links

The browser does not contain a Supabase database key. It reads the public market workspace through the `leaderboard` Edge Function. Database access remains server-side.

Editable Watchlist / Portfolio / Research / Journal currently use browser localStorage until Supabase Auth persistence is enabled.

## Local development

Node.js 22+

    npm install
    npm run dev

## Server-side analysis

The Python engine lives under `analysis/`.

The scheduled GitHub Actions analysis job still requires server-only values:
- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`

Secret/service keys must never be exposed in frontend code.

## Backup

Legacy snapshot before rebuild:
- GitHub branch: `backup/pre-webapp-rebuild-2026-09-26`
- Google Sheet: `Peppercorn Capital - Backup 2026-09-26`
- Universe snapshot: `migration/universe_snapshot_2026-09-26.csv`

## Rules carried over

- Leader RS Rank >= 70
- Leader within 25% of 52-week high
- Breakout zone within 5% of high
- Breakout volume >= 1.4x
- Pullback <= 2 ATR from MA50
- Max stop 8%
- Next Leader within 30% of 52-week high
- Correction Leader floor -40%

Next milestone: Supabase Auth + persistent editable tables, followed by fully automated Python market refresh.
