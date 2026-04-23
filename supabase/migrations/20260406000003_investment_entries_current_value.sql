alter table public.investment_entries
  add column if not exists current_value numeric(15, 2);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'investment_entries_current_value_positive'
      and conrelid = 'public.investment_entries'::regclass
  ) then
    alter table public.investment_entries
      add constraint investment_entries_current_value_positive
      check (current_value is null or current_value > 0);
  end if;
end $$;

