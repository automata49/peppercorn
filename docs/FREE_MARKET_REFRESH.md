# Automatic daily market refresh

`Refresh market analysis` runs the Yahoo daily-bar collector inside GitHub Actions. It connects to the existing production database with the already configured `PROD_SUPABASE_DB_URL` repository secret, avoiding the restricted Edge HTTP gateway and expired Management API token. Credentials are available only on reviewed main-branch/manual jobs. The public website and PR tests receive no database credentials.

The original calculator is shared by the Edge function and Actions runner in `supabase/functions/_shared/market-metrics.ts`. Existing database procedures still own equity/ETF ranking and classification. No schema, benchmark, ranking or billing settings change.

The exchange calendar selects the latest fully closed daily session. Collection must supply fresh bars for at least 90% of the selected market and its existing benchmark (US SPY / KR 226490) before any writes. Failed instruments keep their actual old dates. All collected historical bars are upserted to preserve split/correction consistency with IBD calculations. Prices, metrics and both ranking procedures commit in one transaction. A failed collection/recalculation leaves the previous committed data intact.

On refresh success, Actions retains a seven-day public export/status artifact. The existing Pages workflow exports only `public.leaderboard_view` using the same DB connection and publishes the snapshot. The app reads the public file first. A failed release uses the explicitly dated recovery export; it is never retimestamped as fresh market data.

Regular schedules: KR 08:00 and 16:30 Asia/Seoul; US 08:30 and 17:00 America/New_York. The 14:00 New York slot runs only on 13:00 early-close sessions. Holidays and schedules delayed into the regular session are skipped. These are daily bars, not streaming or 15-minute quotes. GitHub may delay scheduled jobs. Weekend 08:00/20:00 UTC jobs only re-export the existing public data, preserving trading dates and prices, so the 20-hour publication-age gate does not turn Friday closes into a 402 fallback. They do not claim to collect new weekend quotes.

Changing the refresh workflow/runner on main starts an ALL-market bootstrap. To retry independently, use Actions → Refresh market analysis → Run workflow → ALL/KR/US. Inspect coverage and `expected_sessions` in the job output and artifact before treating the refresh as complete.

The public Supabase Root 2021 CA is bundled as `scripts/supabase-prod-ca-2021.crt` for verified TLS. Source: https://supabase-downloads.s3.ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt . SHA-256: `807025AD50D4ED219D2C9C7D299C004F824EB00CF7F65AFEF607D07B72E6CAFA`; expires 2031-04-26. See https://supabase.com/docs/guides/platform/ssl-enforcement . Certificate verification is never disabled.

This restores public market collection/delivery. Other restricted HTTP APIs (auth, account sync, detailed charts) remain independent.
