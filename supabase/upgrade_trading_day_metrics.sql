-- Add exact trading-day returns and benchmark-relative RS to an existing Peppercorn project.
alter table public.market_metrics add column if not exists return_5d numeric;
alter table public.market_metrics add column if not exists rs_5d numeric;
alter table public.market_metrics add column if not exists return_20d numeric;
alter table public.market_metrics add column if not exists rs_20d numeric;
alter table public.market_metrics add column if not exists return_50d numeric;
alter table public.market_metrics add column if not exists rs_50d numeric;
alter table public.market_metrics add column if not exists return_120d numeric;
alter table public.market_metrics add column if not exists rs_120d numeric;
alter table public.market_metrics add column if not exists return_200d numeric;
alter table public.market_metrics add column if not exists rs_200d numeric;

-- Backfill each metric date using the close exactly N trading sessions earlier.
with history as (
  select m.instrument_id,m.as_of,p.close,
    row_number() over(partition by m.instrument_id,m.as_of order by p.trade_date desc) as rn
  from public.market_metrics m
  join lateral (
    select trade_date,close from public.price_daily
    where instrument_id=m.instrument_id and trade_date<=m.as_of and close is not null
    order by trade_date desc limit 201
  ) p on true
), closes as (
  select instrument_id,as_of,
    max(close) filter(where rn=1) as latest,
    max(close) filter(where rn=6) as close_5d,
    max(close) filter(where rn=21) as close_20d,
    max(close) filter(where rn=51) as close_50d,
    max(close) filter(where rn=121) as close_120d,
    max(close) filter(where rn=201) as close_200d
  from history group by instrument_id,as_of
)
update public.market_metrics m set
  return_5d=case when c.close_5d<>0 then c.latest/c.close_5d-1 end,
  return_20d=case when c.close_20d<>0 then c.latest/c.close_20d-1 end,
  return_50d=case when c.close_50d<>0 then c.latest/c.close_50d-1 end,
  return_120d=case when c.close_120d<>0 then c.latest/c.close_120d-1 end,
  return_200d=case when c.close_200d<>0 then c.latest/c.close_200d-1 end
from closes c where m.instrument_id=c.instrument_id and m.as_of=c.as_of;

create or replace view public.leaderboard_view with (security_invoker=true) as
select i.id,i.market,i.ticker,i.name,i.asset_class,i.sector,i.industry,
       m.price,m.verdict,m.stage,m.action_guide,
       m.return_1w,m.return_1m,m.return_3m,m.return_6m,m.return_12m,
       m.rs_1w,m.rs_1m,m.rs_3m,m.rs_6m,m.rs_12m,m.rs_rank,
       m.high_52w_distance,m.volume_ratio,m.adr20_pct,m.rsi14,m.atr_multiple,
       m.ma50,m.ma200,m.leader_tt,
       case
         when m.instrument_id is null then '데이터 준비중'
         when m.leader_tt
          and coalesce(m.rs_rank,0)>=95
          and coalesce(m.high_52w_distance,-1)>=-0.15
          and coalesce(m.rs_3m,-1)>0
          and coalesce(m.rs_6m,-1)>0 then '핵심 주도'
         when (m.leader_tt
          and coalesce(m.rs_rank,0)>=85
          and coalesce(m.high_52w_distance,-1)>=-0.20
          and coalesce(m.rs_3m,-1)>0)
          or (m.stage='◇ 조정 중 주도주' and coalesce(m.rs_rank,0)>=85)
           then '주도 후보'
         when m.stage='↻ 넥스트 리더' then '강세 전환'
         when m.stage='❌ 제외' then '약세'
         else '중립'
       end as leadership_class,
       i.exchange,i.classification_scheme,i.classification_source,i.classification_as_of,
       coalesce(u.index_memberships,'{}'::text[]) as index_memberships,
       coalesce(u.index_statuses,'{}'::text[]) as index_statuses,
       case when m.instrument_id is null then '데이터 준비중' else '정상' end as data_status,
       m.return_5d,m.rs_5d,m.return_20d,m.rs_20d,m.return_50d,m.rs_50d,m.return_120d,m.rs_120d,m.return_200d,m.rs_200d
from public.instruments i
left join lateral (
  select mm.* from public.market_metrics mm
  where mm.instrument_id=i.id
  order by mm.as_of desc
  limit 1
) m on true
left join lateral (
  select
    array_agg(distinct um.theme_group order by um.theme_group)
      filter (where um.entry_type='INDEX' and um.theme_group is not null) as index_memberships,
    array_agg(distinct um.composition_status order by um.composition_status)
      filter (where um.entry_type='INDEX' and um.composition_status is not null) as index_statuses
  from public.universe_memberships um
  where um.instrument_id=i.id
) u on true
where i.active=true;


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
    where (i.market='US' and i.ticker='SPY') or (i.market='KR' and i.ticker='069500')
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
      coalesce(l.price>l.ma50 and l.ma50>l.ma200 and l.high_52w_distance>=-.20 and l.rs_rank>=85 and l.rs_3m>0,false) candidate,
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

select public.recalculate_market_leadership();
