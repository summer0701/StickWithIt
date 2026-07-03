create table if not exists public.exercise_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_type text not null check (exercise_type in ('running', 'squat', 'lunge', 'pushup', 'extra')),
  raw_value numeric not null default 0,
  duration_seconds integer,
  accuracy_score numeric,
  performance_rating integer not null check (performance_rating between 0 and 1000),
  created_at timestamptz not null default now()
);

create table if not exists public.user_endure_ratings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  running_score integer not null default 0 check (running_score between 0 and 1000),
  squat_score integer not null default 0 check (squat_score between 0 and 1000),
  lunge_score integer not null default 0 check (lunge_score between 0 and 1000),
  pushup_score integer not null default 0 check (pushup_score between 0 and 1000),
  extra_score integer not null default 0 check (extra_score between 0 and 1000),
  base_er integer not null default 0,
  bonus_er integer not null default 0,
  total_er integer not null default 0,
  level text not null check (level in ('Rookie', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond')),
  updated_at timestamptz not null default now()
);

create table if not exists public.ranking_seasons (
  id uuid primary key default gen_random_uuid(),
  season_name text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'active' check (status in ('scheduled', 'active', 'closed')),
  created_at timestamptz not null default now()
);

create table if not exists public.ranking_leagues (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.ranking_seasons(id) on delete cascade,
  level text not null check (level in ('Rookie', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond')),
  league_name text not null,
  max_members integer not null default 50,
  created_at timestamptz not null default now(),
  unique (season_id, level, league_name)
);

create table if not exists public.ghost_profiles (
  id uuid primary key default gen_random_uuid(),
  ghost_name text not null,
  ghost_type text not null check (ghost_type in ('Balanced Ghost', 'Runner Ghost', 'Strength Ghost', 'Endurance Ghost', 'Lazy Genius Ghost', 'Rookie Ghost')),
  level text not null check (level in ('Rookie', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond')),
  running_score integer not null check (running_score between 0 and 1000),
  squat_score integer not null check (squat_score between 0 and 1000),
  lunge_score integer not null check (lunge_score between 0 and 1000),
  pushup_score integer not null check (pushup_score between 0 and 1000),
  extra_score integer not null check (extra_score between 0 and 1000),
  total_er integer not null,
  avatar_type text not null default 'ghost',
  created_at timestamptz not null default now()
);

create table if not exists public.ranking_entries (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.ranking_leagues(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  ghost_id uuid references public.ghost_profiles(id) on delete cascade,
  entry_type text not null check (entry_type in ('user', 'ghost')),
  display_name text not null,
  total_er integer not null,
  rank integer not null,
  previous_rank integer,
  movement text not null default 'new' check (movement in ('up', 'down', 'same', 'new')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (entry_type = 'user' and user_id is not null and ghost_id is null)
    or
    (entry_type = 'ghost' and ghost_id is not null and user_id is null)
  )
);

create table if not exists public.user_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  season_id uuid references public.ranking_seasons(id) on delete set null,
  badge_name text not null check (badge_name in ('Champion Badge', 'Elite Badge', 'Promotion Badge', 'Balanced Endurer Badge')),
  awarded_at timestamptz not null default now()
);

create index if not exists exercise_scores_user_type_created_idx
  on public.exercise_scores (user_id, exercise_type, created_at desc);

create index if not exists user_endure_ratings_level_total_idx
  on public.user_endure_ratings (level, total_er desc);

create index if not exists ranking_entries_league_rank_idx
  on public.ranking_entries (league_id, rank);

create index if not exists ghost_profiles_level_total_idx
  on public.ghost_profiles (level, total_er desc);

alter table public.exercise_scores enable row level security;
alter table public.user_endure_ratings enable row level security;
alter table public.ranking_seasons enable row level security;
alter table public.ranking_leagues enable row level security;
alter table public.ranking_entries enable row level security;
alter table public.ghost_profiles enable row level security;
alter table public.user_badges enable row level security;

create policy "Users can read exercise scores"
  on public.exercise_scores for select
  to authenticated
  using (true);

create policy "Users can manage own exercise scores"
  on public.exercise_scores for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can read endure ratings"
  on public.user_endure_ratings for select
  to authenticated
  using (true);

create policy "Users can upsert own endure rating"
  on public.user_endure_ratings for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can read ranking seasons"
  on public.ranking_seasons for select
  to authenticated
  using (true);

create policy "Users can read ranking leagues"
  on public.ranking_leagues for select
  to authenticated
  using (true);

create policy "Users can read ranking entries"
  on public.ranking_entries for select
  to authenticated
  using (true);

create policy "Users can read ghost profiles"
  on public.ghost_profiles for select
  to authenticated
  using (true);

create policy "Users can read own badges"
  on public.user_badges for select
  to authenticated
  using (auth.uid() = user_id);
