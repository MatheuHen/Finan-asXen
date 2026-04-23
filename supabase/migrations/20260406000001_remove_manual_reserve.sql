do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'profiles_manual_reserve_positive'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles drop constraint profiles_manual_reserve_positive;
  end if;
exception
  when undefined_table then null;
end $$;

alter table public.profiles drop column if exists manual_reserve;

