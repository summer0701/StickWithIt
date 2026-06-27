create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text,
  created_at timestamptz default now()
);

create table if not exists public.runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  target_distance_km numeric not null check (target_distance_km > 0),
  actual_distance_km numeric not null check (actual_distance_km >= 0),
  duration_seconds integer not null check (duration_seconds > 0),
  avg_pace_seconds_per_km integer,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  created_at timestamptz default now()
);

create table if not exists public.run_splits (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.runs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  distance_km numeric not null check (distance_km >= 0),
  elapsed_seconds integer not null check (elapsed_seconds >= 0),
  pace_seconds_per_km integer,
  created_at timestamptz default now()
);

create index if not exists runs_user_started_at_idx on public.runs (user_id, started_at desc);
create index if not exists runs_target_started_at_idx on public.runs (target_distance_km, started_at desc);
create index if not exists run_splits_run_distance_idx on public.run_splits (run_id, distance_km);

alter table public.profiles enable row level security;
alter table public.runs enable row level security;
alter table public.run_splits enable row level security;

drop policy if exists "profiles select own" on public.profiles;
create policy "profiles select own"
on public.profiles for select
using (auth.uid() = id);

drop policy if exists "profiles insert own" on public.profiles;
create policy "profiles insert own"
on public.profiles for insert
with check (auth.uid() = id);

drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "runs select own" on public.runs;
create policy "runs select own"
on public.runs for select
using (auth.uid() = user_id);

drop policy if exists "runs insert own" on public.runs;
create policy "runs insert own"
on public.runs for insert
with check (auth.uid() = user_id);

drop policy if exists "run_splits select own" on public.run_splits;
create policy "run_splits select own"
on public.run_splits for select
using (auth.uid() = user_id);

drop policy if exists "run_splits insert own" on public.run_splits;
create policy "run_splits insert own"
on public.run_splits for insert
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.runs
    where runs.id = run_splits.run_id
      and runs.user_id = auth.uid()
  )
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nickname)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nickname', split_part(new.email, '@', 1), '러너')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace view public.daily_distance_rankings_view as
select
  current_date as ranking_date,
  coalesce(p.nickname, '러너') as nickname,
  round(sum(r.actual_distance_km)::numeric, 3) as total_distance_km
from public.runs r
join public.profiles p on p.id = r.user_id
where r.started_at >= current_date
  and r.started_at < current_date + interval '1 day'
group by p.nickname
order by total_distance_km desc
limit 100;

create or replace view public.daily_pace_rankings_view as
with best_per_runner as (
  select distinct on (r.target_distance_km, r.user_id)
    r.user_id,
    r.target_distance_km,
    r.duration_seconds,
    r.avg_pace_seconds_per_km
  from public.runs r
  where r.started_at >= current_date
    and r.started_at < current_date + interval '1 day'
  order by r.target_distance_km, r.user_id, r.duration_seconds asc
)
select
  current_date as ranking_date,
  coalesce(p.nickname, '러너') as nickname,
  b.target_distance_km,
  b.duration_seconds as best_time_seconds,
  b.avg_pace_seconds_per_km as best_pace_seconds_per_km
from best_per_runner b
join public.profiles p on p.id = b.user_id
order by b.target_distance_km, b.duration_seconds asc
limit 100;

create or replace view public.daily_growth_rankings_view as
with today as (
  select
    r.*,
    row_number() over (partition by r.user_id, r.target_distance_km order by r.duration_seconds asc) as target_rank
  from public.runs r
  where r.started_at >= current_date
    and r.started_at < current_date + interval '1 day'
),
yesterday as (
  select
    r.*,
    row_number() over (partition by r.user_id, r.target_distance_km order by r.duration_seconds asc) as target_rank
  from public.runs r
  where r.started_at >= current_date - interval '1 day'
    and r.started_at < current_date
),
previous_best as (
  select
    user_id,
    target_distance_km,
    min(duration_seconds) as best_duration_seconds
  from public.runs
  where started_at < current_date
  group by user_id, target_distance_km
)
select
  current_date as ranking_date,
  coalesce(p.nickname, '러너') as nickname,
  greatest(coalesce(y.duration_seconds - t.duration_seconds, 0), 0) as yesterday_improvement_seconds,
  greatest(coalesce(t.actual_distance_km - y.actual_distance_km, 0), 0) as distance_growth_km,
  greatest(coalesce(pb.best_duration_seconds - t.duration_seconds, 0), 0) as personal_best_improvement_seconds
from today t
join public.profiles p on p.id = t.user_id
left join yesterday y
  on y.user_id = t.user_id
 and y.target_distance_km = t.target_distance_km
 and y.target_rank = 1
left join previous_best pb
  on pb.user_id = t.user_id
 and pb.target_distance_km = t.target_distance_km
where t.target_rank = 1
order by
  yesterday_improvement_seconds desc,
  distance_growth_km desc,
  personal_best_improvement_seconds desc
limit 100;

grant usage on schema public to anon, authenticated;
grant select on public.daily_distance_rankings_view to anon, authenticated;
grant select on public.daily_pace_rankings_view to anon, authenticated;
grant select on public.daily_growth_rankings_view to anon, authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert on public.runs to authenticated;
grant select, insert on public.run_splits to authenticated;
