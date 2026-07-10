-- RealEstate CRM: objects (properties / construction sites) catalog
-- Everything lives in its own "crm" schema so it never collides with
-- other apps (e.g. ZAKI ERP) sharing this same Supabase project.

create schema if not exists crm;

create type crm.object_type as enum (
  'apartment',
  'house',
  'commercial',
  'land',
  'construction_site'
);

create type crm.object_status as enum (
  'available',
  'reserved',
  'sold',
  'rented',
  'in_progress'
);

create table if not exists crm.objects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  type crm.object_type not null default 'apartment',
  status crm.object_status not null default 'available',
  area numeric,
  price numeric,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists objects_type_idx on crm.objects (type);
create index if not exists objects_status_idx on crm.objects (status);

alter table crm.objects enable row level security;

-- Permissive policy for initial development; tighten once auth/roles are added.
create policy "Allow all access to objects" on crm.objects
  for all using (true) with check (true);

create or replace function crm.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger objects_set_updated_at
  before update on crm.objects
  for each row execute function crm.set_updated_at();

-- PostgREST needs the anon/authenticated roles granted on this schema,
-- and "crm" added to Project Settings -> API -> Exposed schemas.
grant usage on schema crm to anon, authenticated;
grant all on all tables in schema crm to anon, authenticated;
grant all on all sequences in schema crm to anon, authenticated;
alter default privileges in schema crm grant all on tables to anon, authenticated;
alter default privileges in schema crm grant all on sequences to anon, authenticated;
