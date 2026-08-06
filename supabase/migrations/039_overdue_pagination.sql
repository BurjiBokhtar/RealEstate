-- ============================================================
-- 039: пагинация страницы «Должники».
--
-- 038 убрал главный потолок: список стал СТРОКОЙ НА ДОГОВОР вместо
-- строки на каждый просроченный взнос, и это сразу в 20-30 раз меньше
-- строк. Но потолок PostgREST в 1000 строк никуда не делся -- он просто
-- отодвинулся: когда договоров в просрочке станет больше тысячи,
-- список снова начнёт молча обрываться. Поэтому страница переходит на
-- постраничную выдачу, как «Клиенты» и «Объекты».
--
-- Здесь две правки под это:
--
-- 1. crm.overdue_contracts() пересоздаётся с УСТОЙЧИВОЙ сортировкой.
--    Раньше было просто `order by sum(p.amount) desc`. Для одного
--    запроса этого хватало, но для пагинации -- нет: два договора с
--    ОДИНАКОВОЙ суммой долга Postgres может вернуть в любом порядке, и
--    порядок этот может отличаться между запросом первой страницы и
--    запросом второй. На практике это значит, что один должник
--    показался бы на обеих страницах, а другой не показался бы нигде.
--    Добавлен c.id вторым ключом -- он уникален, поэтому порядок
--    становится полным и воспроизводимым.
--
-- 2. crm.overdue_totals() -- итоги по валютам для плашек над таблицей.
--    Их принципиально нельзя сложить из одной страницы: на экране 25
--    договоров из, скажем, 1200, а в шапке должна стоять сумма долга по
--    ВСЕМ. Считается отдельным агрегатом по всей выборке.
--
-- SECURITY INVOKER -- как и всё в 038: видимость должников ограничена
-- назначенными менеджеру ЖК через RLS.
--
-- Файл идемпотентный -- можно запускать повторно.
-- ============================================================

create or replace function crm.overdue_contracts()
returns table (
  contract_id uuid,
  contract_number text,
  client_id uuid,
  client_name text,
  client_phone text,
  object_name text,
  currency text,
  missed_count int,
  total_overdue numeric,
  earliest_due date,
  latest_due date
)
language sql
stable
security invoker
set search_path = crm, public
as $$
  select
    c.id,
    c.number,
    cl.id,
    coalesce(cl.name, '—'),
    cl.phone,
    o.name,
    c.currency::text,
    (count(*))::int,
    sum(p.amount),
    min(p.due_date),
    max(p.due_date)
  from crm.contract_payments p
  join crm.contracts c on c.id = p.contract_id
  left join crm.clients cl on cl.id = c.client_id
  left join crm.objects  o  on o.id = c.object_id
  where not p.paid
    and p.due_date < current_date
    -- Остатки графика по расторгнутому договору — это не долг.
    and c.status <> 'cancelled'
  group by c.id, c.number, cl.id, cl.name, cl.phone, o.name, c.currency
  -- Самый большой долг сверху: с него и начинают обзвон. c.id вторым
  -- ключом -- чтобы порядок был полным и страницы не «плавали».
  order by sum(p.amount) desc, c.id;
$$;

grant execute on function crm.overdue_contracts() to authenticated;


create or replace function crm.overdue_totals()
returns table (
  currency text,
  contracts int,
  total_overdue numeric
)
language sql
stable
security invoker
set search_path = crm, public
as $$
  select
    c.currency::text,
    -- distinct: строк здесь по одной на ВЗНОС, а считаем договоры.
    (count(distinct c.id))::int,
    sum(p.amount)
  from crm.contract_payments p
  join crm.contracts c on c.id = p.contract_id
  where not p.paid
    and p.due_date < current_date
    and c.status <> 'cancelled'
  group by c.currency
  order by sum(p.amount) desc;
$$;

grant execute on function crm.overdue_totals() to authenticated;
