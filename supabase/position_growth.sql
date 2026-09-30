-- Position Growth: dedicated tables, a server-side pipeline role and RLS.
-- Apply once after supabase/schema.sql; safe to re-run. It changes no Swing table, row or grant.
--
-- Scope: fundamentals_q (normalized facts with lineage) and position_snapshot (versioned metrics and
-- labels). Not created yet, because their rules or providers are undecided: filings, valuation_scenarios,
-- industry_kpis, ai_runs, theses, thesis_breaks (see docs/harness/POSITION_GROWTH.md).
--
-- The pipeline role has no login and no secret here. Mapping a credential to it (a server-side JWT with
-- role position_pipeline, or a dedicated login role granted membership) is deployment configuration and
-- must never reach the browser or a coding agent.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'position_pipeline') then
    create role position_pipeline nologin noinherit;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticator') then
    grant position_pipeline to authenticator;
  end if;
  -- The position-ingest Edge Function connects as postgres and runs each write under SET LOCAL ROLE
  -- position_pipeline, so the database, not the function code, limits it to the two Position tables.
  -- Membership only lets postgres step down to the narrower role; it adds no privilege.
  -- PG16+ gives a role's creator an ADMIN-only membership, which cannot SET ROLE, so SET is granted explicitly.
  if exists (select 1 from pg_roles where rolname = 'postgres') then
    if current_setting('server_version_num')::int >= 160000 then
      execute 'grant position_pipeline to postgres with set true, inherit false';
    else
      execute 'grant position_pipeline to postgres';
    end if;
  end if;
end $$;

-- One row per instrument, period, field and distinct source input. Rows are never updated: an amended
-- filing changes input_hash and adds a row, so revision history stays intact.
create table if not exists public.fundamentals_q (
  id uuid primary key default gen_random_uuid(),
  instrument_id uuid not null references public.instruments(id) on delete cascade,
  period_end date not null,
  field text not null check (field ~ '^[a-z][a-z0-9_]*$'),
  status text not null check (status in ('reported','unknown')),
  value numeric,
  unit text not null check (unit in ('USD','KRW','shares')),
  scope text not null check (scope in ('consolidated','separate')),
  unknown_reason text,
  extraction text not null check (extraction in ('direct','subtract','sum')),
  method_version text not null check (length(btrim(method_version)) > 0),
  lineage jsonb not null,
  source_filed_at date,
  input_hash text not null check (input_hash ~ '^[0-9a-f]{64}$'),
  pipeline_version text not null check (length(btrim(pipeline_version)) > 0),
  collected_at timestamptz not null default now(),
  unique (instrument_id, period_end, field, input_hash),
  -- A reported fact must retain usable SEC/DART identity, dates, periods and a raw response hash.
  -- The raw hash may cover the full response or be present on every source input.
  constraint fundamentals_q_reported_has_evidence check (
    status <> 'reported' or coalesce((
      value is not null and unknown_reason is null and source_filed_at is not null
      and case when jsonb_typeof(lineage -> 'inputs') = 'array'
               then jsonb_array_length(lineage -> 'inputs') > 0
                 and lineage ->> 'source' in ('SEC', 'DART')
                 and lineage ->> 'operation' = extraction
                 and jsonb_array_length(jsonb_path_query_array(lineage,
                   '$.inputs[*] ? (@.end.type() == "string" && @.end != "" && @.filed.type() == "string" && @.filed != "")'))
                   = jsonb_array_length(lineage -> 'inputs')
                 and jsonb_array_length(jsonb_path_query_array(lineage,
                   case lineage ->> 'source'
                     when 'SEC' then '$.inputs[*] ? (@.accession.type() == "string" && @.accession != "")'::jsonpath
                     else '$.inputs[*] ? (@.receipt.type() == "string" && @.receipt != "")'::jsonpath end))
                   = jsonb_array_length(lineage -> 'inputs')
                 and (lineage ->> 'raw_sha256' ~ '^[0-9a-f]{64}$'
                   or jsonb_array_length(jsonb_path_query_array(lineage,
                     '$.inputs[*] ? (@.raw_sha256 like_regex "^[0-9a-f]{64}$")'))
                     = jsonb_array_length(lineage -> 'inputs'))
               else false end), false)),
  constraint fundamentals_q_unknown_has_reason check (
    status <> 'unknown' or (value is null and unknown_reason is not null and length(btrim(unknown_reason)) > 0))
);

