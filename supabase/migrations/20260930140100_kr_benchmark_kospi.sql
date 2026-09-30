-- KR-BENCH-2 step B (by user decision): the KR relative-strength benchmark changes from KODEX 200 (069500, KOSPI 200)
-- to KODEX 코스피 (226490, KOSPI). US stays SPY. Both recalculations are redefined with only that ticker changed:
--   * recalculate_market_leadership(): the equity RS bands, RS rank, Trend Template, stage, verdict and guide
--   * recalculate_etf_relative_strength(): ETF-RS-1/ETF-IBD-1/ETF-SWING-1/ETF-VALUE-1 (same-date benchmark)
-- Impact: every KR RS value shifts by (KOSPI 200 return − KOSPI return) per period. RS ranks move only where the
-- per-stock period re-weighting differs; thresholds on RS signs (RS 1W/1M/3M/6M > 0) and therefore stage, verdict and
-- leadership class can change for KR rows. US rows, IBD estimates (price-only) and traded value are unaffected.
-- Guards: refuses to run unless 226490 is active with a metric row on the latest KR metric date of 069500, and unless
-- both functions in the database still match the repo definitions this file replaces (md5 of prosrc).
do $guard$
declare kr_latest date; bench_latest date; eq_src text; etf_src text;
begin
  select max(m.as_of) into kr_latest from public.market_metrics m join public.instruments i on i.id=m.instrument_id
    where i.market='KR' and i.ticker='069500';
  select max(m.as_of) into bench_latest from public.market_metrics m join public.instruments i on i.id=m.instrument_id
    where i.market='KR' and i.ticker='226490' and i.active;
  if bench_latest is null or kr_latest is null or bench_latest<kr_latest then
    raise exception 'KR benchmark 226490 has no metrics on the latest KR date (226490: %, 069500: %)',bench_latest,kr_latest;
  end if;
  select md5(prosrc) into eq_src from pg_proc where oid='public.recalculate_market_leadership()'::regprocedure;
  select md5(prosrc) into etf_src from pg_proc where oid='public.recalculate_etf_relative_strength()'::regprocedure;
  if eq_src is distinct from 'e6ed8872a6a67b59fe02f72f94afa401' then raise exception 'recalculate_market_leadership() differs from the repo (md5 %)',eq_src; end if;
  if etf_src is distinct from '743a93cfa3a0fdb934603db51ce0848b' then raise exception 'recalculate_etf_relative_strength() differs from the repo (md5 %)',etf_src; end if;
end
$guard$;

update public.instruments set benchmark_ticker='226490',updated_at=now()
where market='KR' and benchmark_ticker is distinct from '226490';

