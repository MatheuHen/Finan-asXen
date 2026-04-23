do $$
begin
  if exists (select 1 from pg_type where typname = 'goal_status') then
    begin
      alter type public.goal_status add value if not exists 'late';
    exception
      when duplicate_object then null;
    end;
  end if;
end $$;

alter table public.goals
  add column if not exists type text;

update public.goals
  set type = 'economy'
  where type is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'goals'
      and c.conname = 'goals_type_check'
  ) then
    alter table public.goals
      add constraint goals_type_check
      check (type in ('economy','spending_limit','debt'));
  end if;
end $$;

alter table public.goals
  alter column type set not null;

alter table public.goals
  add column if not exists start_date date;

alter table public.goals
  add column if not exists end_date date;

update public.goals
  set end_date = deadline
  where end_date is null and deadline is not null;

