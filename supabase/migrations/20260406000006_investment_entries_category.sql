alter table public.investment_entries
  add column if not exists category text;

update public.investment_entries
  set category = 'Outros'
  where category is null;

alter table public.investment_entries
  alter column category set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'investment_entries_category_valid'
      and conrelid = 'public.investment_entries'::regclass
  ) then
    alter table public.investment_entries
      add constraint investment_entries_category_valid
      check (category in ('Ações', 'Cripto', 'Renda fixa', 'Fundos', 'Outros'));
  end if;
end $$;

