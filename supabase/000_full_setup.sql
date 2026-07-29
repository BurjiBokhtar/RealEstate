-- ============================================================
-- ПОЛНАЯ УСТАНОВКА БАЗЫ ОДНИМ ФАЙЛОМ.
--
-- 1) Выполнить этот файл в Supabase SQL Editor (Run).
-- 2) СРАЗУ ГОТОВ ВХОД (никакого создания юзеров вручную):
--        Email:  admin@crm.tj
--        Пароль: Admin12345
--    Войдите на сайт и в Настройках смените пароль.
-- 3) Остальных сотрудников создаёте в самой программе
--    (Настройки -> Сотрудники) или в Supabase -> Authentication.
--
-- Файл генерируется из отдельных миграций; не редактируйте его
-- вручную -- правки делаются в исходных файлах.
-- ============================================================




-- ############################################################
-- ### schema.sql
-- ############################################################

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

-- ############################################################
-- ### 002_crm_modules.sql
-- ############################################################

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

-- ############################################################
-- ### 003_settings_media_payments.sql
-- ############################################################

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

-- ############################################################
-- ### 004_span_and_settings_cleanup.sql
-- ############################################################

-- RealEstate CRM: support merged units in the shakhmatka grid,
-- and stop defaulting SMS sender name to an unrelated placeholder.

alter table crm.objects add column if not exists span integer not null default 1;

alter table crm.settings alter column sms_sender_name drop default;
update crm.settings set sms_sender_name = null where sms_sender_name = 'BurjiBohtar';

-- ############################################################
-- ### 005_auth_rls.sql
-- ############################################################

-- RealEstate CRM: require a logged-in Supabase Auth user for all data access.
-- Run this ONLY after you've created at least one user in
-- Supabase Dashboard -> Authentication -> Users -> Add user,
-- since anonymous access to every table below is removed.

drop policy if exists "Allow all access to objects" on crm.objects;
create policy "Authenticated access to objects" on crm.objects
  for all to authenticated using (true) with check (true);

drop policy if exists "Allow all access to clients" on crm.clients;
create policy "Authenticated access to clients" on crm.clients
  for all to authenticated using (true) with check (true);

drop policy if exists "Allow all access to tasks" on crm.tasks;
create policy "Authenticated access to tasks" on crm.tasks
  for all to authenticated using (true) with check (true);

drop policy if exists "Allow all access to contracts" on crm.contracts;
create policy "Authenticated access to contracts" on crm.contracts
  for all to authenticated using (true) with check (true);

drop policy if exists "Allow all access to buildings" on crm.buildings;
create policy "Authenticated access to buildings" on crm.buildings
  for all to authenticated using (true) with check (true);

drop policy if exists "Allow all access to settings" on crm.settings;
create policy "Authenticated access to settings" on crm.settings
  for all to authenticated using (true) with check (true);

drop policy if exists "Allow all access to contract_payments" on crm.contract_payments;
create policy "Authenticated access to contract_payments" on crm.contract_payments
  for all to authenticated using (true) with check (true);

-- Storage stays public-read (facade photos/plans are non-sensitive marketing
-- images), but only logged-in users may upload/modify/delete.
drop policy if exists "Public upload crm-media" on storage.objects;
create policy "Authenticated upload crm-media" on storage.objects
  for insert to authenticated with check (bucket_id = 'crm-media');

drop policy if exists "Public update crm-media" on storage.objects;
create policy "Authenticated update crm-media" on storage.objects
  for update to authenticated using (bucket_id = 'crm-media');

drop policy if exists "Public delete crm-media" on storage.objects;
create policy "Authenticated delete crm-media" on storage.objects
  for delete to authenticated using (bucket_id = 'crm-media');

-- ############################################################
-- ### 006_task_reminders.sql
-- ############################################################

-- RealEstate CRM: optional SMS reminders for task due dates

alter table crm.tasks add column if not exists assignee_phone text;
alter table crm.tasks add column if not exists reminder_sent_at timestamptz;

-- ############################################################
-- ### 007_currency_template_types.sql
-- ############################################################

-- RealEstate CRM: per-deal currency (no auto-conversion), editable contract
-- template + company info, and non-apartment unit types (parking/commercial).

-- ===== Currency per object / per contract =====

create type crm.currency as enum ('TJS', 'USD');

alter table crm.objects add column if not exists currency crm.currency not null default 'TJS';
alter table crm.contracts add column if not exists currency crm.currency not null default 'TJS';
alter table crm.contracts add column if not exists amount_words text;

-- ===== Client passport (needed by the sample contract text) =====

alter table crm.clients add column if not exists passport text;

-- ===== Non-apartment unit types for the shakhmatka (basement/parking, etc.) =====

alter type crm.object_type add value if not exists 'parking';

-- ===== Company info + editable contract template =====

alter table crm.settings add column if not exists company_name text;
alter table crm.settings add column if not exists company_director text;
alter table crm.settings add column if not exists company_address text;
alter table crm.settings add column if not exists company_bank_details text;
alter table crm.settings add column if not exists contract_template text;

-- ############################################################
-- ### 008_default_contract_template.sql
-- ############################################################

-- Seed a default contract template (editable afterwards via Settings).
-- Based on the sample cooperation/purchase agreement provided by the user,
-- with the deal-specific parts replaced by {{placeholders}}.

update crm.settings
set contract_template = $tpl$ШАРТНОМАИ ҲАМКОРИ №{{contract_number}}

{{signed_date}}                                                    {{company_address}}

Тарафҳои аҳдкунанда
Ҷамъияти дорои масъулияти маҳдуди «{{company_name}}» дар шахсияти роҳбари ҷамъият {{company_director}}, ки дар асоси Оинномаи ҷамъият амал мекунад, аз як тараф, минбаъд «Фурӯшанда» ва аз тарафи дигар шаҳрванди Ҷумҳурии Тоҷикистон {{client_name}}, шиноснома {{client_passport}}, ки минбаъд «Харидор» номида мешавад, ҳамин шартномаро бо шартҳои зерин бастанд.

Мақсади шартнома
Бо мақсади вусъат бахшидани рафти сохтмони иншооти воқеъ дар {{building_address}}, тарафҳо уҳдадор шуданд, ки бо шартҳои манфиати мутақобила ҳамкорӣ намоянд.
«Фурӯшанда» имконият медиҳад, ки «Харидор» дар маблағгузории иншооти мазкур ширкат намуда, барои ба моликияти худ ба расмият даровардани {{object_name}}, бо масоҳати {{object_area}} м², ки маблағи фурӯш барои 1 м² — {{price_per_sqm}} {{currency}} мебошад, пардохт намояд. «Харидор» уҳдадор мешавад, ки маблағи умумии объектро — {{amount}} {{currency}} ({{amount_words}}) — пардохт намуда, дар муҳлати пешбининамудаи шартномаи мазкур онро минбаъд ба моликияти шахсии худ табдил дода, иҷро намояд.
«Фурӯшанда» бо анҷом расидани корҳои сохтмонӣ ва супоридани иншоот ба «Харидор» масоҳати зикршударо месупорад.
«Харидор» аз лаҳзаи бастани шартномаи ҳамкорӣ талаботи дар боло нишондодашударо таъмин менамояд.

Уҳдадориҳои тарафҳо
«Фурӯшанда» уҳдадор мешавад ба «Харидор» барои ба расмият даровардани манзил ба моликияти шахсӣ шиносномаи техникӣ диҳад, ки он баъди қабули иншоот ба баҳрабардорӣ дода мешавад.
Тамоми хароҷоти вобаста ба ҳуҷҷатгузории нотариалӣ ва бақайдгирии давлатӣ мустақилона аз ҷониби «Харидор» пардохт карда мешавад.

Масъулияти тарафҳо
«Харидор» барои саривақт пардохт намудани маблағи шартнома масъул мебошад.
«Фурӯшанда» барои саривақт ва босифат иҷро намудани корҳои сохтмонӣ масъул мебошад.

