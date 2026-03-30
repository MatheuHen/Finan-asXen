do $$
begin
  if to_regtype('public.recurrence_type') is not null then
    execute 'alter type public.recurrence_type add value if not exists ''daily''';
    execute 'alter type public.recurrence_type add value if not exists ''weekly''';
    execute 'alter type public.recurrence_type add value if not exists ''monthly''';
    execute 'alter type public.recurrence_type add value if not exists ''yearly''';
    execute 'alter type public.recurrence_type add value if not exists ''custom''';
  end if;
exception
  when others then
    raise notice 'Aviso: não foi possível ajustar enum recurrence_type (%).', sqlerrm;
end $$;

alter table public.financial_transactions
  add column if not exists recurrence_interval integer;

alter table public.financial_transactions
  add column if not exists recurrence_unit text;

alter table public.financial_transactions
  drop constraint if exists financial_transactions_recurrence_interval_check;

alter table public.financial_transactions
  add constraint financial_transactions_recurrence_interval_check
  check (recurrence_interval is null or recurrence_interval >= 1);

alter table public.financial_transactions
  drop constraint if exists financial_transactions_recurrence_unit_check;

alter table public.financial_transactions
  add constraint financial_transactions_recurrence_unit_check
  check (
    recurrence_unit in ('day', 'week', 'month', 'year')
    or recurrence_unit is null
  );

