-- Reserve entries (histórico de valores guardados)
create table if not exists public.reserve_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  value numeric(15, 2) not null,
  date date not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists reserve_entries_user_date_idx
on public.reserve_entries (user_id, date);

alter table public.reserve_entries enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'reserve_entries' and policyname = 'reserve_entries_select_own'
  ) then
    create policy reserve_entries_select_own
      on public.reserve_entries
      for select
      using (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'reserve_entries' and policyname = 'reserve_entries_insert_own'
  ) then
    create policy reserve_entries_insert_own
      on public.reserve_entries
      for insert
      with check (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'reserve_entries' and policyname = 'reserve_entries_update_own'
  ) then
    create policy reserve_entries_update_own
      on public.reserve_entries
      for update
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'reserve_entries' and policyname = 'reserve_entries_delete_own'
  ) then
    create policy reserve_entries_delete_own
      on public.reserve_entries
      for delete
      using (user_id = auth.uid());
  end if;
end $$;
