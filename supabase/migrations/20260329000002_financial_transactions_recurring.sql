alter table public.financial_transactions
  add column if not exists is_recurring boolean not null default false;

alter table public.financial_transactions
  add column if not exists recurrence_type text;

alter table public.financial_transactions
  add column if not exists recurrence_source_id uuid references public.financial_transactions(id) on delete set null;

alter table public.financial_transactions
  drop constraint if exists financial_transactions_recurrence_type_check;

alter table public.financial_transactions
  add constraint financial_transactions_recurrence_type_check
  check (recurrence_type in ('monthly') or recurrence_type is null);

create index if not exists idx_financial_transactions_recurrence_source_id
  on public.financial_transactions(recurrence_source_id);

create unique index if not exists uq_financial_transactions_recurring_occurrence
  on public.financial_transactions(user_id, recurrence_source_id, due_date)
  where recurrence_source_id is not null;