-- One row per instrument, as-of date, rules version and distinct input set.
create table if not exists public.position_snapshot (
  id uuid primary key default gen_random_uuid(),
  instrument_id uuid not null references public.instruments(id) on delete cascade,
  as_of date not null,
  rules_version text not null check (length(btrim(rules_version)) > 0),
  fcf_method text not null check (length(btrim(fcf_method)) > 0),
  roic_method text not null check (length(btrim(roic_method)) > 0),
  status text not null check (status in ('ok','check_failed','insufficient_data','unavailable')),
  -- Each check is [name, passed, detail], the shape the collector emits.
  checks jsonb not null default '[]'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  type_label text,
  quality_label text,
  growth_label text,
  value_label text,
  label_reasons jsonb not null default '{}'::jsonb,
  input_hash text not null check (input_hash ~ '^[0-9a-f]{64}$'),
  pipeline_version text not null check (length(btrim(pipeline_version)) > 0),
  computed_at timestamptz not null default now(),
  unique (instrument_id, as_of, rules_version, input_hash),
  constraint position_snapshot_json_shapes check (
    jsonb_typeof(checks) = 'array' and jsonb_typeof(metrics) = 'object' and jsonb_typeof(label_reasons) = 'object'),
  -- The four labels are independent; a combined score is refused.
  constraint position_snapshot_no_combined_score check (
    not (metrics ?| array['score','position_score','composite_score','total_score'])),
  -- A snapshot is only ok when checks exist and every one has a boolean true in its second slot;
  -- malformed elements, nulls and strings therefore count as not passed.
  constraint position_snapshot_ok_requires_passed_checks check (
    status <> 'ok' or (
      jsonb_array_length(checks) > 0
      and jsonb_array_length(checks) = jsonb_array_length(jsonb_path_query_array(checks, '$[*][1] ? (@ == true)')))),
  -- A failed or missing data check suppresses all four labels and their reasons.
  constraint position_snapshot_labels_follow_status check (
    (status = 'ok'
      and length(btrim(coalesce(type_label, ''))) > 0 and length(btrim(coalesce(quality_label, ''))) > 0
      and length(btrim(coalesce(growth_label, ''))) > 0 and length(btrim(coalesce(value_label, ''))) > 0
      and label_reasons ?& array['type','quality','growth','value'])
    or (status <> 'ok'
      and type_label is null and quality_label is null and growth_label is null and value_label is null
      and label_reasons = '{}'::jsonb))
);

create index if not exists fundamentals_q_instrument_period_idx on public.fundamentals_q(instrument_id, period_end desc);
create index if not exists position_snapshot_instrument_asof_idx on public.position_snapshot(instrument_id, as_of desc);

comment on table public.fundamentals_q is 'Append-only normalized filing facts with lineage. Written only by the Position pipeline role.';
comment on table public.position_snapshot is 'Append-only versioned Position metrics and four independent labels; labels exist only when every check passed.';

create or replace function public.position_forbid_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% is append-only; insert a new row for a changed input', tg_table_name;
end;
$$;
revoke all on function public.position_forbid_update() from public, anon, authenticated;

drop trigger if exists fundamentals_q_append_only on public.fundamentals_q;
create trigger fundamentals_q_append_only before update on public.fundamentals_q
  for each row execute function public.position_forbid_update();
drop trigger if exists position_snapshot_append_only on public.position_snapshot;
create trigger position_snapshot_append_only before update on public.position_snapshot
  for each row execute function public.position_forbid_update();

alter table public.fundamentals_q enable row level security;
alter table public.position_snapshot enable row level security;

-- Default table exposure varies by project configuration; start from explicit grants.
revoke all on public.fundamentals_q, public.position_snapshot from public, anon, authenticated;
grant select on public.position_snapshot to anon, authenticated;
grant select on public.fundamentals_q to authenticated;

-- The pipeline reads instruments to resolve ids and appends to its own tables. No update or delete.
grant usage on schema public to position_pipeline;
grant select on public.instruments to position_pipeline;
grant select, insert on public.fundamentals_q, public.position_snapshot to position_pipeline;

-- Defence in depth: the pipeline must never touch Swing or user-owned data, whatever default privileges say.
revoke all on public.price_daily, public.market_metrics, public.universe_memberships,
  public.stock_analyses, public.watchlist, public.portfolio_positions, public.user_thresholds,
  public.research_notes, public.trade_journal from position_pipeline;

drop policy if exists "position snapshot public read" on public.position_snapshot;
create policy "position snapshot public read" on public.position_snapshot for select to anon, authenticated using (true);
drop policy if exists "fundamentals authenticated read" on public.fundamentals_q;
create policy "fundamentals authenticated read" on public.fundamentals_q for select to authenticated using (true);

drop policy if exists "position pipeline snapshot read" on public.position_snapshot;
create policy "position pipeline snapshot read" on public.position_snapshot for select to position_pipeline using (true);
drop policy if exists "position pipeline snapshot insert" on public.position_snapshot;
create policy "position pipeline snapshot insert" on public.position_snapshot for insert to position_pipeline with check (true);
drop policy if exists "position pipeline fundamentals read" on public.fundamentals_q;
create policy "position pipeline fundamentals read" on public.fundamentals_q for select to position_pipeline using (true);
drop policy if exists "position pipeline fundamentals insert" on public.fundamentals_q;
create policy "position pipeline fundamentals insert" on public.fundamentals_q for insert to position_pipeline with check (true);

drop policy if exists "position pipeline instruments read" on public.instruments;
create policy "position pipeline instruments read" on public.instruments for select to position_pipeline using (true);
