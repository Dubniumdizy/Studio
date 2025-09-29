-- Ensure pgcrypto exists for gen_random_uuid()
create extension if not exists "pgcrypto";

-- Ensure helper function exists
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Create subject_vocab table if missing (concepts/knowledge map)
create table if not exists public.subject_vocab (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_slug text not null,
  concept text not null,
  confidence int not null default 1 check (confidence between 1 and 5),
  importance int not null default 1 check (importance between 1 and 5),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Helpful indexes & uniqueness
create index if not exists idx_subject_vocab_user_subject on public.subject_vocab(user_id, subject_slug);
create unique index if not exists uq_subject_vocab_user_subject_concept on public.subject_vocab(user_id, subject_slug, concept);

-- Trigger to auto-update updated_at (no IF NOT EXISTS in PG, guard via DO)
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_subject_vocab_updated_at') then
    execute 'create trigger trg_subject_vocab_updated_at before update on public.subject_vocab for each row execute function public.update_updated_at_column()';
  end if;
end $$;

-- Enable RLS
alter table public.subject_vocab enable row level security;

-- RLS policies (guarded via DO; PG lacks IF NOT EXISTS on CREATE POLICY)
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'subject_vocab' and policyname = 'vocab_select_own') then
    execute 'create policy "vocab_select_own" on public.subject_vocab for select using (auth.uid() = user_id)';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'subject_vocab' and policyname = 'vocab_insert_own') then
    execute 'create policy "vocab_insert_own" on public.subject_vocab for insert with check (auth.uid() = user_id)';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'subject_vocab' and policyname = 'vocab_update_own') then
    execute 'create policy "vocab_update_own" on public.subject_vocab for update using (auth.uid() = user_id) with check (auth.uid() = user_id)';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'subject_vocab' and policyname = 'vocab_delete_own') then
    execute 'create policy "vocab_delete_own" on public.subject_vocab for delete using (auth.uid() = user_id)';
  end if;
end $$;

-- Create subject_resources table if missing (links to BANK/resources)
create table if not exists public.subject_resources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_slug text not null,
  name text not null,
  bank_item_id text,
  bank_path text,
  bank_type text,
  url text,
  created_at timestamptz not null default now()
);

-- Helpful indexes
create index if not exists idx_subject_resources_user_subject on public.subject_resources(user_id, subject_slug);

-- Enable RLS
alter table public.subject_resources enable row level security;

-- RLS policies for resources (guard via DO)
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'subject_resources' and policyname = 'res_select_own') then
    execute 'create policy "res_select_own" on public.subject_resources for select using (auth.uid() = user_id)';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'subject_resources' and policyname = 'res_insert_own') then
    execute 'create policy "res_insert_own" on public.subject_resources for insert with check (auth.uid() = user_id)';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'subject_resources' and policyname = 'res_update_own') then
    execute 'create policy "res_update_own" on public.subject_resources for update using (auth.uid() = user_id) with check (auth.uid() = user_id)';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'subject_resources' and policyname = 'res_delete_own') then
    execute 'create policy "res_delete_own" on public.subject_resources for delete using (auth.uid() = user_id)';
  end if;
end $$;

-- Reload PostgREST schema cache so these tables/columns are visible immediately
notify pgrst, 'reload schema';

