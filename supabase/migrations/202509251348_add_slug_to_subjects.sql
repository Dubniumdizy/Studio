-- Add slug column to public.subjects, backfill unique values, enforce constraints, and reload PostgREST schema cache

begin;

-- 1) Add the slug column if it doesn't exist
alter table public.subjects
  add column if not exists slug text;

-- 2) Backfill slug for existing rows where slug is null/empty
--    Build a lowercase, dash-separated slug from name and ensure uniqueness per user
with base as (
  select
    id,
    user_id,
    regexp_replace(lower(trim(name)), '[^a-z0-9]+', '-', 'g') as slug_base
  from public.subjects
), ranked as (
  select
    b.id,
    b.user_id,
    b.slug_base,
    row_number() over (partition by b.user_id, b.slug_base order by b.id) as rn
  from base b
), prepared as (
  select
    r.id,
    case when r.rn = 1 then r.slug_base else r.slug_base || '-' || r.rn end as new_slug
  from ranked r
)
update public.subjects p
set slug = q.new_slug
from prepared q
where p.id = q.id
  and (p.slug is null or p.slug = '');

-- 3) Enforce NOT NULL on slug
alter table public.subjects
  alter column slug set not null;

-- 4) Enforce unique slug per user
create unique index if not exists subjects_user_slug_unique
  on public.subjects (user_id, slug);

-- 5) Ask PostgREST (Supabase API) to reload its schema cache
--    This makes the new column immediately available to the REST API
notify pgrst, 'reload schema';

commit;

