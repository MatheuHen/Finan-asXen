alter table public.profiles
  add column if not exists hourly_rate numeric(15, 2);