Чораҳои ҷаримавӣ
Дар мавриди риоя накардани муҳлати пардохт зиёда аз як моҳ ба андозаи 0,1% аз маблағи умумии шартнома барои ҳар як рӯзи ба таъхирандозӣ, на зиёда аз 10%, «Харидор» ба «Фурӯшанда» ҷарима пардохт менамояд.

Ҳолатҳои бекор намудани шартнома
Шартнома тибқи мувофиқаи тарафайн то пардохт намудан ва ё бо тартиби яктарафа дар мавриди қобилияти имконнопазир рад намуда, метавон бекор кард.
Дар сурати 2 (ду) моҳ пардохт накардани маблағ аз тарафи «Харидор», «Фурӯшанда» метавонад дигар муштариро барои объекти мазкур аз нав бандад.

Форс-мажор
Ягон тараф масъулиятро барои иҷро накардан ё иҷрои номатлуби уҳдадориҳои худ нахоҳад бурд, агар он дар натиҷаи ҳолатҳои фавқулода (сӯхтор, обхезӣ, заминҷунбӣ ва дигар офатҳои табиӣ) ба вуҷуд омада бошад.

Ҳалли баҳсҳо
Баҳсҳои зимни амалисозии шартномаи мазкур рухдиҳанда бо роҳи гуфтушунид ҳал мешаванд. Дар сурати нагардидани ҳал, баҳс дар асоси қонунҳои амалкунандаи Ҷумҳурии Тоҷикистон дар суди дахлдор ҳаллу фасл карда мешавад.
Шартномаи мазкур аз лаҳзаи ба имзо расонидани ҳар ду тараф эътибор пайдо менамояд ва дар ду нусха бо забони тоҷикӣ барои ҳар кадоме аз тарафҳо тартиб дода шудааст.

Суроғаи ҳуқуқӣ ва имзои тарафҳо:

«Фурӯшанда»                                                    «Харидор»
{{company_director}}                                           {{client_name}}
Суроға: {{company_address}}                             Шиноснома: {{client_passport}}
{{company_bank_details}}

Имзо ___________________                              Имзо ___________________
Санаи {{signed_date}}                                          Санаи {{signed_date}}$tpl$
where contract_template is null;

-- ############################################################
-- ### 009_logo_and_sms_templates.sql
-- ############################################################

-- RealEstate CRM: company logo, block/entrance support for shakhmatka,
-- and editable SMS templates.

alter table crm.settings add column if not exists company_logo_url text;
alter table crm.settings add column if not exists sms_payment_template text;
alter table crm.settings add column if not exists sms_task_template text;
-- Company-wide dashboard hero look (admin-set; users may still override
-- locally). See migration 033.
alter table crm.settings add column if not exists hero_theme text;
alter table crm.settings add column if not exists hero_pattern text;

alter table crm.objects add column if not exists block text;

update crm.settings
set sms_payment_template = $tpl$Уважаемый(ая) {{client_name}}, напоминаем: оплата {{amount}} {{currency}} по договору №{{contract_number}} до {{due_date}}.$tpl$
where sms_payment_template is null;

update crm.settings
set sms_task_template = $tpl${{assignee}}, напоминаем: задача "{{title}}" — срок {{due_date}}.$tpl$
where sms_task_template is null;

-- ############################################################
-- ### 010_cascade_delete_units.sql
-- ############################################################

-- Deleting a building currently orphans its units (building_id set to null),
-- which then show up as stray rows in the top-level Объекты list. Fix so
-- deleting a building removes all of its units in one transaction.

alter table crm.objects
  drop constraint if exists objects_building_id_fkey;

alter table crm.objects
  add constraint objects_building_id_fkey
  foreign key (building_id) references crm.buildings(id) on delete cascade;

-- ############################################################
-- ### 011_roles_and_client_fields.sql
-- ############################################################

-- Roles: admins have full edit rights everywhere; managers can book available
-- units and create new contracts, but cannot edit units/contracts that have
-- already moved past "available" — that's an admin-only action from here on.
--
-- Role assignment is manual and intentional: there is no in-app user
-- management UI. After creating a user in Supabase Dashboard -> Authentication,
-- run this in the SQL Editor (as postgres, which bypasses RLS) to set them up:
--
--   insert into crm.profiles (id, role)
--   values ('<user-id-from-auth-users>', 'admin')
--   on conflict (id) do update set role = excluded.role;
--
-- Use 'manager' instead of 'admin' for regular sales staff. Find a user's id
-- under Authentication -> Users in the dashboard.

create table if not exists crm.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'manager' check (role in ('admin', 'manager')),
  created_at timestamptz not null default now()
);

alter table crm.profiles enable row level security;

drop policy if exists "profiles_select_own" on crm.profiles;
create policy "profiles_select_own" on crm.profiles
  for select to authenticated
  using (id = auth.uid());

-- No insert/update/delete policy for the authenticated role on purpose:
-- role changes only happen via direct SQL (as postgres), which bypasses RLS.
-- This means no logged-in user, including managers, can ever grant
-- themselves admin through the app.

create or replace function crm.is_admin()
returns boolean
language sql
security definer
set search_path = crm, public
stable
as $$
  select coalesce(
    (select role from crm.profiles where id = auth.uid()) = 'admin',
    false
  );
$$;

-- Objects: managers may only update a unit while it's still "available"
-- (i.e. the booking flow, which flips it to "reserved"). Once a unit has
-- moved past that, only an admin can edit it further.
drop policy if exists "Authenticated access to objects" on crm.objects;

create policy "objects_select" on crm.objects
  for select to authenticated using (true);

create policy "objects_insert" on crm.objects
  for insert to authenticated with check (true);

create policy "objects_update" on crm.objects
  for update to authenticated
  using (status = 'available' or crm.is_admin())
  with check (true);

create policy "objects_delete" on crm.objects
  for delete to authenticated using (true);

-- Contracts: anyone can create one (booking/sale), but editing or deleting
-- an existing contract is admin-only.
drop policy if exists "Authenticated access to contracts" on crm.contracts;

create policy "contracts_select" on crm.contracts
  for select to authenticated using (true);

create policy "contracts_insert" on crm.contracts
  for insert to authenticated with check (true);

create policy "contracts_update" on crm.contracts
  for update to authenticated
  using (crm.is_admin())
  with check (true);

create policy "contracts_delete" on crm.contracts
  for delete to authenticated using (crm.is_admin());

-- Client details needed on the printed contract and for the booking-form
-- autocomplete (name -> full profile).
alter table crm.clients add column if not exists birth_date date;
alter table crm.clients add column if not exists address text;
alter table crm.clients add column if not exists passport_issued_by text;

-- ############################################################
-- ### 012_unit_rooms.sql
-- ############################################################

-- Track room count per unit (needed for the block/entrance/room-type
-- constructor: "3 однокомнатных по 45 м², 2 двухкомнатных по 65 м²").
alter table crm.objects add column if not exists rooms smallint;

-- ############################################################
-- ### 013_buildings_admin_rls.sql
-- ############################################################

-- The "Настроить здание" edit page is admin-gated in the UI, but the
-- underlying RLS still let any authenticated user (including managers) call
-- the Supabase API directly to edit or delete a building. Lock that down to
-- match the app-level gate: managers can still create buildings (that's the
-- "+ Новое здание / ЖК" flow in Объекты), but editing/deleting an existing
-- one is admin-only, same as contracts.
drop policy if exists "Authenticated access to buildings" on crm.buildings;

create policy "buildings_select" on crm.buildings
  for select to authenticated using (true);

create policy "buildings_insert" on crm.buildings
  for insert to authenticated with check (true);

create policy "buildings_update" on crm.buildings
  for update to authenticated
  using (crm.is_admin())
  with check (true);

create policy "buildings_delete" on crm.buildings
  for delete to authenticated using (crm.is_admin());

-- ############################################################
-- ### 020_apply_all_pending.sql
-- ############################################################

