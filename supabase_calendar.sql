-- Calendar events table and policies

create table if not exists public.calendar_events (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  description text,
  start timestamptz not null,
  "end" timestamptz not null,
  all_day boolean not null default false,
  tags jsonb not null default '[]'::jsonb,
  energy_level int,
  importance int,
  work_type text,
  checklist jsonb not null default '[]'::jsonb,
  reminders jsonb not null default '[]'::jsonb,
  location text,
  recurrence jsonb,
  original_id text,
  inserted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- trigger to auto-update updated_at
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists t_set_updated_at on public.calendar_events;
create trigger t_set_updated_at
before update on public.calendar_events
for each row execute procedure public.set_updated_at();

-- Enable RLS
alter table public.calendar_events enable row level security;

-- Policies
create policy "Enable read access for users to their events"
  on public.calendar_events
  for select
  using (auth.uid() = user_id);

create policy "Enable insert for users to their events"
  on public.calendar_events
  for insert
  with check (auth.uid() = user_id);

create policy "Enable update for users to their events"
  on public.calendar_events
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Enable delete for users to their events"
  on public.calendar_events
  for delete
  using (auth.uid() = user_id);

