create table if not exists public.neighborhood_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  neighborhood_code text not null,
  neighborhood_name text not null,
  points integer not null check (points > 0),
  source_type text not null,
  source_record_id text not null,
  contributed_on date not null default current_date,
  created_at timestamptz not null default now(),
  unique (user_id, source_record_id)
);

create index if not exists neighborhood_contributions_rank_idx
  on public.neighborhood_contributions (contributed_on, neighborhood_code, points desc);

create index if not exists neighborhood_contributions_user_idx
  on public.neighborhood_contributions (user_id, contributed_on desc);

alter table public.neighborhood_contributions enable row level security;

drop policy if exists "neighborhood contributions select own" on public.neighborhood_contributions;
create policy "neighborhood contributions select own"
on public.neighborhood_contributions for select
using (auth.uid() = user_id);

drop policy if exists "neighborhood contributions insert own" on public.neighborhood_contributions;
create policy "neighborhood contributions insert own"
on public.neighborhood_contributions for insert
with check (auth.uid() = user_id);

drop policy if exists "neighborhood contributions update own" on public.neighborhood_contributions;
create policy "neighborhood contributions update own"
on public.neighborhood_contributions for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

grant select, insert, update on public.neighborhood_contributions to authenticated;

create or replace view public.neighborhood_rankings_daily as
select
  contributed_on,
  neighborhood_code,
  min(neighborhood_name) as neighborhood_name,
  sum(points)::integer as total_points,
  rank() over (
    partition by contributed_on
    order by sum(points) desc, min(neighborhood_name) asc
  )::integer as rank
from public.neighborhood_contributions
group by contributed_on, neighborhood_code;

create or replace view public.personal_rankings_daily as
select
  c.contributed_on,
  c.user_id,
  coalesce(left(p.nickname, 1) || '**', '나') as masked_name,
  sum(c.points)::integer as total_points,
  rank() over (
    partition by c.contributed_on
    order by sum(c.points) desc, coalesce(p.nickname, '') asc
  )::integer as rank
from public.neighborhood_contributions c
join public.profiles p on p.id = c.user_id
group by c.contributed_on, c.user_id, p.nickname;

grant select on public.neighborhood_rankings_daily to authenticated;
grant select on public.personal_rankings_daily to authenticated;
