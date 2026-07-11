-- Object status (available/reserved/sold) should never be picked by staff --
-- it's fully determined by whether the unit has a live (non-cancelled)
-- contract and whether anything has been paid on it: no contract -> free,
-- a contract with nothing paid yet -> reserved, any payment recorded ->
-- sold. This used to be set by hand in the booking form and always forced
-- to "reserved" regardless of payment, so a fully-paid unit could get stuck
-- showing as merely booked.
--
-- Two write paths feed paid_amount today: the record_payment RPC (014) and
-- marking a scheduled installment paid/unpaid in the payments table. The
-- latter never touched contracts.paid_amount before, so it silently drifted
-- out of sync -- fixed here with set_payment_paid, which updates both
-- atomically. Both run as SECURITY DEFINER because contracts_update is
-- admin-only (011), and managers need to be able to record payments.

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

-- Recomputes one object's status from its own contracts. Runs as
-- SECURITY DEFINER so it can move a unit from "reserved"/"sold" onward,
-- which objects_update (011) otherwise restricts to admins only.
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

-- Backfill: fix units whose status drifted before this trigger existed.
-- Only touches objects that have at least one contract, so standalone
-- properties that were manually marked "rented"/"in_progress" and never
-- had a contract in the CRM are left untouched.
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
