create table if not exists public.search_runs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  niche lead_niche not null,
  subcategory text not null,
  city text not null,
  max_results integer not null check (max_results between 1 and 60),
  apify_run_id text,
  apify_dataset_id text,
  status text not null default 'running' check (status in ('running','imported','failed')),
  found integer not null default 0,
  inserted integer not null default 0,
  duplicates integer not null default 0,
  error text
);

create index if not exists search_runs_owner_created_idx on public.search_runs(owner_id, created_at desc);

alter table public.search_runs enable row level security;

drop policy if exists search_runs_owner_all on public.search_runs;

create policy search_runs_owner_all on public.search_runs
  for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

grant select, insert, update, delete on public.search_runs to authenticated;