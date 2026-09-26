create extension if not exists pgcrypto;

create table if not exists public.instruments (
  id uuid primary key default gen_random_uuid(),
  market text not null check (market in ('US','KR')),
  ticker text not null,
  name text not null,
  asset_class text not null default 'Equity',
  exchange text,
  sector text,
  industry text,
  role text,
  priority text,
  theme text,
  benchmark_ticker text,
  currency text,
  classification_scheme text,
  classification_source text,
  classification_as_of date,
  universe_updated_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (market,ticker)
);

create table if not exists public.universe_memberships (
  id uuid primary key,
  instrument_id uuid not null references public.instruments(id) on delete cascade,
  entry_type text,
  theme_group text,
  parent_etf_ticker text,
  holding_rank integer,
  weight numeric,
  as_of date,
  source text,
  gf_symbol text,
  validation_status text,
  composition_status text,
  created_at timestamptz not null default now()
);

create index if not exists universe_memberships_instrument_idx on public.universe_memberships(instrument_id);
create index if not exists universe_memberships_parent_etf_idx on public.universe_memberships(parent_etf_ticker);

create table if not exists public.price_daily (
  instrument_id uuid not null references public.instruments(id) on delete cascade,
  trade_date date not null,
  open numeric,
  high numeric,
  low numeric,
  close numeric not null,
  volume bigint,
  primary key (instrument_id,trade_date)
);

create table if not exists public.market_metrics (
  instrument_id uuid not null references public.instruments(id) on delete cascade,
  as_of date not null,
  price numeric,
  ma50 numeric,
  ma200 numeric,
  high_52w numeric,
  low_52w numeric,
  return_1w numeric,
  return_1m numeric,
  return_3m numeric,
  return_6m numeric,
  return_12m numeric,
  volume_ratio numeric,
  adr20_pct numeric,
  rsi14 numeric,
  atr20_pct numeric,
  high_52w_distance numeric,
  rs_1w numeric,
  rs_1m numeric,
  rs_3m numeric,
  rs_6m numeric,
  rs_12m numeric,
  rs_rank integer,
  atr_multiple numeric,
  tt_pass_count integer,
  leader_tt boolean not null default false,
  verdict text,
  stage text,
  action_guide text,
  data_days integer,
  return_5d numeric,
  rs_5d numeric,
  return_20d numeric,
  rs_20d numeric,
  return_50d numeric,
  rs_50d numeric,
  return_120d numeric,
  rs_120d numeric,
  return_200d numeric,
  rs_200d numeric,
  updated_at timestamptz not null default now(),
  primary key (instrument_id,as_of)
);

create table if not exists public.watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  instrument_id uuid not null references public.instruments(id) on delete cascade,
  interest_price numeric,
  stop_pct numeric,
  priority text,
  note text,
  status text default 'WATCH',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id,instrument_id)
);

create table if not exists public.portfolio_positions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  instrument_id uuid not null references public.instruments(id) on delete cascade,
  account text,
  shares numeric not null default 0,
  avg_price numeric,
  currency text,
  target_price numeric,
  stop_price numeric,
  thesis text,
  status text not null default 'OPEN',
  opened_at date,
  updated_at timestamptz not null default now()
);

create table if not exists public.stock_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  instrument_id uuid not null references public.instruments(id) on delete cascade,
  analysis_date date not null default current_date,
  eps_growth_q numeric,
  sales_growth_q numeric,
  eps_growth_3y numeric,
  roe numeric,
  operating_margin numeric,
  debt_ratio numeric,
  operating_cashflow_positive boolean,
  pe numeric,
  peg numeric,
  moat text,
  growth_driver text,
  key_risk text,
  auto_grade text,
  conclusion text,
  created_at timestamptz not null default now()
);

create table if not exists public.research_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  written_at date not null default current_date,
  note_type text,
  target text,
  title text,
  fact text,
  interpretation text,
  source text,
  source_type text,
  verified boolean,
  market_impact text,
  related_assets text,
  importance integer check (importance between 1 and 5),
  next_review_date date,
  status text,
  created_at timestamptz not null default now()
);

