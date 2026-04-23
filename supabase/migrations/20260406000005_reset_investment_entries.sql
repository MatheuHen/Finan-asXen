begin;

do $$
declare
  backup_name text := 'investment_entries_backup_' || to_char(now(), 'YYYYMMDD_HH24MISS');
  needs_reset boolean := false;
  extra_cols_count integer := 0;
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'investment_entries'
  ) then
    needs_reset := true;
  else
    select count(*)
      into extra_cols_count
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'investment_entries'
      and column_name not in ('id', 'user_id', 'category', 'value', 'current_value', 'date', 'created_at');

    if extra_cols_count > 0 then
      needs_reset := true;
    end if;

    if exists (
      select 1
      from (values
        ('id'),
        ('user_id'),
        ('category'),
        ('value'),
        ('current_value'),
        ('date'),
        ('created_at')
      ) as req(col)
      where not exists (
        select 1
        from information_schema.columns c
        where c.table_schema = 'public'
          and c.table_name = 'investment_entries'
          and c.column_name = req.col
      )
    ) then
      needs_reset := true;
    end if;
  end if;

  if needs_reset then
    if exists (
      select 1
      from information_schema.tables
      where table_schema = 'public'
        and table_name = 'investment_entries'
    ) then
      execute format('create table if not exists public.%I as table public.investment_entries', backup_name);
    end if;

    drop table if exists public.investment_entries cascade;

    create table public.investment_entries (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references public.profiles(id) on delete cascade,
      category text not null,
      value numeric(15, 2) not null,
      current_value numeric(15, 2),
      date date not null,
      created_at timestamp with time zone default timezone('utc'::text, now()) not null,
      constraint investment_entries_value_positive check (value > 0),
      constraint investment_entries_current_value_positive check (current_value is null or current_value > 0),
      constraint investment_entries_category_valid check (category in ('Ações', 'Cripto', 'Renda fixa', 'Fundos', 'Outros'))
    );
  end if;

  alter table public.investment_entries enable row level security;

  create index if not exists investment_entries_user_date_idx on public.investment_entries (user_id, date);
  create index if not exists investment_entries_user_date_value_idx on public.investment_entries (user_id, date, value);

  drop policy if exists investment_entries_select_own on public.investment_entries;
  drop policy if exists investment_entries_insert_own on public.investment_entries;
  drop policy if exists investment_entries_update_own on public.investment_entries;
  drop policy if exists investment_entries_delete_own on public.investment_entries;

  create policy investment_entries_select_own
    on public.investment_entries
    for select
    using (user_id = auth.uid());

  create policy investment_entries_insert_own
    on public.investment_entries
    for insert
    with check (user_id = auth.uid());

  create policy investment_entries_update_own
    on public.investment_entries
    for update
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

  create policy investment_entries_delete_own
    on public.investment_entries
    for delete
    using (user_id = auth.uid());
end $$;

commit;