-- ============================================================
-- ОДИН ФАЙЛ ВМЕСТО 014–019: безопасно выполняет всё, что нужно
-- приложению на стороне базы. Можно запускать сколько угодно раз
-- (create or replace / drop if exists / if not exists everywhere).
-- Если какие-то из 014–019 уже применялись — ничего не сломает.
-- ============================================================

-- ---------- 014: запись платежа (менеджерам, атомарно) ----------
create or replace function crm.record_payment(
  p_contract_id uuid,
  p_amount numeric,
  p_date date
)
returns crm.contract_payments
language plpgsql
security definer
set search_path = crm, public
as $$
declare
  v_payment crm.contract_payments;
begin
  insert into crm.contract_payments (contract_id, due_date, amount, paid, paid_date)
  values (p_contract_id, p_date, p_amount, true, p_date)
  returning * into v_payment;

  update crm.contracts
  set paid_amount = paid_amount + p_amount
  where id = p_contract_id;

  return v_payment;
end;
$$;

grant execute on function crm.record_payment(uuid, numeric, date) to authenticated;

-- ---------- 015/016: автоматический статус квартиры ----------
create or replace function crm.set_payment_paid(
  p_payment_id uuid,
  p_paid boolean
)
returns crm.contract_payments
language plpgsql
security definer
set search_path = crm, public
as $$
declare
  v_payment crm.contract_payments;
  v_delta numeric;
begin
  select * into v_payment from crm.contract_payments where id = p_payment_id;
  if not found or v_payment.paid = p_paid then
    return v_payment;
  end if;
  v_delta := case when p_paid then v_payment.amount else -v_payment.amount end;

  update crm.contract_payments
  set paid = p_paid, paid_date = case when p_paid then current_date else null end
  where id = p_payment_id
  returning * into v_payment;

  update crm.contracts
  set paid_amount = paid_amount + v_delta
  where id = v_payment.contract_id;

  return v_payment;
end;
$$;

grant execute on function crm.set_payment_paid(uuid, boolean) to authenticated;

create or replace function crm.recompute_object_status(p_object_id uuid)
returns void
language sql
security definer
set search_path = crm, public
as $$
  update crm.objects
  set status = case
    when exists (
      select 1 from crm.contracts c
      where c.object_id = p_object_id and c.status <> 'cancelled' and c.paid_amount > 0
    ) then 'sold'
    when exists (
      select 1 from crm.contracts c
      where c.object_id = p_object_id and c.status <> 'cancelled'
    ) then 'reserved'
    else 'available'
  end::crm.object_status
  where id = p_object_id;
$$;

create or replace function crm.sync_object_status()
returns trigger
language plpgsql
security definer
set search_path = crm, public
as $$
begin
  perform crm.recompute_object_status(coalesce(NEW.object_id, OLD.object_id));
  if TG_OP = 'UPDATE' and OLD.object_id is distinct from NEW.object_id then
    perform crm.recompute_object_status(OLD.object_id);
  end if;
  return coalesce(NEW, OLD);
end;
$$;

drop trigger if exists trg_sync_object_status on crm.contracts;
create trigger trg_sync_object_status
after insert or update or delete on crm.contracts
for each row execute function crm.sync_object_status();

create or replace function crm.resync_all_object_statuses()
returns integer
language plpgsql
security definer
set search_path = crm, public
as $$
declare
  v_count integer := 0;
begin
  update crm.objects o
  set status = case
    when exists (
      select 1 from crm.contracts c
      where c.object_id = o.id and c.status <> 'cancelled' and c.paid_amount > 0
    ) then 'sold'
    when exists (
      select 1 from crm.contracts c
      where c.object_id = o.id and c.status <> 'cancelled'
    ) then 'reserved'
    else 'available'
  end::crm.object_status
  where exists (select 1 from crm.contracts c where c.object_id = o.id);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function crm.resync_all_object_statuses() to authenticated;

-- ---------- 017: удаления только админам + журнал удалений ----------
create table if not exists crm.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid not null,
  details jsonb,
  created_at timestamptz not null default now()
);

alter table crm.audit_log enable row level security;

drop policy if exists "audit_log_select_admin" on crm.audit_log;
create policy "audit_log_select_admin" on crm.audit_log
  for select to authenticated using (crm.is_admin());

create or replace function crm.log_delete()
returns trigger
language plpgsql
security definer
set search_path = crm, public
as $$
begin
  insert into crm.audit_log (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'delete', TG_ARGV[0], OLD.id, to_jsonb(OLD));
  return OLD;
end;
$$;

drop trigger if exists trg_audit_delete_clients on crm.clients;
create trigger trg_audit_delete_clients
before delete on crm.clients
for each row execute function crm.log_delete('client');

drop trigger if exists trg_audit_delete_contracts on crm.contracts;
create trigger trg_audit_delete_contracts
before delete on crm.contracts
for each row execute function crm.log_delete('contract');

drop trigger if exists trg_audit_delete_contract_payments on crm.contract_payments;
create trigger trg_audit_delete_contract_payments
before delete on crm.contract_payments
for each row execute function crm.log_delete('contract_payment');

drop trigger if exists trg_audit_delete_objects on crm.objects;
create trigger trg_audit_delete_objects
before delete on crm.objects
for each row execute function crm.log_delete('object');

drop policy if exists "Authenticated access to clients" on crm.clients;
drop policy if exists "clients_select" on crm.clients;
drop policy if exists "clients_insert" on crm.clients;
drop policy if exists "clients_update" on crm.clients;
drop policy if exists "clients_delete" on crm.clients;
create policy "clients_select" on crm.clients for select to authenticated using (true);
create policy "clients_insert" on crm.clients for insert to authenticated with check (true);
create policy "clients_update" on crm.clients for update to authenticated using (true) with check (true);
create policy "clients_delete" on crm.clients for delete to authenticated using (crm.is_admin());

drop policy if exists "Authenticated access to contract_payments" on crm.contract_payments;
drop policy if exists "contract_payments_select" on crm.contract_payments;
drop policy if exists "contract_payments_insert" on crm.contract_payments;
drop policy if exists "contract_payments_update" on crm.contract_payments;
drop policy if exists "contract_payments_delete" on crm.contract_payments;
create policy "contract_payments_select" on crm.contract_payments for select to authenticated using (true);
create policy "contract_payments_insert" on crm.contract_payments for insert to authenticated with check (true);
create policy "contract_payments_update" on crm.contract_payments for update to authenticated using (crm.is_admin()) with check (true);
create policy "contract_payments_delete" on crm.contract_payments for delete to authenticated using (crm.is_admin());

drop policy if exists "objects_delete" on crm.objects;
create policy "objects_delete" on crm.objects for delete to authenticated using (crm.is_admin());

-- ---------- 018: отмена быстрой брони, атомарное удаление платежа,
--                 защита от двойного бронирования ----------
create or replace function crm.cancel_quick_booking(p_contract_id uuid)
returns void
language plpgsql
security definer
set search_path = crm, public
as $$
declare
  v_ok boolean;
begin
  select (cl.source = 'quick_booking' and c.paid_amount = 0)
  into v_ok
  from crm.contracts c
  join crm.clients cl on cl.id = c.client_id
  where c.id = p_contract_id;

  if not coalesce(v_ok, false) then
    raise exception 'Not an undoable quick booking';
  end if;

  delete from crm.contracts where id = p_contract_id;
end;
$$;

grant execute on function crm.cancel_quick_booking(uuid) to authenticated;

