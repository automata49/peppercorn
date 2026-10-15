-- User-owned notebooks preserve JSON, photos, ink, revisions and immutable entry IDs.
create table if not exists public.notebook_entries (
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 id text not null check (length(id) between 1 and 200),
 entry jsonb not null check (jsonb_typeof(entry) = 'object' and entry->>'id' = id),
 primary key(user_id,id)
);
alter table public.notebook_entries enable row level security;
create policy notebook_owner_select on public.notebook_entries for select to authenticated using ((select auth.uid())=user_id);
create policy notebook_owner_insert on public.notebook_entries for insert to authenticated with check ((select auth.uid())=user_id);
create policy notebook_owner_update on public.notebook_entries for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
revoke all on public.notebook_entries from authenticated;
grant select,insert,update on public.notebook_entries to authenticated;
revoke all on public.notebook_entries from anon;

create or replace function public.save_notebook_entries(updates jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
declare item jsonb; previous jsonb; owner uuid := auth.uid();
begin
 if owner is null then raise exception 'authentication required' using errcode='42501'; end if;
 if jsonb_typeof(updates) <> 'array' or jsonb_array_length(updates)>1000 or octet_length(updates::text)>20000000 then raise exception 'invalid payload'; end if;
 -- Serialize all writes for this owner, including concurrent first inserts.
 perform pg_advisory_xact_lock(hashtextextended(owner::text,0));
 for item in select value from jsonb_array_elements(updates) loop
  if jsonb_typeof(item)<>'object' or coalesce(item->>'id','')='' or jsonb_typeof(item->'revisions') is distinct from 'array' or item->>'updatedAt' is null then raise exception 'invalid entry'; end if;
  select entry into previous from public.notebook_entries where user_id=owner and id=item->>'id' for update;
  if found then
   if previous=item then continue; end if;
   if not exists(select 1 from jsonb_array_elements(item->'revisions') revision where revision->>'at'=previous->>'updatedAt') then raise exception 'edit conflict' using errcode='40001'; end if;
   update public.notebook_entries set entry=item where user_id=owner and id=item->>'id';
  else
   insert into public.notebook_entries(user_id,id,entry) values(owner,item->>'id',item);
  end if;
 end loop;
 if (select count(*) from public.notebook_entries where user_id=owner)>1000 or (select coalesce(sum(octet_length(entry::text)),0) from public.notebook_entries where user_id=owner)>18000000 then raise exception 'notebook limit exceeded'; end if;
end $$;
revoke all on function public.save_notebook_entries(jsonb) from public,anon;
grant execute on function public.save_notebook_entries(jsonb) to authenticated;

-- Each basket mutation changes one instrument; stale device snapshots never replace the collection.
create table public.folio_basket_items (
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 market text not null check(market in ('KR','US')),
 ticker text not null check(length(ticker) between 1 and 40),
 name text not null check(length(name)<=200),
 removed boolean not null default false,
 primary key(user_id,market,ticker)
);
alter table public.folio_basket_items enable row level security;
create policy basket_owner_select on public.folio_basket_items for select to authenticated using((select auth.uid())=user_id);
create policy basket_owner_insert on public.folio_basket_items for insert to authenticated with check((select auth.uid())=user_id);
create policy basket_owner_update on public.folio_basket_items for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
revoke all on public.folio_basket_items from authenticated;
grant select,insert,update on public.folio_basket_items to authenticated;
revoke all on public.folio_basket_items from anon;
