-- RESEARCH-INGEST-1: public discovery metadata + private user-authorized captures.
-- Public collectors may discover only public channel metadata. Paid/subscriber bodies are never fetched server-side;
-- a user explicitly captures text they are already viewing in their own browser.
do $$
begin
  if not exists (select 1 from pg_roles where rolname='research_feed_pipeline') then
    create role research_feed_pipeline nologin noinherit;
  end if;
  if exists (select 1 from pg_roles where rolname='postgres') then
    if current_setting('server_version_num')::int >= 160000 then
      execute 'grant research_feed_pipeline to postgres with set true, inherit false';
    else
      execute 'grant research_feed_pipeline to postgres';
    end if;
  end if;
end $$;
create table if not exists public.external_research_feed (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('telegram','youtube','naver_public')),
  source_key text not null check (length(source_key) between 1 and 80),
  external_id text not null check (length(external_id) between 1 and 120),
  fingerprint text not null unique check (fingerprint ~ '^[0-9a-f]{64}$'),
  source_url text not null check (source_url ~ '^https://'),
  linked_url text check (linked_url is null or linked_url ~ '^https://'),
  linked_type text check (linked_type is null or linked_type in ('naver_premium','naver','youtube','other')),
  title text not null check (length(title) between 1 and 500),
  excerpt text check (excerpt is null or length(excerpt)<=4000),
  published_at timestamptz,
  discovered_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata)='object'),
  unique (source_key, external_id)
);

create table if not exists public.research_captures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feed_item_id uuid references public.external_research_feed(id) on delete set null,
  source_url text not null check (source_url ~ '^https://' and length(source_url)<=2048),
  title text not null default '' check (length(title)<=500),
  source_type text not null default 'web' check (source_type in ('naver_premium','telegram','youtube','web')),
  captured_text text not null check (length(btrim(captured_text)) between 1 and 200000),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  analysis_status text not null default 'provider_unavailable'
    check (analysis_status in ('provider_unavailable','pending','ready','error')),
  analysis jsonb,
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, content_hash)
);

create index if not exists external_research_feed_published_idx on public.external_research_feed(published_at desc nulls last, discovered_at desc);
create index if not exists research_captures_user_date_idx on public.research_captures(user_id,captured_at desc);

alter table public.external_research_feed enable row level security;
alter table public.research_captures enable row level security;

grant usage on schema public to research_feed_pipeline;
revoke all on public.external_research_feed from research_feed_pipeline;
grant select,insert,update on public.external_research_feed to research_feed_pipeline;
revoke all on public.research_captures from research_feed_pipeline;
drop policy if exists "research feed pipeline read" on public.external_research_feed;
drop policy if exists "research feed pipeline insert" on public.external_research_feed;
drop policy if exists "research feed pipeline update" on public.external_research_feed;
create policy "research feed pipeline read" on public.external_research_feed for select to research_feed_pipeline using (true);
create policy "research feed pipeline insert" on public.external_research_feed for insert to research_feed_pipeline with check (true);
create policy "research feed pipeline update" on public.external_research_feed for update to research_feed_pipeline using (true) with check (true);

-- Feed rows contain only publicly visible discovery metadata, but the app exposes them only to a signed-in owner session.
revoke all on public.external_research_feed from anon;
grant select on public.external_research_feed to authenticated;
drop policy if exists "authenticated research feed read" on public.external_research_feed;
create policy "authenticated research feed read" on public.external_research_feed for select to authenticated using (true);

revoke all on public.research_captures from anon;
grant select,insert,update,delete on public.research_captures to authenticated;
drop policy if exists "own research captures read" on public.research_captures;
drop policy if exists "own research captures insert" on public.research_captures;
drop policy if exists "own research captures update" on public.research_captures;
drop policy if exists "own research captures delete" on public.research_captures;
create policy "own research captures read" on public.research_captures for select to authenticated using ((select auth.uid())=user_id);
create policy "own research captures insert" on public.research_captures for insert to authenticated with check ((select auth.uid())=user_id);
create policy "own research captures update" on public.research_captures for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "own research captures delete" on public.research_captures for delete to authenticated using ((select auth.uid())=user_id);