create table if not exists public.brand_acos_goals (
  brand_key text not null,
  channel_key text not null,
  target_acos numeric not null,
  updated_at timestamptz not null default now(),
  constraint brand_acos_goals_pk primary key (brand_key, channel_key)
);

create index if not exists brand_acos_goals_updated_idx
  on public.brand_acos_goals (updated_at desc);

alter table public.brand_acos_goals enable row level security;

grant select, insert, update on table public.brand_acos_goals to anon, authenticated;

drop policy if exists brand_acos_goals_select_all on public.brand_acos_goals;
create policy brand_acos_goals_select_all
  on public.brand_acos_goals
  for select
  to anon, authenticated
  using (true);

drop policy if exists brand_acos_goals_insert_all on public.brand_acos_goals;
create policy brand_acos_goals_insert_all
  on public.brand_acos_goals
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists brand_acos_goals_update_all on public.brand_acos_goals;
create policy brand_acos_goals_update_all
  on public.brand_acos_goals
  for update
  to anon, authenticated
  using (true)
  with check (true);