create or replace function crm.delete_payment(p_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = crm, public
as $$
declare
  v_payment crm.contract_payments;
begin
  if not crm.is_admin() then
    raise exception 'Only an admin can delete a payment';
  end if;

  select * into v_payment from crm.contract_payments where id = p_payment_id;
  if not found then
    return;
  end if;

  delete from crm.contract_payments where id = p_payment_id;

  if v_payment.paid then
    update crm.contracts
    set paid_amount = greatest(paid_amount - v_payment.amount, 0)
    where id = v_payment.contract_id;
  end if;
end;
$$;

grant execute on function crm.delete_payment(uuid) to authenticated;

create unique index if not exists uq_contracts_object_active
  on crm.contracts (object_id)
  where status <> 'cancelled';

-- ---------- 019: настройки только админам + лимиты файлов ----------
update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
where id = 'crm-media';

drop policy if exists "Allow all access to settings" on crm.settings;
drop policy if exists "Authenticated access to settings" on crm.settings;
drop policy if exists "settings_select" on crm.settings;
drop policy if exists "settings_update" on crm.settings;

create policy "settings_select" on crm.settings
  for select to authenticated using (true);

create policy "settings_update" on crm.settings
  for update to authenticated using (crm.is_admin()) with check (crm.is_admin());

-- ---------- финальная синхронизация статусов ----------
select crm.resync_all_object_statuses();

-- ############################################################
-- ### 021_roles_scoping_manual_reserve_audit.sql
-- ############################################################

-- ============================================================
-- 021: три вещи.
-- 1) Бронь правой кнопкой БЕЗ клиента: флаг objects.manual_reserved
--    вместо договора-заглушки с подставным клиентом.
-- 2) Роли: manager видит только назначенные ему ЖК; новая роль
--    director — видит всё, менять ничего не может.
-- 3) Журнал событий: фиксирует создание и изменение (не только
--    удаление) договоров, платежей и клиентов.
-- Файл идемпотентный — можно запускать повторно.
-- ============================================================

-- ---------- роли ----------
alter table crm.profiles drop constraint if exists profiles_role_check;
alter table crm.profiles
  add constraint profiles_role_check check (role in ('admin', 'manager', 'director'));

create or replace function crm.my_role()
returns text
language sql
security definer
set search_path = crm, public
stable
as $$
  select coalesce((select role from crm.profiles where id = auth.uid()), 'manager');
$$;

create or replace function crm.is_director()
returns boolean
language sql
security definer
set search_path = crm, public
stable
as $$
  select crm.my_role() = 'director';
$$;

-- Директор — только чтение; писать могут админ и менеджер.
create or replace function crm.can_write()
returns boolean
language sql
security definer
set search_path = crm, public
stable
as $$
  select crm.my_role() in ('admin', 'manager');
$$;

-- ---------- назначение ЖК менеджерам ----------
create table if not exists crm.manager_buildings (
  user_id uuid not null references auth.users(id) on delete cascade,
  building_id uuid not null references crm.buildings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, building_id)
);

alter table crm.manager_buildings enable row level security;

drop policy if exists "manager_buildings_select" on crm.manager_buildings;
create policy "manager_buildings_select" on crm.manager_buildings
  for select to authenticated using (crm.is_admin() or user_id = auth.uid());

drop policy if exists "manager_buildings_insert" on crm.manager_buildings;
create policy "manager_buildings_insert" on crm.manager_buildings
  for insert to authenticated with check (crm.is_admin());

drop policy if exists "manager_buildings_delete" on crm.manager_buildings;
create policy "manager_buildings_delete" on crm.manager_buildings
  for delete to authenticated using (crm.is_admin());

-- Админ и директор видят все ЖК; менеджер — только назначенные.
create or replace function crm.can_view_building(p_building_id uuid)
returns boolean
language sql
security definer
set search_path = crm, public
stable
as $$
  select case
    when crm.my_role() in ('admin', 'director') then true
    else exists (
      select 1 from crm.manager_buildings mb
      where mb.user_id = auth.uid() and mb.building_id = p_building_id
    )
  end;
$$;

-- ---------- видимость по ролям (RLS) ----------
drop policy if exists "Authenticated access to buildings" on crm.buildings;
drop policy if exists "buildings_select" on crm.buildings;
drop policy if exists "buildings_insert" on crm.buildings;
drop policy if exists "buildings_update" on crm.buildings;
drop policy if exists "buildings_delete" on crm.buildings;
create policy "buildings_select" on crm.buildings
  for select to authenticated using (crm.can_view_building(id));
create policy "buildings_insert" on crm.buildings
  for insert to authenticated with check (crm.is_admin());
create policy "buildings_update" on crm.buildings
  for update to authenticated using (crm.is_admin()) with check (crm.is_admin());
create policy "buildings_delete" on crm.buildings
  for delete to authenticated using (crm.is_admin());

drop policy if exists "Authenticated access to objects" on crm.objects;
drop policy if exists "objects_select" on crm.objects;
drop policy if exists "objects_insert" on crm.objects;
drop policy if exists "objects_update" on crm.objects;
drop policy if exists "objects_delete" on crm.objects;
create policy "objects_select" on crm.objects
  for select to authenticated
  using (building_id is null or crm.can_view_building(building_id));
-- Objects are admin-only for create/edit (managers/directors can still view
-- and book them; the reservation RPC and contract triggers set status, not a
-- direct object write). See migration 032.
create policy "objects_insert" on crm.objects
  for insert to authenticated
  with check (
    crm.is_admin() and (building_id is null or crm.can_view_building(building_id))
  );
create policy "objects_update" on crm.objects
  for update to authenticated
  using (
    crm.is_admin()
    and (building_id is null or crm.can_view_building(building_id))
  )
  with check (crm.is_admin());
create policy "objects_delete" on crm.objects
  for delete to authenticated using (crm.is_admin());

drop policy if exists "Authenticated access to contracts" on crm.contracts;
drop policy if exists "contracts_select" on crm.contracts;
drop policy if exists "contracts_insert" on crm.contracts;
drop policy if exists "contracts_update" on crm.contracts;
drop policy if exists "contracts_delete" on crm.contracts;
create policy "contracts_select" on crm.contracts
  for select to authenticated
  using (
    exists (
      select 1 from crm.objects o
      where o.id = object_id
        and (o.building_id is null or crm.can_view_building(o.building_id))
    )
  );
create policy "contracts_insert" on crm.contracts
  for insert to authenticated
  with check (
    crm.can_write()
    and exists (
      select 1 from crm.objects o
      where o.id = object_id
        and (o.building_id is null or crm.can_view_building(o.building_id))
    )
  );
create policy "contracts_update" on crm.contracts
  for update to authenticated using (crm.is_admin()) with check (crm.is_admin());
create policy "contracts_delete" on crm.contracts
  for delete to authenticated using (crm.is_admin());

drop policy if exists "Authenticated access to contract_payments" on crm.contract_payments;
drop policy if exists "contract_payments_select" on crm.contract_payments;
drop policy if exists "contract_payments_insert" on crm.contract_payments;
drop policy if exists "contract_payments_update" on crm.contract_payments;
drop policy if exists "contract_payments_delete" on crm.contract_payments;
create policy "contract_payments_select" on crm.contract_payments
  for select to authenticated
  using (
    exists (
      select 1
      from crm.contracts c
      join crm.objects o on o.id = c.object_id
      where c.id = contract_id
        and (o.building_id is null or crm.can_view_building(o.building_id))
    )
  );
create policy "contract_payments_insert" on crm.contract_payments
  for insert to authenticated
  with check (
    crm.can_write()
    and exists (
      select 1
      from crm.contracts c
      join crm.objects o on o.id = c.object_id
      where c.id = contract_id
        and (o.building_id is null or crm.can_view_building(o.building_id))
    )
  );
create policy "contract_payments_update" on crm.contract_payments
  for update to authenticated using (crm.is_admin()) with check (crm.is_admin());
create policy "contract_payments_delete" on crm.contract_payments
  for delete to authenticated using (crm.is_admin());

drop policy if exists "Authenticated access to clients" on crm.clients;
drop policy if exists "clients_select" on crm.clients;
drop policy if exists "clients_insert" on crm.clients;
drop policy if exists "clients_update" on crm.clients;
drop policy if exists "clients_delete" on crm.clients;
create policy "clients_select" on crm.clients
  for select to authenticated using (true);
create policy "clients_insert" on crm.clients
  for insert to authenticated with check (crm.can_write());
create policy "clients_update" on crm.clients
  for update to authenticated using (crm.can_write()) with check (crm.can_write());
create policy "clients_delete" on crm.clients
  for delete to authenticated using (crm.is_admin());

