-- UNIVERSE-USER-1 and RETENTION-1 (by user decision, 2026-10-03).
--
-- 1. activate_index_universe() keeps an equity active while any user's watchlist, portfolio, stock analysis or
--    trade journal row references it, in addition to index/universe membership. Before this, a stock that left the
--    universe became inactive, the workspace function could no longer resolve it, and the next save of that list
--    silently dropped the user's row. The function still returns only a row count; no user data leaves the database.
--    These user-referenced instruments enter the RS population like any other active equity; with a single user's
--    few dozen names the percentile effect is below one rank point (accepted, see UNIVERSE_ANALYSIS_PLAN.md).
-- 2. prune_market_history() bounds storage: price_daily keeps the newest 400 sessions per instrument (IBD-style
--    estimate needs 253, the 52W high 252, Yahoo refreshes return 18 months), market_metrics keeps every row from the
--    last 30 days plus the last row of each ISO week before that, and always the newest row per instrument.
--    It is a dry run unless apply=true. Only service_role may call it.
--
-- Recalculation impact: none. Latest metrics, ranks and classifications are unchanged; pruning only removes history
-- that no calculation or screen reads (leaderboard_view reads the newest row; charts read <=253 sessions).
do $guard$
declare src text;
begin
  select md5(prosrc) into src from pg_proc where oid='public.activate_index_universe()'::regprocedure;
  if src is distinct from '9e44474259bf638fa2a1706052841700' and src is distinct from md5($body$
declare affected integer;
begin
  update public.instruments i
     set active = exists (
       select 1 from public.universe_memberships um
       where um.instrument_id=i.id and um.entry_type='INDEX'
     ) or exists (select 1 from public.watchlist w where w.instrument_id=i.id)
       or exists (select 1 from public.portfolio_positions p where p.instrument_id=i.id)
       or exists (select 1 from public.stock_analyses s where s.instrument_id=i.id)
       or exists (select 1 from public.trade_journal j where j.instrument_id=i.id),
       updated_at=now()
   where i.asset_class='Equity' and i.market in ('US','KR');
  get diagnostics affected = row_count;
  return affected;
end;
$body$) then
    raise exception 'activate_index_universe() differs from the repo (md5 %)',src;
  end if;
end
$guard$;

create or replace function public.activate_index_universe()
returns integer
language plpgsql
security definer
set search_path = ''
as $body$
declare affected integer;
begin
  update public.instruments i
     set active = exists (
       select 1 from public.universe_memberships um
       where um.instrument_id=i.id and um.entry_type='INDEX'
     ) or exists (select 1 from public.watchlist w where w.instrument_id=i.id)
       or exists (select 1 from public.portfolio_positions p where p.instrument_id=i.id)
       or exists (select 1 from public.stock_analyses s where s.instrument_id=i.id)
       or exists (select 1 from public.trade_journal j where j.instrument_id=i.id),
       updated_at=now()
   where i.asset_class='Equity' and i.market in ('US','KR');
  get diagnostics affected = row_count;
  return affected;
end;
$body$;
revoke all on function public.activate_index_universe() from public,anon,authenticated;
grant execute on function public.activate_index_universe() to service_role;

create or replace function public.prune_market_history(
  keep_sessions integer default 400,
  keep_metric_days integer default 30,
  apply boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare price_rows bigint; metric_rows bigint;
begin
  if keep_sessions < 260 then raise exception 'keep_sessions must be >= 260 (IBD-style estimate needs 253 sessions)'; end if;
  if keep_metric_days < 7 then raise exception 'keep_metric_days must be >= 7'; end if;

  drop table if exists pg_temp._prune_prices; drop table if exists pg_temp._prune_metrics;
  create temp table _prune_prices on commit drop as
    select instrument_id,trade_date from (
      select instrument_id,trade_date,row_number() over(partition by instrument_id order by trade_date desc) n
      from public.price_daily
    ) x where n>keep_sessions;
  select count(*) into price_rows from pg_temp._prune_prices;

  create temp table _prune_metrics on commit drop as
    select instrument_id,as_of from (
      select instrument_id,as_of,
        row_number() over(partition by instrument_id order by as_of desc) newest,
        row_number() over(partition by instrument_id,date_trunc('week',as_of) order by as_of desc) week_last
      from public.market_metrics
    ) x where newest>1 and week_last>1 and as_of < current_date-keep_metric_days;
  select count(*) into metric_rows from pg_temp._prune_metrics;

  if apply then
    delete from public.price_daily p using pg_temp._prune_prices d where p.instrument_id=d.instrument_id and p.trade_date=d.trade_date;
    delete from public.market_metrics m using pg_temp._prune_metrics d where m.instrument_id=d.instrument_id and m.as_of=d.as_of;
  end if;
  return jsonb_build_object('applied',apply,'price_rows',price_rows,'metric_rows',metric_rows,
    'keep_sessions',keep_sessions,'keep_metric_days',keep_metric_days);
end;
$$;
revoke all on function public.prune_market_history(integer,integer,boolean) from public,anon,authenticated;
grant execute on function public.prune_market_history(integer,integer,boolean) to service_role;
