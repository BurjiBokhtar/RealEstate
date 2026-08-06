-- ============================================================
-- 042: остаток долга считается ПО ИСТОРИИ ПЛАТЕЖЕЙ, а не хранится
--      отдельным числом, которое можно перезаписать руками.
--
-- ЧТО БЫЛО НЕ ТАК. contracts.paid_amount — обычная колонка, и её
-- значение поддерживалось вручную из трёх разных мест:
--
--   * crm.record_payment() прибавлял сумму нового платежа,
--   * crm.delete_payment() вычитал сумму удалённого,
--   * форма договора ПРОСТО ЗАПИСЫВАЛА туда то, что стояло в поле
--     «Оплачено» (а его ещё и пересчитывал ползунок процентов).
--
-- Пока договор не трогали, три источника совпадали. Но стоило открыть
-- «Изменить договор» и сохранить — и в paid_amount уезжало значение из
-- формы, никак не связанное с реальными чеками. Строки платежей при
-- этом оставались на месте: история есть, а «Оплачено» и «Остаток» её
-- больше не отражают. Ровно то, на что жалуется пользователь.
--
-- КАК ЧИНИМ. Единственный источник правды — строки crm.contract_payments
-- с paid = true. Триггер пересчитывает paid_amount при любом изменении
-- этих строк, а обе RPC перестают считать сами (иначе к пересчёту
-- добавилась бы ещё и ручная арифметика — и сумма удвоилась бы).
--
-- ПРО СТАРЫЕ ДАННЫЕ. Разовый пересчёт в конце файла НЕ обнуляет деньги.
-- Если у договора paid_amount больше суммы его чеков (так бывает у
-- договоров, заведённых до того, как первоначальный взнос стали
-- записывать отдельной строкой), разница не стирается, а материализуется
-- как настоящий платёж — датой подписания. Только после этого paid_amount
-- пересчитывается по строкам. Терять уже полученные деньги нельзя.
--
-- Файл идемпотентный -- можно запускать повторно.
-- ============================================================

create or replace function crm.sync_contract_paid_amount()
returns trigger
language plpgsql
security definer
set search_path = crm, public
as $$
declare
  v_contract_id uuid;
begin
  -- Именно через tg_op, а не coalesce(new.…, old.…): при DELETE запись new
  -- вообще не назначена, и обращение к её полю — ошибка выполнения, а не
  -- NULL. Удаление платежа падало бы.
  if tg_op = 'DELETE' then
    v_contract_id := old.contract_id;
  else
    v_contract_id := new.contract_id;
  end if;

  update crm.contracts c
  set paid_amount = coalesce(
    (select sum(p.amount) from crm.contract_payments p
      where p.contract_id = c.id and p.paid),
    0
  )
  where c.id = v_contract_id;

  if tg_op = 'UPDATE' and old.contract_id is distinct from new.contract_id then
    update crm.contracts c
    set paid_amount = coalesce(
      (select sum(p.amount) from crm.contract_payments p
        where p.contract_id = c.id and p.paid),
      0
    )
    where c.id = old.contract_id;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_sync_contract_paid_amount on crm.contract_payments;
create trigger trg_sync_contract_paid_amount
after insert or update or delete on crm.contract_payments
for each row execute function crm.sync_contract_paid_amount();


-- record_payment: та же проверка прав и та же вставка, но БЕЗ ручного
-- прибавления к paid_amount — теперь это делает триггер выше.
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

  return v_payment;
end;
$$;

grant execute on function crm.record_payment(uuid, numeric, date) to authenticated;


-- delete_payment: то же самое, вычитание убрано.
create or replace function crm.delete_payment(p_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = crm, public
as $$
begin
  if not crm.is_admin() then
    raise exception 'Only an admin can delete a payment';
  end if;

  delete from crm.contract_payments where id = p_payment_id;
end;
$$;

grant execute on function crm.delete_payment(uuid) to authenticated;


-- ---- Разовое приведение старых данных в порядок ----

-- 1) Деньги, которые числятся на договоре, но не подтверждены ни одной
--    строкой платежа, становятся настоящим платежом. Иначе пересчёт ниже
--    просто стёр бы их.
insert into crm.contract_payments (contract_id, due_date, amount, paid, paid_date)
select
  c.id,
  coalesce(c.signed_date, c.created_at::date),
  c.paid_amount - coalesce(paid.total, 0),
  true,
  coalesce(c.signed_date, c.created_at::date)
from crm.contracts c
left join lateral (
  select sum(p.amount) as total
  from crm.contract_payments p
  where p.contract_id = c.id and p.paid
) paid on true
where c.paid_amount - coalesce(paid.total, 0) > 0.005;

-- 2) Теперь строки — единственный источник правды: пересчитать всё.
update crm.contracts c
set paid_amount = coalesce(
  (select sum(p.amount) from crm.contract_payments p
    where p.contract_id = c.id and p.paid),
  0
)
where c.paid_amount is distinct from coalesce(
  (select sum(p.amount) from crm.contract_payments p
    where p.contract_id = c.id and p.paid),
  0
);
