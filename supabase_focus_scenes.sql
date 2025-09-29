-- Studyverse Garden: Focus scenes + layered sounds schema
-- Run this in Supabase SQL editor or include in your migrations

-- 1) Assets catalog (videos and audio loops)
create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  kind text check (kind in ('video','audio')) not null,
  title text not null,
  url text not null,
  thumbnail_url text,
  loop_start_ms int default 0,
  loop_end_ms int,
  tags text[] default '{}',
  created_at timestamptz default now()
);

-- 2) User's current scene (selected background video)
create table if not exists public.user_scenes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  video_asset_id uuid not null references public.assets(id),
  started_at timestamptz default now()
);

-- 3) Layered sounds attached to a user scene
create table if not exists public.user_scene_sounds (
  id uuid primary key default gen_random_uuid(),
  user_scene_id uuid not null references public.user_scenes(id) on delete cascade,
  audio_asset_id uuid not null references public.assets(id),
  volume float8 not null default 0.5 check (volume between 0 and 1),
  is_enabled boolean not null default true,
  sort_order int not null default 0
);

-- 4) Optional presets users can save and recall
create table if not exists public.presets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  video_asset_id uuid not null references public.assets(id),
  created_at timestamptz default now()
);

create table if not exists public.preset_sounds (
  id uuid primary key default gen_random_uuid(),
  preset_id uuid not null references public.presets(id) on delete cascade,
  audio_asset_id uuid not null references public.assets(id),
  volume float8 not null default 0.5 check (volume between 0 and 1),
  is_enabled boolean not null default true,
  sort_order int not null default 0
);

-- Row Level Security
alter table public.user_scenes enable row level security;
alter table public.user_scene_sounds enable row level security;
alter table public.presets enable row level security;
alter table public.preset_sounds enable row level security;

-- Policies
create policy if not exists "user owns their scenes" on public.user_scenes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy if not exists "user owns their sounds" on public.user_scene_sounds
  for all using (
    exists (
      select 1 from public.user_scenes us
      where us.id = user_scene_id and us.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.user_scenes us
      where us.id = user_scene_id and us.user_id = auth.uid()
    )
  );

create policy if not exists "user owns their presets" on public.presets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy if not exists "user owns their preset sounds" on public.preset_sounds
  for all using (
    exists (
      select 1 from public.presets p
      where p.id = preset_id and p.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.presets p
      where p.id = preset_id and p.user_id = auth.uid()
    )
  );

