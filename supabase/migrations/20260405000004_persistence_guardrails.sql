create table if not exists public.reserve_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  value numeric(15, 2) not null,
  date date not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.reserve_entries add column if not exists user_id uuid;
alter table public.reserve_entries add column if not exists value numeric(15, 2);
alter table public.reserve_entries add column if not exists date date;
alter table public.reserve_entries add column if not exists created_at timestamp with time zone default timezone('utc'::text, now()) not null;

alter table public.reserve_entries enable row level security;

create index if not exists reserve_entries_user_date_idx on public.reserve_entries (user_id, date);
create index if not exists reserve_entries_user_date_value_idx on public.reserve_entries (user_id, date, value);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'reserve_entries_value_positive'
      and conrelid = 'public.reserve_entries'::regclass
  ) then
    alter table public.reserve_entries
      add constraint reserve_entries_value_positive
      check (value > 0);
  end if;

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