-- ---------- бронь без клиента ----------
alter table crm.objects add column if not exists manual_reserved boolean not null default false;

-- Статус теперь учитывает и ручную бронь (без договора).
create or replace function crm.recompute_object_status(p_object_id uuid)
returns void
language sql
security definer
set search_path = crm, public
as $$
  update crm.objects o
  set status = case
    when exists (
      select 1 from crm.contracts c
      where c.object_id = o.id and c.status <> 'cancelled' and c.paid_amount > 0
    ) then 'sold'
    when exists (
      select 1 from crm.contracts c
      where c.object_id = o.id and c.status <> 'cancelled'
    ) then 'reserved'
    when o.manual_reserved then 'reserved'
    else 'available'
  end::crm.object_status
  where o.id = p_object_id;
$$;

create or replace function crm.sync_object_status()
returns trigger
language plpgsql
security definer
set search_path = crm, public
as $$
begin
  -- A real contract supersedes a hand-set reservation: once the deal is
  -- drafted, the unit's fate follows the contract, and cancelling that
  -- contract must free the unit rather than fall back to a stale flag.
  if TG_OP = 'INSERT' then
    update crm.objects set manual_reserved = false
    where id = NEW.object_id and manual_reserved;
  end if;

  perform crm.recompute_object_status(coalesce(NEW.object_id, OLD.object_id));
  if TG_OP = 'UPDATE' and OLD.object_id is distinct from NEW.object_id then
    perform crm.recompute_object_status(OLD.object_id);
  end if;
  return coalesce(NEW, OLD);
end;
$$;

drop trigger if exists trg_sync_object_status on crm.contracts;
create trigger trg_sync_object_status
after insert or update or delete on crm.contracts
for each row execute function crm.sync_object_status();

create or replace function crm.resync_all_object_statuses()
returns integer
language plpgsql
security definer
set search_path = crm, public
as $$
declare
  v_count integer := 0;
begin
  update crm.objects o
  set status = case
    when exists (
      select 1 from crm.contracts c
      where c.object_id = o.id and c.status <> 'cancelled' and c.paid_amount > 0
    ) then 'sold'
    when exists (
      select 1 from crm.contracts c
      where c.object_id = o.id and c.status <> 'cancelled'
    ) then 'reserved'
    when o.manual_reserved then 'reserved'
    else 'available'
  end::crm.object_status
  where o.manual_reserved
     or exists (select 1 from crm.contracts c where c.object_id = o.id);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function crm.resync_all_object_statuses() to authenticated;

-- ПКМ по свободной квартире ставит бронь, повторный ПКМ снимает.
-- Никакого клиента и договора не создаётся.
create or replace function crm.toggle_manual_reservation(p_object_id uuid)
returns boolean
language plpgsql
security definer
set search_path = crm, public
as $$
declare
  v_building uuid;
  v_new boolean;
begin
  if not crm.can_write() then
    raise exception 'Read-only role';
  end if;

  select building_id into v_building from crm.objects where id = p_object_id;
  if not found then
    raise exception 'Object not found';
  end if;
  if v_building is not null and not crm.can_view_building(v_building) then
    raise exception 'Building not allowed for this user';
  end if;

  -- A unit whose state is driven by a live contract can't be hand-toggled.
  if exists (
    select 1 from crm.contracts c
    where c.object_id = p_object_id and c.status <> 'cancelled'
  ) then
    raise exception 'Unit is managed by a contract';
  end if;

  update crm.objects
  set manual_reserved = not manual_reserved
  where id = p_object_id
  returning manual_reserved into v_new;

  perform crm.recompute_object_status(p_object_id);
  return v_new;
end;
$$;

grant execute on function crm.toggle_manual_reservation(uuid) to authenticated;

-- ---------- директор: только чтение и в обход RPC ----------
create or replace function crm.record_payment(
  p_contract_id uuid,
  p_amount numeric,
  p_date date
)
returns crm.contract_payments
language plpgsql
security definer
set search_path = crm, public
as $$
declare
  v_payment crm.contract_payments;
begin
  if not crm.can_write() then
    raise exception 'Read-only role';
  end if;
  if not exists (
    select 1
    from crm.contracts c
    join crm.objects o on o.id = c.object_id
    where c.id = p_contract_id
      and (o.building_id is null or crm.can_view_building(o.building_id))
  ) then
    raise exception 'Contract not allowed for this user';
  end if;

  insert into crm.contract_payments (contract_id, due_date, amount, paid, paid_date)
  values (p_contract_id, p_date, p_amount, true, p_date)
  returning * into v_payment;

  update crm.contracts
  set paid_amount = paid_amount + p_amount
  where id = p_contract_id;

  return v_payment;
end;
$$;

create or replace function crm.set_payment_paid(
  p_payment_id uuid,
  p_paid boolean
)
returns crm.contract_payments
language plpgsql
security definer
set search_path = crm, public
as $$
declare
  v_payment crm.contract_payments;
  v_delta numeric;
begin
  if not crm.can_write() then
    raise exception 'Read-only role';
  end if;

  select * into v_payment from crm.contract_payments where id = p_payment_id;
  if not found or v_payment.paid = p_paid then
    return v_payment;
  end if;
  v_delta := case when p_paid then v_payment.amount else -v_payment.amount end;

  update crm.contract_payments
  set paid = p_paid, paid_date = case when p_paid then current_date else null end
  where id = p_payment_id
  returning * into v_payment;

  update crm.contracts
  set paid_amount = paid_amount + v_delta
  where id = v_payment.contract_id;

  return v_payment;
end;
$$;

create or replace function crm.cancel_quick_booking(p_contract_id uuid)
returns void
language plpgsql
security definer
set search_path = crm, public
as $$
declare
  v_ok boolean;
begin
  if not crm.can_write() then
    raise exception 'Read-only role';
  end if;

  select (cl.source = 'quick_booking' and c.paid_amount = 0)
  into v_ok
  from crm.contracts c
  join crm.clients cl on cl.id = c.client_id
  where c.id = p_contract_id;

  if not coalesce(v_ok, false) then
    raise exception 'Not an undoable quick booking';
  end if;

  delete from crm.contracts where id = p_contract_id;
end;
$$;

-- ---------- журнал: создание и изменение, не только удаление ----------
create or replace function crm.log_change()
returns trigger
language plpgsql
security definer
set search_path = crm, public
as $$
declare
  v_diff jsonb;
begin
  if TG_OP = 'INSERT' then
    insert into crm.audit_log (actor_id, action, entity_type, entity_id, details)
    values (auth.uid(), 'create', TG_ARGV[0], NEW.id, to_jsonb(NEW));
    return NEW;
  end if;

  -- UPDATE: only the fields that actually changed, old -> new, so the log
  -- reads as "what happened" instead of two full row dumps.
  select coalesce(
    jsonb_object_agg(n.key, jsonb_build_object('old', o.value, 'new', n.value)),
    '{}'::jsonb
  )
  into v_diff
  from jsonb_each(to_jsonb(NEW)) n
  join jsonb_each(to_jsonb(OLD)) o using (key)
  where n.value is distinct from o.value
    and n.key not in ('updated_at');

  if v_diff <> '{}'::jsonb then
    insert into crm.audit_log (actor_id, action, entity_type, entity_id, details)
    values (auth.uid(), 'update', TG_ARGV[0], NEW.id, v_diff);
  end if;
  return NEW;
end;
$$;

-- Более ранний вариант этого файла ставил триггеры с другими именами;
-- убираем их, иначе оба набора сработают и журнал задвоится.
drop trigger if exists trg_log_change_contracts on crm.contracts;
drop trigger if exists trg_log_change_contract_payments on crm.contract_payments;
drop trigger if exists trg_log_change_clients on crm.clients;

drop trigger if exists trg_audit_change_contracts on crm.contracts;
create trigger trg_audit_change_contracts
after insert or update on crm.contracts
for each row execute function crm.log_change('contract');

