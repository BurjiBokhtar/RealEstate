-- ============================================================
-- 038: crm.dashboard_summary() — весь дашборд одним запросом,
--      посчитанным в базе.
--
-- ЗАЧЕМ. Дашборд тянул crm.objects, crm.contracts и crm.contract_payments
-- ЦЕЛИКОМ в браузер и складывал суммы в JavaScript. Пока объектов пара
-- сотен, это просто медленно. Но PostgREST по умолчанию отдаёт максимум
-- 1000 строк на запрос -- и как только объектов (или договоров, или
-- платежей) станет больше тысячи, лишние строки молча отбрасываются.
-- Ошибки при этом НЕ будет: площади, выручка, долги и заполняемость
-- просто начнут показывать неправду. Считать надо в SQL -- Postgres
-- агрегирует по индексам и отдаёт десяток чисел вместо десятков тысяч
-- строк.
--
-- БЕЗОПАСНОСТЬ. Функция намеренно SECURITY INVOKER (в отличие от
-- crm.sales_by_manager, которая definer + явная проверка роли). Дашборд
-- открыт всем сотрудникам, а видимость данных у менеджера ограничена
-- назначенными ему ЖК через RLS (crm.can_view_building). SECURITY
-- DEFINER обошёл бы эти политики и показал бы менеджеру цифры по всей
-- компании. С invoker политики применяются как обычно, поэтому функция
-- возвращает ровно тот же срез данных, который пользователь и так мог
-- бы прочитать сам. Пользователю без роли RLS не отдаст ничего -- он
-- увидит нули.
--
-- ПАРАМЕТРЫ.
--   p_building_id — NULL: все ЖК, кроме сданных ('completed'); иначе
--                   только этот ЖК (в том числе если он сдан).
--   p_from/p_to   — отчётный период по дате подписания договора. NULL =
--                   вся история. Период влияет только на «денежные»
--                   цифры (выручка, долг, должники, выручка по ЖК) --
--                   остатки на складе (количества, площади, заполняемость)
--                   и просрочка периодом не режутся, ровно как и раньше
--                   в интерфейсе.
--
-- Файл идемпотентный -- можно запускать повторно.
-- ============================================================

