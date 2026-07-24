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