create table if not exists public.trade_journal (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  instrument_id uuid references public.instruments(id) on delete set null,
  trade_date date not null default current_date,
  account text,
  tranche text,
  buy_price numeric,
  currency text,
  thesis text,
  evidence_type text,
  confidence integer check (confidence between 1 and 5),
  target_price numeric,
  stop_price numeric,
  review_condition text,
  review_date date,
  status text,
  exit_date date,
  sell_price numeric,
  realized_return numeric,
  review_note text,
  lesson text,
  created_at timestamptz not null default now()
);

create table if not exists public.user_thresholds (
  user_id uuid primary key references auth.users(id) on delete cascade,
  leader_rs_rank integer not null default 70,
  leader_high_distance numeric not null default -0.25,
  breakout_high_distance numeric not null default -0.05,
  breakout_volume_ratio numeric not null default 1.4,
  pullback_atr_multiple numeric not null default 2.0,
  extended_atr_multiple numeric not null default 5.0,
  overextended_atr_multiple numeric not null default 7.0,
  max_stop_pct numeric not null default 0.08,
  next_leader_high_distance numeric not null default -0.30,
  correction_leader_high_distance numeric not null default -0.40,
  updated_at timestamptz not null default now()
);

alter table public.instruments enable row level security;
alter table public.universe_memberships enable row level security;
alter table public.price_daily enable row level security;
alter table public.market_metrics enable row level security;
alter table public.watchlist enable row level security;
alter table public.portfolio_positions enable row level security;
alter table public.stock_analyses enable row level security;
alter table public.research_notes enable row level security;
alter table public.trade_journal enable row level security;
alter table public.user_thresholds enable row level security;

grant select on public.instruments,public.universe_memberships,public.price_daily,public.market_metrics to anon,authenticated;
grant select,insert,update,delete on public.watchlist,public.portfolio_positions,public.stock_analyses,public.research_notes,public.trade_journal,public.user_thresholds to authenticated;

create policy "public instruments read" on public.instruments for select to anon,authenticated using (true);
create policy "public universe memberships read" on public.universe_memberships for select to anon,authenticated using (true);
create policy "public prices read" on public.price_daily for select to anon,authenticated using (true);
create policy "public metrics read" on public.market_metrics for select to anon,authenticated using (true);

create policy "own watchlist read" on public.watchlist for select to authenticated using ((select auth.uid())=user_id);
create policy "own watchlist insert" on public.watchlist for insert to authenticated with check ((select auth.uid())=user_id);
create policy "own watchlist update" on public.watchlist for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "own watchlist delete" on public.watchlist for delete to authenticated using ((select auth.uid())=user_id);

create policy "own portfolio read" on public.portfolio_positions for select to authenticated using ((select auth.uid())=user_id);
create policy "own portfolio insert" on public.portfolio_positions for insert to authenticated with check ((select auth.uid())=user_id);
create policy "own portfolio update" on public.portfolio_positions for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "own portfolio delete" on public.portfolio_positions for delete to authenticated using ((select auth.uid())=user_id);

create policy "own analyses read" on public.stock_analyses for select to authenticated using ((select auth.uid())=user_id);
create policy "own analyses insert" on public.stock_analyses for insert to authenticated with check ((select auth.uid())=user_id);
create policy "own analyses update" on public.stock_analyses for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "own analyses delete" on public.stock_analyses for delete to authenticated using ((select auth.uid())=user_id);

create policy "own research read" on public.research_notes for select to authenticated using ((select auth.uid())=user_id);
create policy "own research insert" on public.research_notes for insert to authenticated with check ((select auth.uid())=user_id);
create policy "own research update" on public.research_notes for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "own research delete" on public.research_notes for delete to authenticated using ((select auth.uid())=user_id);

