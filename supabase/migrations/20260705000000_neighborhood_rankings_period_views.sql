alter table public.profiles
  add column if not exists region_name text,
  add column if not exists region_code text;

update public.profiles
set
  region_name = coalesce(region_name, neighborhood_name),
  region_code = coalesce(region_code, neighborhood_code)
where neighborhood_name is not null
  and neighborhood_code is not null
  and (region_name is null or region_code is null);

create index if not exists profiles_region_code_idx
  on public.profiles (region_code)
  where region_code is not null;

alter table public.neighborhood_contributions
  add column if not exists region_name text,
  add column if not exists region_code text;

update public.neighborhood_contributions
set
  region_name = coalesce(region_name, neighborhood_name),
  region_code = coalesce(region_code, neighborhood_code)
where region_name is null or region_code is null;

create index if not exists neighborhood_contributions_region_rank_idx
  on public.neighborhood_contributions (contributed_on, region_code, points desc)
  where region_code is not null;

create or replace view public.neighborhood_rankings_daily as
select
  contributed_on,
  coalesce(region_code, neighborhood_code) as neighborhood_code,
  min(coalesce(region_name, neighborhood_name)) as neighborhood_name,
  sum(points)::integer as total_points,
  rank() over (
    partition by contributed_on
    order by sum(points) desc, min(coalesce(region_name, neighborhood_name)) asc
  )::integer as rank
from public.neighborhood_contributions
group by contributed_on, coalesce(region_code, neighborhood_code);

create or replace view public.neighborhood_rankings_weekly as
select
  date_trunc('week', contributed_on)::date as period_start,
  coalesce(region_code, neighborhood_code) as neighborhood_code,
  min(coalesce(region_name, neighborhood_name)) as neighborhood_name,
  sum(points)::integer as total_points,
  rank() over (
    partition by date_trunc('week', contributed_on)::date
    order by sum(points) desc, min(coalesce(region_name, neighborhood_name)) asc
  )::integer as rank
from public.neighborhood_contributions
group by date_trunc('week', contributed_on)::date, coalesce(region_code, neighborhood_code);

create or replace view public.personal_rankings_weekly as
select
  date_trunc('week', c.contributed_on)::date as period_start,
  c.user_id,
  coalesce(left(p.nickname, 1) || '**', '나') as masked_name,
  sum(c.points)::integer as total_points,
  rank() over (
    partition by date_trunc('week', c.contributed_on)::date
    order by sum(c.points) desc, coalesce(p.nickname, '') asc
  )::integer as rank
from public.neighborhood_contributions c
join public.profiles p on p.id = c.user_id
group by date_trunc('week', c.contributed_on)::date, c.user_id, p.nickname;

create or replace view public.neighborhood_rankings_monthly as
select
  date_trunc('month', contributed_on)::date as period_start,
  coalesce(region_code, neighborhood_code) as neighborhood_code,
  min(coalesce(region_name, neighborhood_name)) as neighborhood_name,
  sum(points)::integer as total_points,
  rank() over (
    partition by date_trunc('month', contributed_on)::date
    order by sum(points) desc, min(coalesce(region_name, neighborhood_name)) asc
  )::integer as rank
from public.neighborhood_contributions
group by date_trunc('month', contributed_on)::date, coalesce(region_code, neighborhood_code);

create or replace view public.personal_rankings_monthly as
select
  date_trunc('month', c.contributed_on)::date as period_start,
  c.user_id,
  coalesce(left(p.nickname, 1) || '**', '나') as masked_name,
  sum(c.points)::integer as total_points,
  rank() over (
    partition by date_trunc('month', c.contributed_on)::date
    order by sum(c.points) desc, coalesce(p.nickname, '') asc
  )::integer as rank
from public.neighborhood_contributions c
join public.profiles p on p.id = c.user_id
group by date_trunc('month', c.contributed_on)::date, c.user_id, p.nickname;

grant select on public.neighborhood_rankings_daily to authenticated;
grant select on public.neighborhood_rankings_weekly to authenticated;
grant select on public.personal_rankings_weekly to authenticated;
grant select on public.neighborhood_rankings_monthly to authenticated;
grant select on public.personal_rankings_monthly to authenticated;
