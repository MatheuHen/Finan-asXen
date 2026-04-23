create unique index if not exists idx_categories_user_id_name_ci
  on public.categories (user_id, lower(btrim(name)));

