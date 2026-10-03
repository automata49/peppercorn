-- TEMP-1 시장 온도계 (by user decision 2026-10-03): each user's own Howard Marks market temperature entries.
-- One row per user and date. marks maps a checklist item key to 0 (hot side) .. 4 (cold side); an unmarked item is
-- absent, never 0. evidence maps an item key to the user's note. Private user data under the same RLS pattern as
-- research_notes: only the owner reads or writes, anon has no access. Additive and re-runnable; no existing table,
-- metric or classification changes (recalculation impact: none). research_notes is left untouched.
create table if not exists public.market_temperature_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recorded_on date not null,
  checklist_version text not null default 'marks-temperature-1',
  marks jsonb not null default '{}'::jsonb check (jsonb_typeof(marks)='object'),
  evidence jsonb not null default '{}'::jsonb check (jsonb_typeof(evidence)='object'),
  note text check (note is null or length(note)<=2000),
  created_at timestamptz not null default now(),
  unique (user_id, recorded_on)
);

create or replace function public.market_temperature_marks_valid(m jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(bool_and(jsonb_typeof(v)='number' and (v::text)::numeric in (0,1,2,3,4)),true) from jsonb_each(m) e(k,v)
$$;
alter table public.market_temperature_entries drop constraint if exists market_temperature_marks_range;
alter table public.market_temperature_entries add constraint market_temperature_marks_range check (public.market_temperature_marks_valid(marks));

alter table public.market_temperature_entries enable row level security;
revoke all on public.market_temperature_entries from anon;
grant select,insert,update,delete on public.market_temperature_entries to authenticated;

drop policy if exists "own temperature read" on public.market_temperature_entries;
drop policy if exists "own temperature insert" on public.market_temperature_entries;
drop policy if exists "own temperature update" on public.market_temperature_entries;
drop policy if exists "own temperature delete" on public.market_temperature_entries;
create policy "own temperature read" on public.market_temperature_entries for select to authenticated using ((select auth.uid())=user_id);
create policy "own temperature insert" on public.market_temperature_entries for insert to authenticated with check ((select auth.uid())=user_id);
create policy "own temperature update" on public.market_temperature_entries for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "own temperature delete" on public.market_temperature_entries for delete to authenticated using ((select auth.uid())=user_id);