drop trigger if exists trg_audit_change_contract_payments on crm.contract_payments;
create trigger trg_audit_change_contract_payments
after insert or update on crm.contract_payments
for each row execute function crm.log_change('contract_payment');

drop trigger if exists trg_audit_change_clients on crm.clients;
create trigger trg_audit_change_clients
after insert or update on crm.clients
for each row execute function crm.log_change('client');

-- ---------- пересборка графика рассрочки из остатка ----------
create or replace function crm.regenerate_schedule(
  p_contract_id uuid,
  p_months integer
)
returns integer
language plpgsql
security definer
set search_path = crm, public
as $$
declare
  v_contract crm.contracts;
  v_remaining numeric;
  v_base numeric;
  v_amount numeric;
  i integer;
begin
  if not crm.can_write() then
    raise exception 'Read-only role';
  end if;
  if p_months is null or p_months < 1 then
    raise exception 'Months must be at least 1';
  end if;

  select * into v_contract from crm.contracts where id = p_contract_id;
  if not found then
    raise exception 'Contract not found';
  end if;

  v_remaining := greatest(v_contract.amount - v_contract.paid_amount, 0);
  if v_remaining <= 0 then
    raise exception 'Nothing left to schedule';
  end if;

  -- Только план; фактические (оплаченные) строки неприкосновенны.
  delete from crm.contract_payments
  where contract_id = p_contract_id and paid = false;

  v_base := floor(v_remaining / p_months * 100) / 100;
  for i in 1..p_months loop
    if i = p_months then
      v_amount := round((v_remaining - v_base * (p_months - 1)) * 100) / 100;
    else
      v_amount := v_base;
    end if;
    insert into crm.contract_payments (contract_id, due_date, amount, paid, paid_date)
    values (p_contract_id, (current_date + (i || ' month')::interval)::date, v_amount, false, null);
  end loop;

  update crm.contracts
  set installment_months = p_months, payment_type = 'installment'
  where id = p_contract_id;

  return p_months;
end;
$$;

grant execute on function crm.regenerate_schedule(uuid, integer) to authenticated;

-- Пересозданные выше функции наследуют старые grant-ы, но если 020 в этой
-- базе так и не выполнился, их никто не выдавал — проставим явно.
grant execute on function crm.record_payment(uuid, numeric, date) to authenticated;
grant execute on function crm.set_payment_paid(uuid, boolean) to authenticated;
grant execute on function crm.cancel_quick_booking(uuid) to authenticated;

-- финальная синхронизация статусов
select crm.resync_all_object_statuses();

-- ############################################################
-- ### 022_lock_out_strangers.sql
-- ############################################################

-- ============================================================
-- 022: посторонний с аккаунтом = никто.
--
-- Дыра: crm.my_role() возвращал 'manager' для любого вошедшего
-- пользователя БЕЗ строки в crm.profiles. Если в Supabase включена
-- самостоятельная регистрация (по умолчанию включена), чужак мог
-- зарегистрироваться напрямую через API и сразу получить права
-- менеджера: видеть всех клиентов и писать в базу.
--
-- Исправление: нет строки в profiles — роль 'none', то есть ничего
-- не видно и ничего нельзя. Роль выдаёт только админ (страница
-- «Сотрудники» создаёт profiles через service-ключ).
--
-- ВАЖНО: дополнительно отключите самостоятельную регистрацию в
-- Supabase Dashboard → Authentication → Sign In / Providers →
-- "Allow new users to sign up" → OFF. Аккаунты создаёт только админ.
--
-- Файл идемпотентный — можно запускать повторно.
-- ============================================================

create or replace function crm.my_role()
returns text
language sql
security definer
set search_path = crm, public
stable
as $$
  select coalesce((select role from crm.profiles where id = auth.uid()), 'none');
$$;

-- Есть ли у пользователя вообще какая-то роль в системе.
create or replace function crm.has_role()
returns boolean
language sql
security definer
set search_path = crm, public
stable
as $$
  select crm.my_role() in ('admin', 'manager', 'director');
$$;

-- Клиенты: раньше select был using(true) — любой аутентифицированный
-- видел всю клиентскую базу. Теперь только сотрудники.
drop policy if exists "clients_select" on crm.clients;
create policy "clients_select" on crm.clients
  for select to authenticated using (crm.has_role());

-- Квартиры/договоры/платежи: политики уже завязаны на can_view_building,
-- но ветка "building_id is null" была видна всем аутентифицированным.
-- Добавляем общий ролевой замок.
drop policy if exists "objects_select" on crm.objects;
create policy "objects_select" on crm.objects
  for select to authenticated
  using (
    crm.has_role() and (building_id is null or crm.can_view_building(building_id))
  );

drop policy if exists "contracts_select" on crm.contracts;
create policy "contracts_select" on crm.contracts
  for select to authenticated
  using (
    crm.has_role()
    and exists (
      select 1 from crm.objects o
      where o.id = object_id
        and (o.building_id is null or crm.can_view_building(o.building_id))
    )
  );

drop policy if exists "contract_payments_select" on crm.contract_payments;
create policy "contract_payments_select" on crm.contract_payments
  for select to authenticated
  using (
    crm.has_role()
    and exists (
      select 1
      from crm.contracts c
      join crm.objects o on o.id = c.object_id
      where c.id = contract_id
        and (o.building_id is null or crm.can_view_building(o.building_id))
    )
  );

-- Задачи и настройки: были открыты любому аутентифицированному.
drop policy if exists "Authenticated access to tasks" on crm.tasks;
drop policy if exists "tasks_all" on crm.tasks;
create policy "tasks_all" on crm.tasks
  for all to authenticated using (crm.has_role()) with check (crm.can_write());

drop policy if exists "settings_select" on crm.settings;
create policy "settings_select" on crm.settings
  for select to authenticated using (crm.has_role());

-- ############################################################
-- ### 023_delete_client_cascade.sql
-- ############################################################

-- ============================================================
-- 023: каскадное удаление клиента админом.
--
-- Обычное удаление клиента заблокировано, если у него есть договоры
-- (и это правильно). Этот RPC — осознанное действие админа: удаляет
-- клиента ВМЕСТЕ со всеми его договорами и платежами, одной
-- транзакцией. Роль проверяется здесь, в базе, а не в браузере.
--
-- Каждая удалённая строка попадает в журнал событий (audit_log)
-- через существующие триггеры log_delete, так что «что именно
-- удалили» восстановимо из журнала. Статусы квартир пересчитаются
-- сами: триггер на удаление договора уже это делает.
--
-- Файл идемпотентный — можно запускать повторно.
-- ============================================================

