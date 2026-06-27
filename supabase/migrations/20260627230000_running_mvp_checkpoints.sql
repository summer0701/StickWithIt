create extension if not exists pgcrypto;

alter table public.runs
  add column if not exists total_distance_meters numeric,
  add column if not exists total_elapsed_seconds integer,
  add column if not exists status text default 'completed';

alter table public.runs
  alter column target_distance_km drop not null,
  alter column actual_distance_km drop not null,
  alter column duration_seconds drop not null,
  alter column ended_at drop not null;

alter table public.runs
  add constraint runs_status_check check (status in ('running', 'completed', 'cancelled')) not valid;

create table if not exists public.run_checkpoints (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.runs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  elapsed_seconds int not null check (elapsed_seconds >= 0),
  distance_meters numeric not null check (distance_meters >= 0),
  pace_seconds_per_km int,
  speed_kmh numeric,
  latitude numeric,
  longitude numeric,
  created_at timestamptz default now()
);

create index if not exists run_checkpoints_run_created_at_idx on public.run_checkpoints (run_id, created_at);
create index if not exists run_checkpoints_user_created_at_idx on public.run_checkpoints (user_id, created_at desc);

alter table public.run_checkpoints enable row level security;

drop policy if exists "runs update own" on public.runs;
create policy "runs update own"
on public.runs for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "run_checkpoints select own" on public.run_checkpoints;
create policy "run_checkpoints select own"
on public.run_checkpoints for select
using (auth.uid() = user_id);

drop policy if exists "run_checkpoints insert own" on public.run_checkpoints;
create policy "run_checkpoints insert own"
on public.run_checkpoints for insert
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.runs
    where runs.id = run_checkpoints.run_id
      and runs.user_id = auth.uid()
  )
);

grant select, insert, update on public.runs to authenticated;
grant select, insert on public.run_checkpoints to authenticated;
