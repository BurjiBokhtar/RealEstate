-- Two things:
--
-- 1) Deleting a client, a recorded payment/receipt, or a shakhmatka unit
--    used to be open to any authenticated user (the original "Authenticated
--    access ... using (true)" policies from 005 never got tightened for
--    these three tables the way contracts already were in 011). Restrict
--    deletion of all four to admins. Recording a new payment still goes
--    through record_payment (a SECURITY DEFINER RPC, unaffected by this),
--    so managers keep doing that day to day -- this only closes off
--    directly deleting/editing an existing payment row, deleting a client,
--    or deleting a unit.
--
-- 2) An automatic audit trail: whenever a row is deleted from any of these
--    four tables, a trigger snapshots it into crm.audit_log before it's
--    gone, regardless of whether the delete came from this app, a future
--    version of it, or someone in the SQL editor. Only admins can read it.

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
-- Deliberately no insert/update/delete policy for the authenticated role --
-- entries are only ever written by the SECURITY DEFINER trigger below, so
-- staff (including admins, through the app) can't edit or clear the trail.

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

-- Clients: only DELETE is restricted; create/update stay open so managers
-- keep managing leads day to day.
drop policy if exists "Authenticated access to clients" on crm.clients;
drop policy if exists "clients_select" on crm.clients;
drop policy if exists "clients_insert" on crm.clients;
drop policy if exists "clients_update" on crm.clients;
drop policy if exists "clients_delete" on crm.clients;
create policy "clients_select" on crm.clients for select to authenticated using (true);
create policy "clients_insert" on crm.clients for insert to authenticated with check (true);
create policy "clients_update" on crm.clients for update to authenticated using (true) with check (true);
create policy "clients_delete" on crm.clients for delete to authenticated using (crm.is_admin());

-- Contract payments (receipts): direct edit/delete of an existing row is
-- admin-only; recording a new one via record_payment is unaffected since
-- that RPC runs as SECURITY DEFINER.
drop policy if exists "Authenticated access to contract_payments" on crm.contract_payments;
drop policy if exists "contract_payments_select" on crm.contract_payments;
drop policy if exists "contract_payments_insert" on crm.contract_payments;
drop policy if exists "contract_payments_update" on crm.contract_payments;
drop policy if exists "contract_payments_delete" on crm.contract_payments;
create policy "contract_payments_select" on crm.contract_payments for select to authenticated using (true);
create policy "contract_payments_insert" on crm.contract_payments for insert to authenticated with check (true);
create policy "contract_payments_update" on crm.contract_payments for update to authenticated using (crm.is_admin()) with check (true);
create policy "contract_payments_delete" on crm.contract_payments for delete to authenticated using (crm.is_admin());

-- Objects: deleting a shakhmatka unit is rare and destructive -- admin-only
-- from here on (create/update-while-available stays as 011 left it).
drop policy if exists "objects_delete" on crm.objects;
create policy "objects_delete" on crm.objects for delete to authenticated using (crm.is_admin());
