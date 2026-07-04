alter table public.profiles
  add column if not exists neighborhood_name text,
  add column if not exists neighborhood_code text,
  add column if not exists neighborhood_verified_at timestamptz;

create index if not exists profiles_neighborhood_code_idx
  on public.profiles (neighborhood_code)
  where neighborhood_code is not null;
