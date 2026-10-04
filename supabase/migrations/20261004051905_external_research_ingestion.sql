create table public.external_research_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_kind text not null default 'manual_capture'
    check (source_kind in ('manual_capture','bookmarklet','file_upload')),
  source_name text,
  source_url text not null check (char_length(source_url) between 8 and 2048),
  title text not null check (char_length(title) between 1 and 500),
  content text not null check (char_length(content) between 1 and 120000),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  captured_at timestamptz not null default now(),
  published_at timestamptz,
  analysis_status text not null default 'provider_unavailable'
    check (analysis_status in ('pending','provider_unavailable','analyzed','error','archived')),
  analysis jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint external_research_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint external_research_analysis_object check (analysis is null or jsonb_typeof(analysis) = 'object'),
  unique (user_id, content_hash)
);

create index external_research_items_user_captured_idx
  on public.external_research_items(user_id, captured_at desc);

alter table public.external_research_items enable row level security;

revoke all on table public.external_research_items from anon;
grant select, insert, update, delete on table public.external_research_items to authenticated;

create policy "own external research read"
  on public.external_research_items for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "own external research insert"
  on public.external_research_items for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "own external research update"
  on public.external_research_items for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "own external research delete"
  on public.external_research_items for delete to authenticated
  using ((select auth.uid()) = user_id);
