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
  end
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
  end
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
