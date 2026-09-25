# Peppercorn Capital

Peppercorn Capital is being rebuilt from a Google Sheets + Apps Script dashboard into a dedicated investment workspace.

## Target architecture

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
- GitHub Pages workflow
- scheduled market-analysis workflow

Until Supabase is connected the UI uses Demo data, and editable tables persist in browser localStorage.

## Local development

Node.js 22+

    npm install
    cp .env.example .env.local
    npm run dev

## Supabase setup

1. Create a dedicated Peppercorn Supabase project.
2. Run supabase/schema.sql.
3. Add public deployment variables:
   - VITE_SUPABASE_URL
   - VITE_SUPABASE_PUBLISHABLE_KEY
4. Add server-only Actions secrets:
   - SUPABASE_URL
   - SUPABASE_SECRET_KEY
5. Import the existing Google Sheet Universe into public.instruments.
6. Run the Refresh market analysis workflow.

The frontend sends the publishable key only in the apikey header. Never expose the secret key in VITE_ variables.

## Backup

Legacy snapshot before the rebuild:
- GitHub branch: backup/pre-webapp-rebuild-2026-09-26
- Google Sheet: Peppercorn Capital - Backup 2026-09-26

## Rules carried over

- Leader RS Rank >= 70
- Leader within 25% of 52-week high
- Breakout zone within 5% of high
- Breakout volume >= 1.4x
- Pullback <= 2 ATR from MA50
- Max stop 8%
- Next Leader within 30% of 52-week high
- Correction Leader floor -40%

The next milestone moves these thresholds from code into user_thresholds and adds authenticated persistence for Watchlist, Portfolio, Research and Journal.
