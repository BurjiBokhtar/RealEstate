-- Three bugs found in review:
--
-- 1) Quick-booking "undo" (right-click a unit booked this way a second
--    time) deletes the placeholder contract directly from the client --
--    but contracts_delete (011) is admin-only, so this silently failed
--    (RLS-rejected) for every manager, defeating the whole point of a fast
--    undo for routine front-desk staff. Fixed with a narrow SECURITY
--    DEFINER RPC that only ever deletes a contract matching the exact
--    "untouched quick-booking placeholder" signature the app already
--    relies on client-side (client.source = 'quick_booking' and
--    paid_amount = 0) -- it can't be used to delete anything else.
--
-- 2) Right-clicking the same available unit from two different sessions at
--    nearly the same moment could both pass the client-side "is this unit
--    still available" check before either write lands, creating two
--    contracts on the same unit. A partial unique index makes the second
--    insert fail at the database instead of silently double-booking.
--
-- 3) Deleting a paid installment (ContractPayments' admin-only delete
--    button) computed the contract's new paid_amount in JS from the
--    contract prop already held in memory, then wrote that single number
--    back -- a non-atomic read-modify-write that can lose a concurrent
--    change. Moved into a SECURITY DEFINER RPC that decrements
--    paid_amount with a single atomic UPDATE alongside the delete.

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

-- Deleting a payment row is already admin-only via contract_payments_delete
-- (017); this RPC just makes the accompanying paid_amount adjustment
-- atomic. Still checks is_admin() itself since SECURITY DEFINER bypasses
-- that table policy entirely.
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

-- One live (non-cancelled) contract per unit at a time. A cancelled
-- contract doesn't count, so re-booking a unit after a prior deal fell
-- through still works -- this only blocks two *simultaneous* live
-- contracts on the same unit, which is always a mistake (double booking),
-- never a legitimate state.
create unique index if not exists uq_contracts_object_active
  on crm.contracts (object_id)
  where status <> 'cancelled';
