-- ============================================================
-- 056: разовая чистка всех договоров, у которых график уже разошёлся с
-- суммой ДО того, как появился автоматический триггер (055).
--
-- ПОЧЕМУ ОТДЕЛЬНЫЙ ФАЙЛ, А НЕ КНОПКА «ПЕРЕСЧИТАТЬ ГРАФИК» НА КАЖДОМ
-- ДОГОВОРЕ. Триггер 055 видит только НОВЫЕ изменения суммы — тем
-- договорам, у которых расхождение накопилось раньше (сумму меняли до
-- того, как триггер появился), он ничем не помогает: пересчитывать их
-- задним числом руками, открывая каждый по одному, при десятках и сотнях
-- договоров — не работа для человека, а работа для одного запроса.
--
-- ПОЧЕМУ НЕ ВЫЗЫВАЕТСЯ crm.regenerate_schedule() НАПРЯМУЮ. Эта функция
-- сама проверяет право на запись (crm.can_write()) через auth.uid() —
-- правильно для действия из программы, где есть авторизованный
-- пользователь. Но в SQL Editor запрос выполняется без такой сессии,
-- auth.uid() там пустой, my_role() падает на 'none', can_write() — false,
-- и вызов regenerate_schedule закончился бы «Read-only role». Поэтому
-- здесь та же самая арифметика (переписана из regenerate_schedule один в
-- один) выполняется прямыми командами, без проверки роли — сам факт того,
-- что администратор запускает файл в SQL Editor, уже и есть разрешение.
--
-- КОГО ТРОГАЕТ. Только договоры с рассрочкой, у которых сумма ГРАФИКА
-- (оплачено + план) не совпадает с суммой ДОГОВОРА больше чем на 50 дирам/
-- центов, есть хоть одна неоплаченная строка и новую сумму есть на что
-- распределять (amount > paid_amount). Уже верные договоры не трогает
-- совсем — RAISE NOTICE в конце покажет, сколько именно исправлено.
--
-- Оплаченные платежи не удаляются и не пересоздаются никогда.
--
-- Идемпотентно: повторный запуск на уже исправленных договорах найдёт
-- ноль расхождений и ничего не сделает.
-- ============================================================

do $$
declare
  v_contract record;
  v_remaining numeric;
  v_base numeric;
  v_amount numeric;
  i integer;
  v_fixed integer := 0;
begin
  for v_contract in
    select c.id, c.amount, c.paid_amount, c.installment_months
    from crm.contracts c
    where c.payment_type = 'installment'
      and c.installment_months is not null
      and c.installment_months > 0
      and c.amount > c.paid_amount
      and exists (
        select 1 from crm.contract_payments p
        where p.contract_id = c.id and p.paid = false
      )
      and abs(
        coalesce((select sum(p.amount) from crm.contract_payments p where p.contract_id = c.id), 0)
        - c.amount
      ) > 0.5
  loop
    v_remaining := v_contract.amount - v_contract.paid_amount;

    -- Только план; фактические (оплаченные) строки неприкосновенны -- та же
    -- гарантия, что и в crm.regenerate_schedule.
    delete from crm.contract_payments
    where contract_id = v_contract.id and paid = false;

    v_base := floor(v_remaining / v_contract.installment_months * 100) / 100;
    for i in 1..v_contract.installment_months loop
      if i = v_contract.installment_months then
        v_amount := round((v_remaining - v_base * (v_contract.installment_months - 1)) * 100) / 100;
      else
        v_amount := v_base;
      end if;
      insert into crm.contract_payments (contract_id, due_date, amount, paid, paid_date)
      values (v_contract.id, (current_date + (i || ' month')::interval)::date, v_amount, false, null);
    end loop;

    v_fixed := v_fixed + 1;
  end loop;

  raise notice 'Пересчитано договоров с разошедшимся графиком: %', v_fixed;
end $$;
