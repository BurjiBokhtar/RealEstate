-- Recording a payment (a client paying this month's installment, or an
-- ad-hoc amount) needs to insert a contract_payments row AND keep
-- contracts.paid_amount in sync. But contracts_update (migration 011) is
-- admin-only, so a manager couldn't do either directly -- and payment
-- collection is routine sales/reception work, not something that should
-- require an admin.
--
-- Rather than reopening general contract edits to managers, expose one
-- narrow, safe operation: SECURITY DEFINER lets this function bypass RLS
-- internally, but it can only ever insert a payment and increment
-- paid_amount by that exact amount -- nothing else about the contract
-- (amount, client_id, object_id, status) is reachable through it.
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
