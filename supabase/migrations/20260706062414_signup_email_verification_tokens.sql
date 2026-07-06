create table if not exists public.signup_email_verification_tokens (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  used boolean not null default false,
  attempt_count integer not null default 0,
  verified_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists signup_email_verification_tokens_email_created_idx
  on public.signup_email_verification_tokens (email, created_at desc);

alter table public.signup_email_verification_tokens enable row level security;

revoke all on table public.signup_email_verification_tokens from anon, authenticated;
grant select, insert, update on table public.signup_email_verification_tokens to service_role;
