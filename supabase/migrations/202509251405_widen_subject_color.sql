-- Allow longer Tailwind color class values for subjects.color
begin;

alter table public.subjects
  alter column color type text;

commit;