create or replace function public.recalculate_market_leadership()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare updated_rows integer:=0; core_rows integer:=0; candidate_rows integer:=0;
begin
  with latest as (
    select distinct on (mm.instrument_id)
      mm.instrument_id,mm.as_of,mm.return_1w,mm.return_1m,mm.return_3m,mm.return_6m,mm.return_12m,mm.return_5d,mm.return_20d,mm.return_50d,mm.return_120d,mm.return_200d
    from public.market_metrics mm join public.instruments i on i.id=mm.instrument_id
    where i.active=true order by mm.instrument_id,mm.as_of desc
  ), bench as (
    select i.market,l.return_1w,l.return_1m,l.return_3m,l.return_6m,l.return_12m,l.return_5d,l.return_20d,l.return_50d,l.return_120d,l.return_200d
    from latest l join public.instruments i on i.id=l.instrument_id
    where (i.market='US' and i.ticker='SPY') or (i.market='KR' and i.ticker='226490')
  ), rs_base as (
    select l.instrument_id,l.as_of,i.market,i.asset_class,
      case when l.return_1w is not null and b.return_1w is not null then l.return_1w-b.return_1w end rs_1w,
      case when l.return_1m is not null and b.return_1m is not null then l.return_1m-b.return_1m end rs_1m,
      case when l.return_3m is not null and b.return_3m is not null then l.return_3m-b.return_3m end rs_3m,
      case when l.return_6m is not null and b.return_6m is not null then l.return_6m-b.return_6m end rs_6m,
      case when l.return_12m is not null and b.return_12m is not null then l.return_12m-b.return_12m end rs_12m,
      case when l.return_5d is not null and b.return_5d is not null then l.return_5d-b.return_5d end rs_5d,
      case when l.return_20d is not null and b.return_20d is not null then l.return_20d-b.return_20d end rs_20d,
      case when l.return_50d is not null and b.return_50d is not null then l.return_50d-b.return_50d end rs_50d,
      case when l.return_120d is not null and b.return_120d is not null then l.return_120d-b.return_120d end rs_120d,
      case when l.return_200d is not null and b.return_200d is not null then l.return_200d-b.return_200d end rs_200d
    from latest l join public.instruments i on i.id=l.instrument_id left join bench b on b.market=i.market
  ), scored as (
    select r.*,
      (coalesce(r.rs_1m*.30,0)+coalesce(r.rs_3m*.30,0)+coalesce(r.rs_6m*.20,0)+coalesce(r.rs_12m*.20,0))
      / nullif((case when r.rs_1m is not null then .30 else 0 end)+(case when r.rs_3m is not null then .30 else 0 end)+(case when r.rs_6m is not null then .20 else 0 end)+(case when r.rs_12m is not null then .20 else 0 end),0) score
    from rs_base r
  ), ranked as (
    select s.instrument_id,s.as_of,s.rs_1w,s.rs_1m,s.rs_3m,s.rs_6m,s.rs_12m,s.rs_5d,s.rs_20d,s.rs_50d,s.rs_120d,s.rs_200d,
      round(1+98*cume_dist() over(partition by s.market order by s.score))::int rs_rank
    from scored s where s.asset_class='Equity' and s.score is not null
  )
  update public.market_metrics mm set
    rs_1w=r.rs_1w,rs_1m=r.rs_1m,rs_3m=r.rs_3m,rs_6m=r.rs_6m,rs_12m=r.rs_12m,rs_5d=r.rs_5d,rs_20d=r.rs_20d,rs_50d=r.rs_50d,rs_120d=r.rs_120d,rs_200d=r.rs_200d,rs_rank=r.rs_rank,updated_at=now()
  from ranked r where mm.instrument_id=r.instrument_id and mm.as_of=r.as_of;

  perform public.recalculate_ibd_rs_estimate();

  with latest as (
    select distinct on (mm.instrument_id) mm.*
    from public.market_metrics mm join public.instruments i on i.id=mm.instrument_id
    where i.active=true and i.asset_class='Equity'
    order by mm.instrument_id,mm.as_of desc
  ), flags as (
    select l.*,
      (coalesce(l.price>l.ma50,false)::int+coalesce(l.ma50>l.ma200,false)::int+coalesce(l.price>l.ma200,false)::int+coalesce(l.high_52w_distance>=-.25,false)::int+coalesce(l.rs_rank>=70,false)::int+coalesce(l.low_52w>0 and l.price>=l.low_52w*1.30,false)::int) tt_count,
      coalesce(l.price>l.ma50 and l.ma50>l.ma200 and l.high_52w_distance>=-.25 and l.rs_rank>=70,false) structural,
      coalesce(l.price>l.ma50 and l.ma50>l.ma200 and l.high_52w_distance>=-.15 and l.rs_rank>=95 and l.rs_3m>0 and l.rs_6m>0,false) core,
      coalesce(l.price>l.ma50 and l.ma50>l.ma200 and l.high_52w_distance>=-.25 and l.ibd_rs_estimate>=80 and l.rs_3m>0,false) candidate,
      coalesce(l.price>l.ma200 and l.ma50>l.ma200 and l.rs_rank>=85 and l.high_52w_distance between -.40 and -.20,false) correction
    from latest l
  ), flags2 as (
    select f.*,coalesce(not f.structural and not f.correction and f.price>f.ma50 and f.high_52w_distance>=-.30 and f.rs_rank>=70 and f.rs_1w>0 and f.rs_1m>0,false) next_leader
    from flags f
  ), classified as (
    select f.*,
      case when f.structural and f.high_52w_distance>=-.05 then '▲ 돌파 매수권'
           when f.structural and f.atr_multiple>=7 then '⛔ 과확장'
           when f.structural and f.atr_multiple>=5 then '◆ 확장 리더'
           when f.structural and f.atr_multiple<=2 then '● 눌림 매수권'
           when f.structural then '■ 베이스 형성'
           when f.correction then '◇ 조정 중 주도주'
           when f.next_leader then '↻ 넥스트 리더'
           when f.ma200 is not null and f.price<f.ma200 then '❌ 제외' else '○ 관찰' end new_stage,
      case when f.structural and f.high_52w_distance>=-.05 and f.core and coalesce(f.volume_ratio,0)>=1.4 then '⭐ 최우선 관심'
           when f.structural and f.high_52w_distance>=-.05 and f.core then '★ 우선 분석'
           when f.structural and f.high_52w_distance>=-.05 then '△ 거래량 확인 대기'
           when f.structural and f.atr_multiple>=5 then '✋ 추격 금지'
           when f.structural and f.core then '★ 우선 분석'
           when f.structural and f.candidate then '☆ 관심·분석 보완'
           when f.structural then '✎ 종목분석 먼저'
           when f.correction then '⌛ 새 베이스 대기'
           when f.next_leader then '◎ 전환 관찰' else '—' end new_verdict,
      case when f.structural and f.high_52w_distance>=-.05 then '52주 고점(피벗) 돌파와 거래량 ≥1.4배를 함께 확인'
           when f.structural and f.atr_multiple>=7 then '신규 진입보다 베이스 재형성 대기'
           when f.structural and f.atr_multiple>=5 then '상승 추격 대신 눌림 또는 새 베이스 대기'
           when f.structural and f.atr_multiple<=2 then 'MA50 지지와 거래량 회복을 확인'
           when f.structural then '베이스 상단·피벗과 거래량 수급을 확인'
           when f.correction then 'MA50 회복과 새로운 베이스 형성을 확인'
           when f.next_leader then 'RS 3M 개선과 정배열 완성 시 후보 승격'
           when f.ma200 is not null and f.price<f.ma200 then '200일선 회복 및 RS 개선 대기' else '추세·RS 개선 대기' end new_guide
    from flags2 f
  )
  update public.market_metrics mm set tt_pass_count=c.tt_count,leader_tt=c.structural,stage=c.new_stage,verdict=c.new_verdict,action_guide=c.new_guide,updated_at=now()
  from classified c where mm.instrument_id=c.instrument_id and mm.as_of=c.as_of;
  get diagnostics updated_rows=row_count;

  select count(*) into core_rows from public.leaderboard_view where asset_class='Equity' and leadership_class='핵심 주도';
  select count(*) into candidate_rows from public.leaderboard_view where asset_class='Equity' and leadership_class='주도 후보';
  return jsonb_build_object('updated',updated_rows,'core',core_rows,'candidates',candidate_rows);
