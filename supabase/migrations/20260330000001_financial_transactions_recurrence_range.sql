alter table public.financial_transactions
  add column if not exists recurrence_start_date date;

alter table public.financial_transactions
  add column if not exists recurrence_end_date date;

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'financial_transactions'
      and c.conname = 'financial_transactions_recurrence_range_check'
  ) then
    alter table public.financial_transactions
      add constraint financial_transactions_recurrence_range_check
      check (
        (recurrence_start_date is null and recurrence_end_date is null)
        or (
          recurrence_start_date is not null
          and recurrence_end_date is not null
          and recurrence_start_date <= recurrence_end_date
        )
      );
  end if;
end $$;

