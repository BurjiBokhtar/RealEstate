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
