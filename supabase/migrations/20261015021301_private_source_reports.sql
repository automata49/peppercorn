create table public.private_source_reports (
  user_id uuid not null references auth.users(id) on delete cascade,
  drive_file_id text not null check (drive_file_id ~ '^[A-Za-z0-9_-]{10,100}$'),
  folder_id text not null check (folder_id ~ '^[A-Za-z0-9_-]{10,100}$'),
  title text not null check (length(title) between 1 and 250),
  source_url text not null check (source_url = 'https://drive.google.com/file/d/' || drive_file_id || '/view'),
  source_modified_at timestamptz not null,
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  summary jsonb not null check (jsonb_typeof(summary) = 'array' and jsonb_array_length(summary) between 1 and 5),
  pages jsonb not null check (jsonb_typeof(pages) = 'array' and jsonb_array_length(pages) between 1 and 60),
  links jsonb not null check (jsonb_typeof(links) = 'array' and jsonb_array_length(links) <= 500),
  imported_at timestamptz not null default now(),
  primary key (user_id, drive_file_id)
);
create index private_source_reports_recent on public.private_source_reports (user_id, source_modified_at desc, drive_file_id);
alter table public.private_source_reports enable row level security;
revoke all on public.private_source_reports from public, anon, authenticated;
grant select on public.private_source_reports to authenticated;
grant all on public.private_source_reports to service_role;
create policy private_source_reports_owner_read on public.private_source_reports
for select to authenticated using ((select auth.uid()) = user_id);
comment on table public.private_source_reports is 'Private Drive PDF reports. Owner-read only; trusted ingestion upserts by owner + Drive file id. No public feed or browser writes.';
