alter table public.profiles
  add column if not exists district_name text,
  add column if not exists district_code text,
  add column if not exists neighborhood_lat double precision,
  add column if not exists neighborhood_lng double precision;

alter table public.neighborhood_contributions
  add column if not exists district_name text,
  add column if not exists neighborhood_lat double precision,
  add column if not exists neighborhood_lng double precision;

update public.profiles
set
  neighborhood_name = null,
  neighborhood_code = null,
  district_name = null,
  district_code = null,
  region_name = null,
  region_code = null,
  neighborhood_lat = null,
  neighborhood_lng = null,
  neighborhood_verified_at = null
where neighborhood_name in ('현재 위치 동네', '내 동네', '인증된 동네', '동네 미인증')
   or neighborhood_code in ('GPS-VERIFIED-DISTRICT', 'GPS-VERIFIED-REGION');

delete from public.neighborhood_contributions
where neighborhood_name in ('현재 위치 동네', '내 동네', '인증된 동네', '동네 미인증')
   or neighborhood_code in ('GPS-VERIFIED-DISTRICT', 'GPS-VERIFIED-REGION')
   or neighborhood_name is null
   or btrim(neighborhood_name) = '';

update public.profiles
set
  district_name = coalesce(district_name, neighborhood_name),
  district_code = coalesce(district_code, neighborhood_code)
where neighborhood_name is not null
  and neighborhood_code is not null;

update public.neighborhood_contributions
set district_name = coalesce(district_name, neighborhood_name)
where neighborhood_name is not null;

create index if not exists profiles_real_neighborhood_idx
  on public.profiles (neighborhood_code)
  where neighborhood_name is not null
    and neighborhood_name not in ('현재 위치 동네', '내 동네', '인증된 동네', '동네 미인증');

create index if not exists neighborhood_contributions_real_rank_idx
  on public.neighborhood_contributions (contributed_on, neighborhood_code, points desc)
  where neighborhood_name is not null
    and neighborhood_name not in ('현재 위치 동네', '내 동네', '인증된 동네', '동네 미인증');

drop view if exists public.neighborhood_rankings_daily;
drop view if exists public.neighborhood_rankings_weekly;
drop view if exists public.neighborhood_rankings_monthly;

create or replace view public.neighborhood_rankings_daily as
select
  contributed_on,
  neighborhood_code,
  min(neighborhood_name) as neighborhood_name,
  min(district_name) as district_name,
  min(region_name) as region_name,
  sum(points)::integer as total_points,
  rank() over (
    partition by contributed_on
    order by sum(points) desc, min(neighborhood_name) asc
  )::integer as rank
from public.neighborhood_contributions
where neighborhood_name is not null
  and btrim(neighborhood_name) <> ''
  and neighborhood_name not in ('현재 위치 동네', '내 동네', '인증된 동네', '동네 미인증')
group by contributed_on, neighborhood_code;

create or replace view public.neighborhood_rankings_weekly as
select
  date_trunc('week', contributed_on)::date as period_start,
  neighborhood_code,
  min(neighborhood_name) as neighborhood_name,
  min(district_name) as district_name,
  min(region_name) as region_name,
  sum(points)::integer as total_points,
  rank() over (
    partition by date_trunc('week', contributed_on)::date
    order by sum(points) desc, min(neighborhood_name) asc
  )::integer as rank
from public.neighborhood_contributions
where neighborhood_name is not null
  and btrim(neighborhood_name) <> ''
  and neighborhood_name not in ('현재 위치 동네', '내 동네', '인증된 동네', '동네 미인증')
group by date_trunc('week', contributed_on)::date, neighborhood_code;

create or replace view public.neighborhood_rankings_monthly as
select
  date_trunc('month', contributed_on)::date as period_start,
  neighborhood_code,
  min(neighborhood_name) as neighborhood_name,
  min(district_name) as district_name,
  min(region_name) as region_name,
  sum(points)::integer as total_points,
  rank() over (
    partition by date_trunc('month', contributed_on)::date
    order by sum(points) desc, min(neighborhood_name) asc
  )::integer as rank
from public.neighborhood_contributions
where neighborhood_name is not null
  and btrim(neighborhood_name) <> ''
  and neighborhood_name not in ('현재 위치 동네', '내 동네', '인증된 동네', '동네 미인증')
group by date_trunc('month', contributed_on)::date, neighborhood_code;

grant select on public.neighborhood_rankings_daily to authenticated;
grant select on public.neighborhood_rankings_weekly to authenticated;
grant select on public.neighborhood_rankings_monthly to authenticated;
