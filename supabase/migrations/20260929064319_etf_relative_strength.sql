-- ETF-RS-1: ETFs shown in the leaderboard need benchmark-relative returns, but do not enter the equity RS rank.
-- Keep the latest metric date aligned with each market's benchmark (SPY / 069500).
create or replace function public.recalculate_etf_relative_strength()
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare updated_rows integer;
begin
  with latest as (
    select distinct on (m.instrument_id) m.instrument_id,m.as_of,i.market,
      m.return_1w,m.return_1m,m.return_3m,m.return_6m,m.return_12m,
      m.return_5d,m.return_20d,m.return_50d,m.return_120d,m.return_200d
    from public.market_metrics m join public.instruments i on i.id=m.instrument_id
    where i.active and i.asset_class='ETF'
    order by m.instrument_id,m.as_of desc
  ), benchmark as (
    select distinct on (i.market) i.market,m.as_of,
      m.return_1w,m.return_1m,m.return_3m,m.return_6m,m.return_12m,
      m.return_5d,m.return_20d,m.return_50d,m.return_120d,m.return_200d
    from public.instruments i join public.market_metrics m on m.instrument_id=i.id
    where i.active and ((i.market='US' and i.ticker='SPY') or (i.market='KR' and i.ticker='069500'))
    order by i.market,m.as_of desc
  ), calculated as (
    select l.instrument_id,l.as_of,
      l.return_1w-b.return_1w as rs_1w,l.return_1m-b.return_1m as rs_1m,
      l.return_3m-b.return_3m as rs_3m,l.return_6m-b.return_6m as rs_6m,
      l.return_12m-b.return_12m as rs_12m,
      l.return_5d-b.return_5d as rs_5d,l.return_20d-b.return_20d as rs_20d,
      l.return_50d-b.return_50d as rs_50d,l.return_120d-b.return_120d as rs_120d,
      l.return_200d-b.return_200d as rs_200d
    from latest l left join benchmark b on b.market=l.market and b.as_of=l.as_of
  )
  update public.market_metrics m set
    rs_1w=c.rs_1w,rs_1m=c.rs_1m,rs_3m=c.rs_3m,rs_6m=c.rs_6m,rs_12m=c.rs_12m,
    rs_5d=c.rs_5d,rs_20d=c.rs_20d,rs_50d=c.rs_50d,rs_120d=c.rs_120d,rs_200d=c.rs_200d,
    rs_rank=null,
    updated_at=now()
  from calculated c
  where m.instrument_id=c.instrument_id and m.as_of=c.as_of
    and (m.rs_rank is not null or
      (m.rs_1w,m.rs_1m,m.rs_3m,m.rs_6m,m.rs_12m,m.rs_5d,m.rs_20d,m.rs_50d,m.rs_120d,m.rs_200d)
      is distinct from (c.rs_1w,c.rs_1m,c.rs_3m,c.rs_6m,c.rs_12m,c.rs_5d,c.rs_20d,c.rs_50d,c.rs_120d,c.rs_200d));
  get diagnostics updated_rows=row_count;
  return updated_rows;
end;
$$;
revoke all on function public.recalculate_etf_relative_strength() from public,anon,authenticated;
grant execute on function public.recalculate_etf_relative_strength() to service_role;

-- Fill existing ETFs once. Subsequent market jobs invoke the same idempotent function.
select public.recalculate_etf_relative_strength();
