-- RealEstate CRM: app settings, building/unit media, flexible pricing,
-- and contract payment schedule (installments / barter / SMS reminders)

-- ===== Settings (singleton row) =====

create table if not exists crm.settings (
  id boolean primary key default true,
  usd_rate numeric not null default 10.5,
  sms_api_key text,
  sms_sender_name text default 'BurjiBohtar',
  sms_reminder_days integer not null default 3,
  updated_at timestamptz not null default now(),
  constraint settings_singleton check (id)
);

insert into crm.settings (id) values (true) on conflict (id) do nothing;

alter table crm.settings enable row level security;
create policy "Allow all access to settings" on crm.settings
  for all using (true) with check (true);

create trigger settings_set_updated_at
  before update on crm.settings
  for each row execute function crm.set_updated_at();

-- ===== Building/unit media + flexible pricing =====

alter table crm.buildings add column if not exists price_per_sqm numeric;
alter table crm.buildings add column if not exists facade_url text;
alter table crm.buildings add column if not exists plan_url text;

alter table crm.objects add column if not exists plan_url text;

-- Storage bucket for facade photos / building plans / unit plans
insert into storage.buckets (id, name, public)
values ('crm-media', 'crm-media', true)
on conflict (id) do nothing;

create policy "Public read crm-media" on storage.objects
  for select using (bucket_id = 'crm-media');
create policy "Public upload crm-media" on storage.objects
  for insert with check (bucket_id = 'crm-media');
create policy "Public update crm-media" on storage.objects
  for update using (bucket_id = 'crm-media');
create policy "Public delete crm-media" on storage.objects
  for delete using (bucket_id = 'crm-media');

-- ===== Contract payment type + installment schedule =====

create type crm.payment_type as enum ('full', 'installment', 'barter');

alter table crm.contracts add column if not exists payment_type crm.payment_type not null default 'full';
alter table crm.contracts add column if not exists installment_months integer;
alter table crm.contracts add column if not exists barter_details text;

create table if not exists crm.contract_payments (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references crm.contracts(id) on delete cascade,
  due_date date not null,
  amount numeric not null,
  paid boolean not null default false,
  paid_date date,
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists contract_payments_contract_idx on crm.contract_payments (contract_id);
create index if not exists contract_payments_due_date_idx on crm.contract_payments (due_date);

alter table crm.contract_payments enable row level security;
create policy "Allow all access to contract_payments" on crm.contract_payments
  for all using (true) with check (true);

-- ===== Grants (redundant safety net alongside default privileges from schema.sql) =====

grant usage on schema crm to anon, authenticated;
grant all on all tables in schema crm to anon, authenticated;
grant all on all sequences in schema crm to anon, authenticated;
