create table if not exists public.investment_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  value numeric(15, 2) not null,
  date date not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.investment_entries add column if not exists user_id uuid;
alter table public.investment_entries add column if not exists value numeric(15, 2);
alter table public.investment_entries add column if not exists date date;
alter table public.investment_entries add column if not exists created_at timestamp with time zone default timezone('utc'::text, now()) not null;

alter table public.investment_entries enable row level security;

create index if not exists investment_entries_user_date_idx on public.investment_entries (user_id, date);
create index if not exists investment_entries_user_date_value_idx on public.investment_entries (user_id, date, value);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'investment_entries_value_positive'
      and conrelid = 'public.investment_entries'::regclass
  ) then
    alter table public.investment_entries
      add constraint investment_entries_value_positive
      check (value > 0);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'investment_entries' and policyname = 'investment_entries_select_own'
  ) then
    create policy investment_entries_select_own
      on public.investment_entries
      for select
      using (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'investment_entries' and policyname = 'investment_entries_insert_own'
  ) then
    create policy investment_entries_insert_own
      on public.investment_entries
      for insert
      with check (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'investment_entries' and policyname = 'investment_entries_update_own'
  ) then
    create policy investment_entries_update_own
      on public.investment_entries
      for update
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'investment_entries' and policyname = 'investment_entries_delete_own'
  ) then
    create policy investment_entries_delete_own
      on public.investment_entries
      for delete
      using (user_id = auth.uid());
  end if;
end $$;

