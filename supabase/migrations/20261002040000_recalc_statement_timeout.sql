-- RECALC-TIMEOUT-1: the scheduled `recalculate-market` Edge Function calls recalculate_market_leadership() through
-- PostgREST as service_role. service_role has no statement_timeout of its own, so the API's 8 s default applies and the
-- recalculation over ~1,500 equities (RS, IBD estimate lateral scans, classification) is cancelled with 57014
-- "canceling statement due to statement timeout" on busy runs (analyze runs 36795386844, 36878277869, 36953592922).
-- refresh-market has already written the new day's market_metrics rows by then, and those rows stay without
-- rs_rank, leader_tt and stage. leaderboard_view reads each instrument's newest row, so every stock of the refreshed
-- market shows as 중립 and the 핵심 주도·주도 후보·강세 전환 counts drop to 0 until a later recalculation succeeds.
-- Fix: give service_role (server jobs only; the browser never holds this key) a 120 s statement timeout and reload
-- PostgREST so it takes effect. anon and authenticated keep their defaults. Idempotent.
alter role service_role set statement_timeout = '120s';
notify pgrst, 'reload config';