end;
$$;
revoke all on function public.recalculate_market_leadership() from public,anon,authenticated;
grant execute on function public.recalculate_market_leadership() to service_role;

create or replace function public.recalculate_etf_relative_strength()
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare rs_rows integer; ibd_rows integer; swing_rows integer; value_rows integer;
begin
  -- ETF-RS-1 (unchanged): benchmark-relative returns on the same metric date.
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
    where i.active and ((i.market='US' and i.ticker='SPY') or (i.market='KR' and i.ticker='226490'))
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
  get diagnostics rs_rows=row_count;

  -- ETF-IBD-1: equity formula, ETF-only ranking per market.
  with latest as (
    select distinct on (m.instrument_id) m.instrument_id,m.as_of,i.market
    from public.market_metrics m join public.instruments i on i.id=m.instrument_id
    where i.active and i.asset_class='ETF'
    order by m.instrument_id,m.as_of desc
  ), history as (
    select l.instrument_id,l.as_of,l.market,p.trade_date,p.close,
      row_number() over(partition by l.instrument_id order by p.trade_date desc)-1 as age
    from latest l
    join lateral (
      select trade_date,close from public.price_daily
      where instrument_id=l.instrument_id and trade_date<=l.as_of and close>0
      order by trade_date desc limit 253
    ) p on true
  ), quarters as (
    select instrument_id,as_of,market,
      max(trade_date) filter(where age=0) as price_date,
      max(close) filter(where age=0) as p0,
      max(close) filter(where age=63) as p63,
      max(close) filter(where age=126) as p126,
      max(close) filter(where age=189) as p189,
      max(close) filter(where age=252) as p252
    from history group by instrument_id,as_of,market
  ), scores as (
    select instrument_id,as_of,market,price_date,
      .40*(p0/p63-1)+.20*(p63/p126-1)+.20*(p126/p189-1)+.20*(p189/p252-1) as score
    from quarters
    where p252 is not null and as_of-price_date<=7
  ), ranked as (
    select instrument_id,as_of,price_date,
      round(1+98*cume_dist() over(partition by market order by score))::integer as rating
    from scores
  )
  update public.market_metrics m set
    ibd_rs_estimate=r.rating,ibd_rs_as_of=r.price_date,updated_at=now()
  from latest l left join ranked r on r.instrument_id=l.instrument_id and r.as_of=l.as_of
  where m.instrument_id=l.instrument_id and m.as_of=l.as_of
    and (m.ibd_rs_estimate is distinct from r.rating or m.ibd_rs_as_of is distinct from r.price_date);
  get diagnostics ibd_rows=row_count;

  -- ETF-SWING-1: equity Trend Template and stage/verdict/guide with the ETF-only RS rank.
  with latest as (
    select distinct on (mm.instrument_id) mm.*,i.market
    from public.market_metrics mm join public.instruments i on i.id=mm.instrument_id
    where i.active and i.asset_class='ETF'
    order by mm.instrument_id,mm.as_of desc
  ), scored as (
    select l.instrument_id,l.as_of,l.market,
      (coalesce(l.rs_1m*.30,0)+coalesce(l.rs_3m*.30,0)+coalesce(l.rs_6m*.20,0)+coalesce(l.rs_12m*.20,0))
      / nullif((case when l.rs_1m is not null then .30 else 0 end)+(case when l.rs_3m is not null then .30 else 0 end)+(case when l.rs_6m is not null then .20 else 0 end)+(case when l.rs_12m is not null then .20 else 0 end),0) score
    from latest l
  ), etf_rank as (
    select instrument_id,as_of,round(1+98*cume_dist() over(partition by market order by score))::int etf_rs_rank
    from scored where score is not null
  ), flags as (
    select l.*,
      (coalesce(l.price>l.ma50,false)::int+coalesce(l.ma50>l.ma200,false)::int+coalesce(l.price>l.ma200,false)::int+coalesce(l.high_52w_distance>=-.25,false)::int+coalesce(e.etf_rs_rank>=70,false)::int+coalesce(l.low_52w>0 and l.price>=l.low_52w*1.30,false)::int) tt_count,
      coalesce(l.price>l.ma50 and l.ma50>l.ma200 and l.high_52w_distance>=-.25 and e.etf_rs_rank>=70,false) structural,
      coalesce(l.price>l.ma50 and l.ma50>l.ma200 and l.high_52w_distance>=-.15 and e.etf_rs_rank>=95 and l.rs_3m>0 and l.rs_6m>0,false) core,
      coalesce(l.price>l.ma50 and l.ma50>l.ma200 and l.high_52w_distance>=-.25 and l.ibd_rs_estimate>=80 and l.rs_3m>0,false) candidate,
      coalesce(l.price>l.ma200 and l.ma50>l.ma200 and e.etf_rs_rank>=85 and l.high_52w_distance between -.40 and -.20,false) correction,
      e.etf_rs_rank
    from latest l left join etf_rank e on e.instrument_id=l.instrument_id and e.as_of=l.as_of
  ), flags2 as (
    select f.*,coalesce(not f.structural and not f.correction and f.price>f.ma50 and f.high_52w_distance>=-.30 and f.etf_rs_rank>=70 and f.rs_1w>0 and f.rs_1m>0,false) next_leader
    from flags f
  ), classified as (
    select f.*,
      case when f.structural and f.high_52w_distance>=-.05 then '▲ 돌파 매수권'
           when f.structural and f.atr_multiple>=7 then '⛔ 과확장'
           when f.structural and f.atr_multiple>=5 then '◆ 확장 리더'
           when f.structural and f.atr_multiple<=2 then '● 눌림 매수권'
           when f.structural then '■ 베이스 형성'
           when f.correction then '◇ 조정 중 주도주'
           when f.next_leader then '↻ 넥스트 리더'
           when f.ma200 is not null and f.price<f.ma200 then '❌ 제외' else '○ 관찰' end new_stage,
      case when f.structural and f.high_52w_distance>=-.05 and f.core and coalesce(f.volume_ratio,0)>=1.4 then '⭐ 최우선 관심'
           when f.structural and f.high_52w_distance>=-.05 and f.core then '★ 우선 분석'
           when f.structural and f.high_52w_distance>=-.05 then '△ 거래량 확인 대기'
           when f.structural and f.atr_multiple>=5 then '✋ 추격 금지'
           when f.structural and f.core then '★ 우선 분석'
           when f.structural and f.candidate then '☆ 관심·분석 보완'
           when f.structural then '✎ 종목분석 먼저'
           when f.correction then '⌛ 새 베이스 대기'
           when f.next_leader then '◎ 전환 관찰' else '—' end new_verdict,
      case when f.structural and f.high_52w_distance>=-.05 then '52주 고점(피벗) 돌파와 거래량 ≥1.4배를 함께 확인'
           when f.structural and f.atr_multiple>=7 then '신규 진입보다 베이스 재형성 대기'
           when f.structural and f.atr_multiple>=5 then '상승 추격 대신 눌림 또는 새 베이스 대기'
           when f.structural and f.atr_multiple<=2 then 'MA50 지지와 거래량 회복을 확인'
           when f.structural then '베이스 상단·피벗과 거래량 수급을 확인'
           when f.correction then 'MA50 회복과 새로운 베이스 형성을 확인'
           when f.next_leader then 'RS 3M 개선과 정배열 완성 시 후보 승격'
           when f.ma200 is not null and f.price<f.ma200 then '200일선 회복 및 RS 개선 대기' else '추세·RS 개선 대기' end new_guide
    from flags2 f
  )
  update public.market_metrics mm set tt_pass_count=c.tt_count,leader_tt=c.structural,stage=c.new_stage,verdict=c.new_verdict,action_guide=c.new_guide,updated_at=now()
  from classified c where mm.instrument_id=c.instrument_id and mm.as_of=c.as_of
    and (mm.tt_pass_count,mm.leader_tt,mm.stage,mm.verdict,mm.action_guide)
      is distinct from (c.tt_count,c.structural,c.new_stage,c.new_verdict,c.new_guide);
  get diagnostics swing_rows=row_count;

  -- ETF-VALUE-1: 20-session average daily trading value (close × volume, local currency) for the industry heatmap.
  -- Needs 20 sessions with a positive close and a volume on or before the metric date; otherwise unknown.
  with latest as (
    select distinct on (m.instrument_id) m.instrument_id,m.as_of
    from public.market_metrics m join public.instruments i on i.id=m.instrument_id
    where i.active and i.asset_class='ETF'
    order by m.instrument_id,m.as_of desc
  ), traded as (
    select l.instrument_id,l.as_of,
      case when count(*)=20 then avg(p.close*p.volume) end as traded_value_20d
    from latest l
    join lateral (
      select close,volume from public.price_daily
      where instrument_id=l.instrument_id and trade_date<=l.as_of and close>0 and volume is not null
      order by trade_date desc limit 20
    ) p on true
    group by l.instrument_id,l.as_of
  )
  update public.market_metrics m set traded_value_20d=t.traded_value_20d,updated_at=now()
  from latest l left join traded t on t.instrument_id=l.instrument_id and t.as_of=l.as_of
  where m.instrument_id=l.instrument_id and m.as_of=l.as_of
    and m.traded_value_20d is distinct from t.traded_value_20d;
  get diagnostics value_rows=row_count;

  return rs_rows+ibd_rows+swing_rows+value_rows;
end;
$$;
revoke all on function public.recalculate_etf_relative_strength() from public,anon,authenticated;
grant execute on function public.recalculate_etf_relative_strength() to service_role;

-- Recalculate once with the new benchmark. The scheduled market job invokes the same functions afterwards.
select public.recalculate_market_leadership();
select public.recalculate_etf_relative_strength();