create or replace function crm.delete_client_cascade(p_client_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = crm, public
as $$
declare
  v_contracts integer := 0;
  v_payments integer := 0;
begin
  if not crm.is_admin() then
    raise exception 'Только администратор может удалять клиентов';
  end if;

  delete from crm.contract_payments cp
  using crm.contracts c
  where cp.contract_id = c.id and c.client_id = p_client_id;
  get diagnostics v_payments = row_count;

  delete from crm.contracts where client_id = p_client_id;
  get diagnostics v_contracts = row_count;

  delete from crm.clients where id = p_client_id;

  return jsonb_build_object('contracts', v_contracts, 'payments', v_payments);
end;
$$;

grant execute on function crm.delete_client_cascade(uuid) to authenticated;

-- ############################################################
-- ### 024_performance_indexes.sql
-- ############################################################

-- ============================================================
-- 024: индексы под реальные запросы приложения.
--
-- Все списки в приложении уже пагинированы (по 25 строк), но без
-- индексов Postgres всё равно перебирает таблицы целиком при каждом
-- фильтре. Эти индексы покрывают ровно те запросы, которые страницы
-- делают постоянно:
--   контракты по клиенту (карточка клиента, колонка долга в списке),
--   контракты по квартире (шахматка),
--   платежи по договору (графики, расиды),
--   квартиры по зданию (шахматка),
--   журнал по дате (страница журнала),
--   клиенты по дате создания (список клиентов).
--
-- Файл идемпотентный — можно запускать повторно.
-- ============================================================

create index if not exists idx_contracts_client_id on crm.contracts (client_id);
create index if not exists idx_contracts_object_id on crm.contracts (object_id);
create index if not exists idx_contract_payments_contract_id
  on crm.contract_payments (contract_id);
create index if not exists idx_objects_building_id on crm.objects (building_id);
create index if not exists idx_audit_log_created_at
  on crm.audit_log (created_at desc);
create index if not exists idx_clients_created_at on crm.clients (created_at desc);
-- Поиск клиентов по имени/телефону идёт через ilike '%…%' -- обычный
-- btree тут не помогает, нужен триграммный.
create extension if not exists pg_trgm;
create index if not exists idx_clients_name_trgm
  on crm.clients using gin (name gin_trgm_ops);
create index if not exists idx_clients_phone_trgm
  on crm.clients using gin (phone gin_trgm_ops);

-- ############################################################
-- ### 025_validate_payment_amounts.sql
-- ############################################################

-- ============================================================
-- 025: платёж не может быть нулевым или отрицательным.
--
-- record_payment принимал любую сумму: отрицательный «платёж» тихо
-- уменьшал paid_amount договора — касса и график разошлись бы, а в
-- истории лежала бы строка с минусом. Теперь база отвергает такие
-- вызовы независимо от того, что прислал интерфейс.
--
-- Файл идемпотентный — можно запускать повторно.
-- ============================================================

create or replace function crm.record_payment(
  p_contract_id uuid,
  p_amount numeric,
  p_date date
)
returns crm.contract_payments
language plpgsql
security definer
set search_path = crm, public
as $$
declare
  v_payment crm.contract_payments;
begin
  if not crm.can_write() then
    raise exception 'Read-only role';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Сумма платежа должна быть больше нуля';
  end if;
  if p_date is null then
    raise exception 'Не указана дата платежа';
  end if;
  if not exists (
    select 1
    from crm.contracts c
    join crm.objects o on o.id = c.object_id
    where c.id = p_contract_id
      and (o.building_id is null or crm.can_view_building(o.building_id))
  ) then
    raise exception 'Contract not allowed for this user';
  end if;

  insert into crm.contract_payments (contract_id, due_date, amount, paid, paid_date)
  values (p_contract_id, p_date, p_amount, true, p_date)
  returning * into v_payment;

  update crm.contracts
  set paid_amount = paid_amount + p_amount
  where id = p_contract_id;

  return v_payment;
end;
$$;

grant execute on function crm.record_payment(uuid, numeric, date) to authenticated;

-- Страховка на уровне таблицы: строка платежа с суммой <= 0 не может
-- появиться вообще, каким бы путём её ни вставляли.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'chk_contract_payments_amount_positive'
  ) then
    -- not valid: не проверяет старые строки (вдруг там уже есть мусор --
    -- его чинят руками), но блокирует любые новые.
    alter table crm.contract_payments
      add constraint chk_contract_payments_amount_positive
      check (amount > 0) not valid;
  end if;
end $$;

-- ############################################################
-- ### 026_public_branding.sql
-- ############################################################

-- ============================================================
-- 026: название и логотип компании для страницы входа.
--
-- Настройки целиком (реквизиты, шаблоны SMS) читают только сотрудники
-- (022), но страница входа показывается ДО входа — ей нужно название
-- и логотип. Эта функция отдаёт только эти два поля и ничего больше,
-- поэтому её можно открыть анонимным без риска.
--
-- Файл идемпотентный — можно запускать повторно.
-- ============================================================

-- Returns the company hero theme/pattern too, so the pre-auth login page can
-- paint itself in the company theme. See migration 034. DROP first because the
-- return type changed (name+logo -> +theme+pattern).
drop function if exists crm.public_branding();

create or replace function crm.public_branding()
returns table (company_name text, company_logo_url text, hero_theme text, hero_pattern text)
language sql
security definer
set search_path = crm, public
stable
as $$
  select s.company_name, s.company_logo_url, s.hero_theme, s.hero_pattern
  from crm.settings s
  limit 1;
$$;

grant execute on function crm.public_branding() to anon, authenticated;

-- ############################################################
-- ### 027_first_user_is_admin.sql
-- ############################################################

-- ============================================================
-- 027: первый пользователь автоматически становится админом.
--
-- Раньше после создания базы приходилось вручную выполнять SQL,
-- чтобы выдать первому аккаунту роль admin (курица и яйцо: админов
-- ещё нет, а роли выдаёт админ). Теперь: если в системе ещё НЕТ ни
-- одного админа, первый созданный пользователь получает роль admin
-- сам. Все последующие пользователи роли НЕ получают — их создаёт
-- админ со страницы «Сотрудники».
--
-- Безопасность: правило срабатывает только пока админов ноль, то
-- есть ровно один раз за жизнь базы. Но самостоятельную регистрацию
-- всё равно нужно держать выключенной (Authentication → Sign In /
-- Providers → Allow new users to sign up → OFF) — это правило
-- «первый = админ» и открытая регистрация вместе означали бы гонку
-- за первое место.
--
-- Файл идемпотентный — можно запускать повторно.
-- ============================================================

create or replace function crm.grant_admin_to_first_user()
returns trigger
language plpgsql
security definer
set search_path = crm, public
as $$
begin
  if not exists (select 1 from crm.profiles where role = 'admin') then
    insert into crm.profiles (id, role)
    values (new.id, 'admin')
    on conflict (id) do update set role = 'admin';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_first_user_is_admin on auth.users;
create trigger trg_first_user_is_admin
after insert on auth.users
for each row execute function crm.grant_admin_to_first_user();

-- Если база уже существует и в ней ровно один пользователь без роли
-- (типичная картина свежей установки) — сделать его админом сейчас.
do $$
declare
  v_only_user uuid;
begin
  if not exists (select 1 from crm.profiles where role = 'admin') then
    select id into v_only_user from auth.users
    order by created_at asc limit 1;
    if v_only_user is not null then
      insert into crm.profiles (id, role)
      values (v_only_user, 'admin')
      on conflict (id) do update set role = 'admin';
    end if;
  end if;
end $$;

-- ############################################################
-- ### 028_staff_management_no_service_key.sql
-- ############################################################

-- ============================================================
-- 028: управление сотрудниками БЕЗ service-ключа.
--
-- Раньше страница «Сотрудники» ходила в серверный API с секретным
-- ключом (SUPABASE_SERVICE_ROLE_KEY). Любая ошибка этого ключа на
-- Vercel ломала всю страницу целиком — нельзя было даже увидеть
-- список.
--
-- Теперь список пользователей и выдача ролей работают через обычные
-- RPC прямо в базе (SECURITY DEFINER, доступ только админу). Никакого
-- секретного ключа не нужно — всё как с остальными данными
-- программы. Новый порядок:
--   1) админ создаёт пользователя в Supabase → Authentication → Users;
--   2) он сам появляется в списке на странице «Сотрудники»;
--   3) админ ставит ему роль и объекты прямо в программе.
--
-- Файл идемпотентный — можно запускать повторно.
-- ============================================================

-- Список всех пользователей с их ролью (роль 'none' — если ещё не
-- назначена). Только для админа. Функция выполняется от владельца БД,
-- поэтому может читать auth.users, недоступную обычному ключу.
create or replace function crm.list_staff()
returns table (id uuid, email text, role text, created_at timestamptz)
language plpgsql
security definer
set search_path = crm, public
stable
as $$
begin
  if not crm.is_admin() then
    raise exception 'Только администратор может видеть список сотрудников';
  end if;
  return query
    select u.id,
           u.email::text,
           coalesce(p.role, 'none') as role,
           u.created_at
    from auth.users u
    left join crm.profiles p on p.id = u.id
    order by u.created_at asc;
end;
$$;

grant execute on function crm.list_staff() to authenticated;