create policy "own journal read" on public.trade_journal for select to authenticated using ((select auth.uid())=user_id);
create policy "own journal insert" on public.trade_journal for insert to authenticated with check ((select auth.uid())=user_id);
create policy "own journal update" on public.trade_journal for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "own journal delete" on public.trade_journal for delete to authenticated using ((select auth.uid())=user_id);

create policy "own thresholds read" on public.user_thresholds for select to authenticated using ((select auth.uid())=user_id);
create policy "own thresholds insert" on public.user_thresholds for insert to authenticated with check ((select auth.uid())=user_id);
create policy "own thresholds update" on public.user_thresholds for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "own thresholds delete" on public.user_thresholds for delete to authenticated using ((select auth.uid())=user_id);

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

grant select on public.leaderboard_view to anon,authenticated;


-- Covering indexes for foreign-key joins
create index if not exists portfolio_positions_instrument_idx on public.portfolio_positions(instrument_id);
create index if not exists portfolio_positions_user_idx on public.portfolio_positions(user_id);
create index if not exists research_notes_user_idx on public.research_notes(user_id);
create index if not exists stock_analyses_instrument_idx on public.stock_analyses(instrument_id);
create index if not exists stock_analyses_user_idx on public.stock_analyses(user_id);
create index if not exists trade_journal_instrument_idx on public.trade_journal(instrument_id);
create index if not exists trade_journal_user_idx on public.trade_journal(user_id);
create index if not exists watchlist_instrument_idx on public.watchlist(instrument_id);


-- Workspace parity: Research / Stock Analysis / Journal
alter table public.research_notes
  add column if not exists verification text,
  add column if not exists journal_no text;

alter table public.stock_analyses
  add column if not exists lynch_category text,
  add column if not exists research_note_no text,
  add column if not exists journal_no text;

alter table public.trade_journal
  add column if not exists thesis_hit text;

create or replace view public.stock_analysis_view
with (security_invoker=true) as
select a.*,i.market,i.ticker,i.name,i.sector,i.industry,
       m.stage,m.verdict,m.rs_rank,m.price,m.ma50,m.ma200,m.high_52w_distance
from public.stock_analyses a
join public.instruments i on i.id=a.instrument_id
left join lateral (
  select mm.stage,mm.verdict,mm.rs_rank,mm.price,mm.ma50,mm.ma200,mm.high_52w_distance
  from public.market_metrics mm
  where mm.instrument_id=i.id
  order by mm.as_of desc
  limit 1
) m on true;

grant select on public.stock_analysis_view to authenticated;

create or replace view public.trade_journal_view
with (security_invoker=true) as
select j.id,j.user_id,j.instrument_id,j.trade_date,j.account,j.tranche,j.buy_price,j.currency,
       j.thesis,j.evidence_type,j.confidence,j.target_price,j.stop_price,j.review_condition,
       j.review_date,j.status,j.exit_date,j.sell_price,j.realized_return,j.review_note,j.lesson,j.created_at,
       i.market,i.ticker,i.name,j.thesis_hit,i.sector,i.industry,m.stage,m.verdict,m.rs_rank
from public.trade_journal j
left join public.instruments i on i.id=j.instrument_id
left join lateral (
  select mm.stage,mm.verdict,mm.rs_rank
  from public.market_metrics mm
  where mm.instrument_id=i.id
  order by mm.as_of desc
  limit 1
) m on true;

grant select on public.trade_journal_view to authenticated;


-- Automated universe activation and cross-sectional leadership recalculation
create or replace function public.activate_index_universe()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare affected integer;
begin
  update public.instruments i
     set active = exists (
       select 1 from public.universe_memberships um
       where um.instrument_id=i.id and um.entry_type='INDEX'
     ), updated_at=now()
   where i.asset_class='Equity' and i.market in ('US','KR');
  get diagnostics affected = row_count;
  return affected;
end;
$$;
revoke all on function public.activate_index_universe() from public,anon,authenticated;
grant execute on function public.activate_index_universe() to service_role;

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
revoke all on function public.recalculate_market_leadership() from public,anon,authenticated;
grant execute on function public.recalculate_market_leadership() to service_role;
