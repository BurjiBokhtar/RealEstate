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
create policy "objects_insert" on crm.objects
  for insert to authenticated
  with check (
    crm.can_write() and (building_id is null or crm.can_view_building(building_id))
  );
create policy "objects_update" on crm.objects
  for update to authenticated
  using (
    (status = 'available' or crm.is_admin())
    and crm.can_write()
    and (building_id is null or crm.can_view_building(building_id))
  )
  with check (crm.can_write());
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
  end
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
  end
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
    values (auth.uid(), 'insert', TG_ARGV[0], NEW.id, to_jsonb(NEW));
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

-- финальная синхронизация статусов
select crm.resync_all_object_statuses();
