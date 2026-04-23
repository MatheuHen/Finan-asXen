do $$
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'categories'
  ) then
    create table public.categories (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references auth.users(id) on delete cascade,
      name text not null,
      color text,
      icon text,
      type public.transaction_type not null default 'expense',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  end if;
end $$;

alter table public.categories
  add column if not exists user_id uuid;

alter table public.categories
  add column if not exists name text;

alter table public.categories
  add column if not exists color text;

alter table public.categories
  add column if not exists icon text;

alter table public.categories
  add column if not exists type public.transaction_type;

alter table public.categories
  add column if not exists created_at timestamptz;

alter table public.categories
  add column if not exists updated_at timestamptz;

do $$
begin
  begin
    alter table public.categories
      alter column name set not null;
  exception
    when others then null;
  end;

  begin
    alter table public.categories
      alter column created_at set default now();
  exception
    when others then null;
  end;

  begin
    alter table public.categories
      alter column updated_at set default now();
  exception
    when others then null;
  end;
end $$;

alter table public.financial_transactions
  add column if not exists category_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'financial_transactions'
      and c.contype = 'f'
      and pg_get_constraintdef(c.oid) ilike '%FOREIGN KEY (category_id)%REFERENCES public.categories%'
  ) then
    alter table public.financial_transactions
      add constraint fk_category
      foreign key (category_id)
      references public.categories(id)
      on delete set null;
  end if;
end $$;

create index if not exists idx_categories_user_id on public.categories(user_id);
create index if not exists idx_categories_type on public.categories(type);
create index if not exists idx_financial_transactions_category_id on public.financial_transactions(category_id);

alter table public.categories enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'categories' and policyname = 'categories_select_own'
  ) then
    create policy categories_select_own
      on public.categories
      for select
      using (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'categories' and policyname = 'categories_insert_own'
  ) then
    create policy categories_insert_own
      on public.categories
      for insert
      with check (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'categories' and policyname = 'categories_update_own'
  ) then
    create policy categories_update_own
      on public.categories
      for update
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'categories' and policyname = 'categories_delete_own'
  ) then
    create policy categories_delete_own
      on public.categories
      for delete
      using (user_id = auth.uid());
  end if;
end $$;

