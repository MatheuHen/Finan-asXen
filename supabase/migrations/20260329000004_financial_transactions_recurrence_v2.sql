alter table public.financial_transactions
  add column if not exists recurrence_interval integer;

alter table public.financial_transactions
  add column if not exists recurrence_unit text;

alter table public.financial_transactions
  drop constraint if exists financial_transactions_recurrence_type_check;

alter table public.financial_transactions
  add constraint financial_transactions_recurrence_type_check
  check (
    recurrence_type in ('daily', 'weekly', 'monthly', 'yearly', 'custom')
    or recurrence_type is null
  );

alter table public.financial_transactions
  drop constraint if exists financial_transactions_recurrence_unit_check;

alter table public.financial_transactions
  add constraint financial_transactions_recurrence_unit_check
  check (
    recurrence_unit in ('day', 'week', 'month', 'year')
    or recurrence_unit is null
  );

alter table public.financial_transactions
  drop constraint if exists financial_transactions_recurrence_custom_check;

alter table public.financial_transactions
  add constraint financial_transactions_recurrence_custom_check
  check (
    (recurrence_type = 'custom' and recurrence_interval is not null and recurrence_interval >= 1 and recurrence_unit is not null)
    or (recurrence_type <> 'custom' and recurrence_interval is null and recurrence_unit is null)
    or (recurrence_type is null and recurrence_interval is null and recurrence_unit is null)
  );