create or replace function crm.dashboard_summary(
  p_building_id uuid default null,
  p_from date default null,
  p_to date default null
)
returns jsonb
language sql
stable
security invoker
set search_path = crm, public
as $$
with
-- Квартиры/помещения в области видимости фильтра. Объект без ЖК
-- (building_id is null) остаётся в общей картине: он ничей, но он есть.
scoped_objects as (
  select o.id, o.status, o.building_id, o.price, o.currency, o.area
  from crm.objects o
  left join crm.buildings b on b.id = o.building_id
  where case
          when p_building_id is not null then o.building_id = p_building_id
          else coalesce(b.construction_status, 'in_progress') <> 'completed'
        end
),
-- Договоры на эти объекты. building_id тащим с собой, чтобы разложить
-- выручку по ЖК без второго join'а.
scoped_contracts as (
  select c.id, c.client_id, c.amount, c.paid_amount, c.currency,
         c.signed_date, c.status, so.building_id
  from crm.contracts c
  join scoped_objects so on so.id = c.object_id
),
-- Действующие договоры внутри отчётного периода: основа всех денежных
-- цифр. Расторгнутые не считаются нигде.
live_contracts as (
  select *
  from scoped_contracts
  where status <> 'cancelled'
    and (p_from is null or (signed_date is not null and signed_date >= p_from))
    and (p_to   is null or (signed_date is not null and signed_date <= p_to))
),
-- ЖК, попадающие в разрезы «заполняемость» и «выручка по ЖК».
rel_buildings as (
  select b.id, b.name
  from crm.buildings b
  where case
          when p_building_id is not null then b.id = p_building_id
          else b.construction_status <> 'completed'
        end
),
obj_stats as (
  select
    (count(*))::int                                             as total,
    (count(*) filter (where status = 'available'))::int         as available,
    (count(*) filter (where status = 'reserved'))::int          as reserved,
    (count(*) filter (where status = 'sold'))::int              as sold,
    (count(*) filter (where status = 'in_progress'))::int       as in_progress,
    coalesce(sum(area), 0)                                    as area_total,
    coalesce(sum(area) filter (where status = 'available'), 0) as area_available,
    -- Потенциал = прайс ещё не проданного.
    coalesce(sum(price) filter (where status = 'available' and currency <> 'USD'), 0) as pot_tjs,
    coalesce(sum(price) filter (where status = 'available' and currency  = 'USD'), 0) as pot_usd
  from scoped_objects
),
money as (
  select
    coalesce(sum(paid_amount) filter (where currency <> 'USD'), 0) as paid_tjs,
    coalesce(sum(paid_amount) filter (where currency  = 'USD'), 0) as paid_usd,
    -- greatest(...,0): переплата по одному договору не должна гасить
    -- долг по другому.
    coalesce(sum(greatest(amount - paid_amount, 0)) filter (where currency <> 'USD'), 0) as debt_tjs,
    coalesce(sum(greatest(amount - paid_amount, 0)) filter (where currency  = 'USD'), 0) as debt_usd
  from live_contracts
),
-- Просрочка: неоплаченные взносы, срок которых уже прошёл. Периодом не
-- режется -- долг просрочен независимо от того, какой период смотрят.
overdue as (
  select
    coalesce(sum(p.amount) filter (where c.currency <> 'USD'), 0) as tjs,
    coalesce(sum(p.amount) filter (where c.currency  = 'USD'), 0) as usd
  from crm.contract_payments p
  join scoped_contracts c on c.id = p.contract_id
  where not p.paid
    and p.due_date < current_date
    and c.status <> 'cancelled'
),
-- График по месяцам: последние 6 месяцев, в которых вообще были
-- подписания. Периодом не режется -- это тренд, а не отчёт.
month_rev as (
  select
    to_char(signed_date, 'YYYY-MM')                            as month,
    coalesce(sum(amount) filter (where currency <> 'USD'), 0)  as tjs,
    coalesce(sum(amount) filter (where currency  = 'USD'), 0)  as usd
  from scoped_contracts
  where status <> 'cancelled' and signed_date is not null
  group by 1
  order by 1 desc
  limit 6
),
-- График по дням: фактически принятые деньги за выбранный период.
-- Считается только когда период задан (в интерфейсе — «сегодня»/«месяц»).
day_rev as (
  select
    p.paid_date                                                 as day,
    coalesce(sum(p.amount) filter (where c.currency <> 'USD'), 0) as tjs,
    coalesce(sum(p.amount) filter (where c.currency  = 'USD'), 0) as usd
  from crm.contract_payments p
  join scoped_contracts c on c.id = p.contract_id
  where p.paid
    and p.paid_date is not null
    and p_from is not null
    and p_to is not null
    and p.paid_date between p_from and p_to
  group by 1
),
occ as (
  select
    rb.id, rb.name,
    (count(*))::int                                          as total,
    (count(*) filter (where so.status = 'available'))::int    as available,
    (count(*) filter (where so.status = 'reserved'))::int     as reserved,
    (count(*) filter (where so.status = 'sold'))::int         as sold,
    (count(*) filter (where so.status = 'rented'))::int       as rented,
    (count(*) filter (where so.status = 'in_progress'))::int  as in_progress
  from rel_buildings rb
  join scoped_objects so on so.building_id = rb.id
  group by rb.id, rb.name
),
bld_rev as (
  select
    rb.id, rb.name,
    coalesce(sum(lc.amount) filter (where lc.currency <> 'USD'), 0) as tjs,
    coalesce(sum(lc.amount) filter (where lc.currency  = 'USD'), 0) as usd
  from rel_buildings rb
  join live_contracts lc on lc.building_id = rb.id
  group by rb.id, rb.name
),
debtors as (
  select
    lc.client_id,
    cl.name,
    lc.currency::text                       as currency,
    sum(lc.amount - lc.paid_amount)         as remaining
  from live_contracts lc
  join crm.clients cl on cl.id = lc.client_id
  where lc.amount - lc.paid_amount > 0
  group by 1, 2, 3
  order by 4 desc
  limit 5
),
-- Сданные ЖК свёрнуты в одну строку «столько-то домов, столько-то
-- квартир» -- их цифры не должны перевешивать текущие продажи.
completed as (
  select
    (select count(*) from crm.buildings where construction_status = 'completed')::int as buildings,
    (select count(*)
       from crm.objects o
       join crm.buildings b on b.id = o.building_id
      where b.construction_status = 'completed')::int as units
)
select jsonb_build_object(
  'counts', (
    select jsonb_build_object(
      'total', total, 'available', available, 'reserved', reserved,
      'sold', sold, 'in_progress', in_progress
    ) from obj_stats
  ),
  'area', (select jsonb_build_object('total', area_total, 'available', area_available) from obj_stats),
  'potential', (select jsonb_build_object('tjs', pot_tjs, 'usd', pot_usd) from obj_stats),
  'paid', (select jsonb_build_object('tjs', paid_tjs, 'usd', paid_usd) from money),
  'debt', (select jsonb_build_object('tjs', debt_tjs, 'usd', debt_usd) from money),
  'overdue', (select jsonb_build_object('tjs', tjs, 'usd', usd) from overdue),
  'revenue_months', coalesce((
    select jsonb_agg(jsonb_build_object('month', month, 'tjs', tjs, 'usd', usd) order by month)
    from month_rev
  ), '[]'::jsonb),
  'revenue_days', coalesce((
    select jsonb_agg(jsonb_build_object('day', day, 'tjs', tjs, 'usd', usd) order by day)
    from day_rev
  ), '[]'::jsonb),
  'occupancy', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', id, 'name', name, 'total', total,
      'available', available, 'reserved', reserved, 'sold', sold,
      'rented', rented, 'in_progress', in_progress
    ) order by name)
    from occ
  ), '[]'::jsonb),
  'revenue_by_building', coalesce((
    select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'tjs', tjs, 'usd', usd)
                     order by (tjs + usd) desc)
    from bld_rev where tjs > 0 or usd > 0
  ), '[]'::jsonb),
  'top_debtors', coalesce((
    select jsonb_agg(jsonb_build_object(
      'client_id', client_id, 'name', name, 'currency', currency, 'remaining', remaining
    ) order by remaining desc)
    from debtors
  ), '[]'::jsonb),
  'completed', (select jsonb_build_object('buildings', buildings, 'units', units) from completed)
);
$$;