-- Выдать/сменить роль. 'none' = убрать доступ (удалить строку роли).
-- Только для админа. Себя понизить нельзя — иначе можно случайно
-- остаться без единого админа.
create or replace function crm.set_user_role(p_user uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = crm, public
as $$
begin
  if not crm.is_admin() then
    raise exception 'Только администратор может менять роли';
  end if;
  if p_role not in ('admin', 'manager', 'director', 'none') then
    raise exception 'Неизвестная роль: %', p_role;
  end if;
  if p_user = auth.uid() and p_role <> 'admin' then
    raise exception 'Нельзя снять роль администратора с самого себя';
  end if;

  if p_role = 'none' then
    delete from crm.profiles where id = p_user;
  else
    insert into crm.profiles (id, role)
    values (p_user, p_role)
    on conflict (id) do update set role = excluded.role;
  end if;
end;
$$;

grant execute on function crm.set_user_role(uuid, text) to authenticated;

-- ############################################################
-- ### 029_seed_admin.sql
-- ############################################################

-- ============================================================
-- 029: готовый аккаунт администратора прямо из SQL.
--
-- Больше НИКАКОЙ возни с созданием пользователей в дашборде,
-- подтверждением почты и "не тот проект". Выполнили этот файл —
-- сразу есть рабочий вход:
--
--     Email:  admin@crm.tj
--     Пароль: Admin12345
--
-- ПОСЛЕ ПЕРВОГО ВХОДА ОБЯЗАТЕЛЬНО СМЕНИТЕ ПАРОЛЬ в программе:
-- Настройки → «Сменить пароль».
--
-- Заодно, если в базе уже есть аккаунт iammirzozoda@gmail.com,
-- который не пускал, — этот файл чинит его: ставит известный пароль
-- (Admin12345), подтверждает почту и делает админом.
--
-- Файл идемпотентный — можно запускать повторно.
-- ============================================================

-- crypt() / gen_salt() для хеша пароля.
create extension if not exists pgcrypto;

-- Универсальная процедура: создать аккаунт с паролем, если его нет,
-- либо починить существующий (пароль + подтверждение почты), и в любом
-- случае выдать роль admin.
create or replace function crm.ensure_admin(p_email text, p_password text)
returns void
language plpgsql
security definer
-- extensions: там в Supabase живут crypt()/gen_salt() из pgcrypto.
set search_path = auth, crm, public, extensions
as $$
declare
  v_uid uuid;
begin
  select id into v_uid from auth.users where email = p_email;

  if v_uid is null then
    v_uid := gen_random_uuid();
    -- ВАЖНО: служебные token-поля задаём пустой строкой, а не оставляем
    -- NULL. Иначе при входе GoTrue (сервис авторизации Supabase) не может
    -- прочитать строку и падает с "Database error querying schema".
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token,
      email_change_token_new, email_change, email_change_token_current,
      phone_change, phone_change_token, reauthentication_token
    ) values (
      '00000000-0000-0000-0000-000000000000', v_uid,
      'authenticated', 'authenticated', p_email,
      crypt(p_password, gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      '', '', '', '', '', '', '', ''
    );
    insert into auth.identities (
      provider_id, user_id, identity_data, provider, created_at, updated_at
    ) values (
      v_uid::text, v_uid,
      jsonb_build_object('sub', v_uid::text, 'email', p_email),
      'email', now(), now()
    );
  else
    -- Чиним уже созданный аккаунт: пароль, подтверждение почты и те же
    -- token-поля, если они остались NULL от прежней SQL-вставки.
    update auth.users
       set encrypted_password = crypt(p_password, gen_salt('bf')),
           email_confirmed_at = coalesce(email_confirmed_at, now()),
           confirmation_token = coalesce(confirmation_token, ''),
           recovery_token = coalesce(recovery_token, ''),
           email_change_token_new = coalesce(email_change_token_new, ''),
           email_change = coalesce(email_change, ''),
           email_change_token_current = coalesce(email_change_token_current, ''),
           phone_change = coalesce(phone_change, ''),
           phone_change_token = coalesce(phone_change_token, ''),
           reauthentication_token = coalesce(reauthentication_token, ''),
           updated_at = now()
     where id = v_uid;
    if not exists (
      select 1 from auth.identities where user_id = v_uid and provider = 'email'
    ) then
      insert into auth.identities (
        provider_id, user_id, identity_data, provider, created_at, updated_at
      ) values (
        v_uid::text, v_uid,
        jsonb_build_object('sub', v_uid::text, 'email', p_email),
        'email', now(), now()
      );
    end if;
  end if;

  insert into crm.profiles (id, role)
  values (v_uid, 'admin')
  on conflict (id) do update set role = 'admin';
end;
$$;

-- КРИТИЧНО: функция умеет назначать админа, поэтому её нельзя вызывать
-- никому, кроме самой базы. По умолчанию Postgres разрешает EXECUTE всем
-- (PUBLIC) — иначе любой аноним через API сделал бы себя админом. Отзываем.
revoke all on function crm.ensure_admin(text, text) from public;
revoke all on function crm.ensure_admin(text, text) from anon;
revoke all on function crm.ensure_admin(text, text) from authenticated;

-- Готовый вход "из коробки".
select crm.ensure_admin('admin@crm.tj', 'Admin12345');

-- Чиним/поднимаем ваш личный аккаунт, если он был заведён раньше.
select crm.ensure_admin('iammirzozoda@gmail.com', 'Admin12345');

-- ############################################################
-- ### 030_sales_by_manager.sql
-- ############################################################

-- ============================================================
-- 030: продажи по менеджерам.
--
-- 1) В договоре появляется поле created_by — кто оформил сделку.
--    Заполняется САМО при создании (триггер ставит текущего
--    пользователя), менять ввод в программе не нужно. Старые договоры
--    останутся без менеджера ("Без менеджера" в отчёте).
-- 2) RPC crm.sales_by_manager() — сводка для дашборда: по каждому
--    менеджеру число сделок, сумма договоров и сколько оплачено, в
--    разрезе валют. Только админ и директор.
--
-- Файл идемпотентный — можно запускать повторно.
-- ============================================================

alter table crm.contracts
  add column if not exists created_by uuid references auth.users(id) on delete set null;

-- Проставлять автора при вставке (все пути создания договора идут от
-- имени вошедшего пользователя).
create or replace function crm.set_contract_creator()
returns trigger
language plpgsql
security definer
set search_path = crm, public
as $$
begin
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_contract_creator on crm.contracts;
create trigger trg_set_contract_creator
before insert on crm.contracts
for each row execute function crm.set_contract_creator();

-- Сводка продаж по менеджерам. Читает auth.users (email), поэтому
-- SECURITY DEFINER и только для админа/директора.
create or replace function crm.sales_by_manager()
returns table (
  manager text,
  currency text,
  contracts bigint,
  total numeric,
  paid numeric
)
language plpgsql
security definer
set search_path = crm, public, auth
stable
as $$
begin
  if not (crm.is_admin() or crm.is_director()) then
    raise exception 'Доступно только администратору и директору';
  end if;
  return query
    select
      coalesce(u.email::text, 'Без менеджера') as manager,
      c.currency::text as currency,
      count(*)::bigint as contracts,
      sum(c.amount) as total,
      sum(least(c.paid_amount, c.amount)) as paid
    from crm.contracts c
    left join auth.users u on u.id = c.created_by
    where c.status <> 'cancelled'
    group by 1, 2
    order by 4 desc nulls last;
end;
$$;

grant execute on function crm.sales_by_manager() to authenticated;

-- ############################################################
-- ### 031_office_type.sql
-- ############################################################

-- ============================================================
-- 031: тип помещения «Офис».
--
-- Для смешанных зданий (1 этаж — магазин, 2 этаж — офисы, выше —
-- квартиры) не хватало отдельного типа «офис». Добавляем в enum.
-- 'parking' добавлен ещё в 007 — здесь на всякий случай тоже с
-- IF NOT EXISTS, если база очень старая.
--
-- Файл идемпотентный.
-- ============================================================

alter type crm.object_type add value if not exists 'office';
alter type crm.object_type add value if not exists 'parking';
