create extension if not exists pgcrypto;
create extension if not exists citext;

create table if not exists public.password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email citext not null,
  code_hash text not null,
  expires_at timestamptz not null,
  used boolean not null default false,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  verified_at timestamptz,
  reset_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists password_reset_tokens_email_created_idx
  on public.password_reset_tokens (email, created_at desc);

create index if not exists password_reset_tokens_active_idx
  on public.password_reset_tokens (email, expires_at desc)
  where reset_at is null;

alter table public.password_reset_tokens enable row level security;

revoke all on table public.password_reset_tokens from anon, authenticated;

create or replace function public.find_auth_user_id_by_email(email_to_find text)
returns uuid
language sql
security definer
set search_path = auth, public
stable
as $$
  select id
  from auth.users
  where lower(email) = lower(trim(email_to_find))
  limit 1
$$;

revoke all on function public.find_auth_user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.find_auth_user_id_by_email(text) to service_role;
