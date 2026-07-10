-- RealEstate CRM: clients/leads, tasks, contracts, buildings + apartment matrix
-- Run this AFTER schema.sql, in the same "crm" schema.

-- ===== Clients / leads =====

create type crm.lead_status as enum (
  'new',
  'contacted',
  'negotiation',
  'client',
  'lost'
);

create table if not exists crm.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  source text,
  status crm.lead_status not null default 'new',
  interested_object_id uuid references crm.objects(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clients_status_idx on crm.clients (status);

alter table crm.clients enable row level security;
create policy "Allow all access to clients" on crm.clients
  for all using (true) with check (true);

create trigger clients_set_updated_at
  before update on crm.clients
  for each row execute function crm.set_updated_at();

-- ===== Tasks =====

create type crm.task_status as enum (
  'todo',
  'in_progress',
  'done'
);

create table if not exists crm.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  due_date date,
  status crm.task_status not null default 'todo',
  assignee text,
  client_id uuid references crm.clients(id) on delete set null,
  object_id uuid references crm.objects(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_status_idx on crm.tasks (status);

alter table crm.tasks enable row level security;
create policy "Allow all access to tasks" on crm.tasks
  for all using (true) with check (true);

create trigger tasks_set_updated_at
  before update on crm.tasks
  for each row execute function crm.set_updated_at();

-- ===== Contracts =====

create type crm.contract_status as enum (
  'draft',
  'active',
  'completed',
  'cancelled'
);

create table if not exists crm.contracts (
  id uuid primary key default gen_random_uuid(),
  number text,
  client_id uuid not null references crm.clients(id) on delete restrict,
  object_id uuid not null references crm.objects(id) on delete restrict,
  amount numeric not null default 0,
  paid_amount numeric not null default 0,
  status crm.contract_status not null default 'draft',
  signed_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contracts_status_idx on crm.contracts (status);
create index if not exists contracts_client_idx on crm.contracts (client_id);
create index if not exists contracts_object_idx on crm.contracts (object_id);

alter table crm.contracts enable row level security;
create policy "Allow all access to contracts" on crm.contracts
  for all using (true) with check (true);

create trigger contracts_set_updated_at
  before update on crm.contracts
  for each row execute function crm.set_updated_at();

-- ===== Buildings + apartment matrix (shakhmatka) =====

create table if not exists crm.buildings (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  floors_count integer,
  units_per_floor integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table crm.buildings enable row level security;
create policy "Allow all access to buildings" on crm.buildings
  for all using (true) with check (true);

create trigger buildings_set_updated_at
  before update on crm.buildings
  for each row execute function crm.set_updated_at();

alter table crm.objects add column if not exists building_id uuid references crm.buildings(id) on delete set null;
alter table crm.objects add column if not exists floor integer;
alter table crm.objects add column if not exists position_in_floor integer;

create index if not exists objects_building_idx on crm.objects (building_id);

-- ===== Grants (redundant safety net alongside default privileges from schema.sql) =====

grant usage on schema crm to anon, authenticated;
grant all on all tables in schema crm to anon, authenticated;
grant all on all sequences in schema crm to anon, authenticated;
