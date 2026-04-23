do $$
declare
  r record;
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'investment_entries'
      and column_name = 'investment_id'
  ) then
    for r in
      select distinct pc.conname
      from pg_constraint pc
      join pg_class t on t.oid = pc.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      join pg_attribute a on a.attrelid = t.oid and a.attnum = any (pc.conkey)
      where n.nspname = 'public'
        and t.relname = 'investment_entries'
        and a.attname = 'investment_id'
    loop
      execute format('alter table public.investment_entries drop constraint if exists %I', r.conname);
    end loop;

    alter table public.investment_entries drop column if exists investment_id;
  end if;
end $$;
