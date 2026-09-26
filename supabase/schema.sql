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
       m.ma50,m.ma200,m.leader_tt
from public.instruments i
join lateral (
  select mm.* from public.market_metrics mm
  where mm.instrument_id=i.id
  order by mm.as_of desc
  limit 1
) m on true
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
