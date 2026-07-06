with ranked_profiles as (
  select
    id,
    row_number() over (
      partition by lower(btrim(nickname))
      order by created_at nulls last, id
    ) as duplicate_rank
  from public.profiles
  where btrim(coalesce(nickname, '')) <> ''
)
update public.profiles
set nickname = left(btrim(public.profiles.nickname), 40) || '_' || left(replace(public.profiles.id::text, '-', ''), 6)
from ranked_profiles
where public.profiles.id = ranked_profiles.id
  and ranked_profiles.duplicate_rank > 1;

create unique index if not exists profiles_nickname_unique_idx
  on public.profiles (lower(btrim(nickname)))
  where btrim(coalesce(nickname, '')) <> '';

create or replace function public.is_nickname_available(requested_nickname text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select btrim(coalesce(requested_nickname, '')) <> ''
    and not exists (
      select 1
      from public.profiles
      where lower(btrim(nickname)) = lower(btrim(requested_nickname))
    );
$$;

revoke all on function public.is_nickname_available(text) from public;
grant execute on function public.is_nickname_available(text) to anon, authenticated;