grant execute on function crm.dashboard_summary(uuid, date, date) to authenticated;

-- Индексы под ровно эти агрегаты. Без них Postgres читает таблицы
-- целиком на каждое открытие дашборда -- на больших объёмах это ровно та
-- же медленная страница, только медленная уже на сервере.
--
-- Договоры группируются по месяцу подписания и раскладываются по ЖК:
create index if not exists idx_contracts_signed_date on crm.contracts (signed_date);
-- Просрочка ищет неоплаченные взносы с истёкшим сроком, дневная выручка --
-- оплаченные по дате оплаты. Частичные индексы: по каждому флагу идёт
-- ровно один из двух запросов, и оба они узкие.
create index if not exists idx_contract_payments_unpaid_due
  on crm.contract_payments (due_date) where not paid;
create index if not exists idx_contract_payments_paid_date
  on crm.contract_payments (paid_date) where paid;
-- Срез «квартиры этого ЖК с таким-то статусом» (заполняемость, количества):
create index if not exists idx_objects_building_status
  on crm.objects (building_id, status);


-- ============================================================
-- crm.overdue_contracts() — страница «Должники», сгруппированная в базе.
--
-- Та же болезнь, что и у дашборда, только опаснее: страница тянула ВСЕ
-- неоплаченные просроченные взносы и группировала их по договору в
-- браузере. А взносов на один договор бывает 20-30 (рассрочка на два
-- года), то есть тысячный потолок PostgREST упирался уже на нескольких
-- десятках должников -- и список долгов молча становился неполным.
-- Группировка в SQL даёт СТРОКУ НА ДОГОВОР, а не на взнос.
--
-- SECURITY INVOKER — по тем же причинам, что и dashboard_summary:
-- менеджер должен видеть должников только своих ЖК.
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
  -- Самый большой долг сверху: с него и начинают обзвон.
  order by sum(p.amount) desc;
$$;

grant execute on function crm.overdue_contracts() to authenticated;


-- ============================================================
-- crm.building_unit_stats() — сводка по каждому ЖК для списка объектов.
--
-- Страница «Объекты» считала это, вычитывая все квартиры всех ЖК
-- страницами по 1000 в цикле: на 10 000 квартир — десять последовательных
-- запросов подряд только ради трёх чисел на карточку. Один group by
-- отдаёт то же самое одной строкой на ЖК.
-- ============================================================

create or replace function crm.building_unit_stats()
returns table (
  building_id uuid,
  total int,
  available int,
  available_area numeric
)
language sql
stable
security invoker
set search_path = crm, public
as $$
  select
    o.building_id,
    (count(*))::int,
    (count(*) filter (where o.status = 'available'))::int,
    coalesce(sum(o.area) filter (where o.status = 'available'), 0)
  from crm.objects o
  where o.building_id is not null
  group by o.building_id;
$$;

grant execute on function crm.building_unit_stats() to authenticated;
