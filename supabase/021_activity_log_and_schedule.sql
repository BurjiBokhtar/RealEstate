-- 1) Журнал событий: раньше писались только УДАЛЕНИЯ (020), поэтому
--    повседневная работа — брони, платежи, правки — в журнал не попадала
--    и он выглядел «не работающим». Теперь фиксируются и создание, и
--    изменения (с перечнем изменённых полей) по договорам, платежам и
--    клиентам. Хона (units) намеренно логируются только на удаление:
--    генератор шахматки создаёт их сотнями за раз, это чистый шум.
--
-- 2) crm.regenerate_schedule: пересборка графика рассрочки «из остатка» —
--    удаляет только НЕоплаченные строки плана и раскладывает текущий
--    остаток договора на новое число месяцев. Реальные платежи не
--    трогаются. SECURITY DEFINER, т.к. прямое удаление строк платежей
--    менеджерам запрещено политиками.
--
-- Файл идемпотентный — можно выполнять повторно.

create or replace function crm.log_change()
returns trigger
language plpgsql
security definer
set search_path = crm, public
as $$
declare
  v_changed jsonb;
  v_details jsonb;
  v_label jsonb;
begin
  if TG_OP = 'INSERT' then
    insert into crm.audit_log (actor_id, action, entity_type, entity_id, details)
    values (auth.uid(), 'create', TG_ARGV[0], NEW.id, to_jsonb(NEW));
    return NEW;
  end if;

  -- UPDATE: записываем только реально изменённые поля; пустые правки
  -- (сохранили не поменяв ничего) в журнал не попадают.
  select jsonb_object_agg(n.key, n.value)
  into v_changed
  from jsonb_each(to_jsonb(NEW)) n
  where to_jsonb(OLD) -> n.key is distinct from n.value;

  if v_changed is null then
    return NEW;
  end if;

  v_label := jsonb_strip_nulls(jsonb_build_object(
    'name', to_jsonb(NEW) ->> 'name',
    'number', to_jsonb(NEW) ->> 'number',
    'amount', to_jsonb(NEW) -> 'amount'
  ));
  v_details := jsonb_build_object('changed', v_changed) || v_label;

  insert into crm.audit_log (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'update', TG_ARGV[0], NEW.id, v_details);
  return NEW;
end;
$$;

drop trigger if exists trg_log_change_contracts on crm.contracts;
create trigger trg_log_change_contracts
after insert or update on crm.contracts
for each row execute function crm.log_change('contract');

drop trigger if exists trg_log_change_contract_payments on crm.contract_payments;
create trigger trg_log_change_contract_payments
after insert or update on crm.contract_payments
for each row execute function crm.log_change('contract_payment');

drop trigger if exists trg_log_change_clients on crm.clients;
create trigger trg_log_change_clients
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
