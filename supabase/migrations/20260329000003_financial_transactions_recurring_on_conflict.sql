drop index if exists public.uq_financial_transactions_recurring_occurrence;

alter table public.financial_transactions
  drop constraint if exists financial_transactions_recurring_occurrence_unique;

alter table public.financial_transactions
  add constraint financial_transactions_recurring_occurrence_unique
  unique (user_id, recurrence_source_id, due_date);

