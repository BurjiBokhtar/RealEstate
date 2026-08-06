-- ============================================================
-- 043: настоящая просрочка — с учётом уже поступивших денег.
--
-- ЧТО БЫЛО НЕ ТАК. Строки графика рассрочки НИКОГДА не помечаются
-- оплаченными. Платёж записывается ОТДЕЛЬНОЙ строкой (paid = true), а
-- строки плана так и остаются paid = false навсегда. Покрытие считает
-- интерфейс: полученные деньги ложатся на план по очереди, от самой
-- старой строки к новой (см. allocatePlan в ContractPayments).
--
-- А страница «Должники» и плитка «Просрочено» на дашборде считали
-- просроченной КАЖДУЮ строку плана с прошедшим сроком — независимо от
-- того, закрыта она деньгами или нет. То есть клиент, аккуратно
-- плативший два года, всё равно висел в должниках с «21 просроченным
-- платежом» и суммой всего графика. Отсюда и цифры, которые не сходятся
-- с реальностью.
--
-- КАК СЧИТАЕМ ТЕПЕРЬ. Ровно та же раскладка, что и в интерфейсе, только
-- в SQL:
--   pool  = paid_amount - (amount - plan_total)
--           то есть поступившие деньги за вычетом первоначального взноса
--           (той части договора, которой в графике никогда не было);
--   для каждой строки плана по возрастанию срока считаем нарастающий
--   итог cum, и непокрытый остаток строки = clamp(cum - pool, 0, amount).
-- Просрочено = непокрытые остатки строк, срок которых уже прошёл.
--
-- Никаких пеней и процентов: просрочка — это ровно те деньги по графику,
-- которые ещё не поступили. Ничего сверху не начисляется.
--
-- Файл идемпотентный -- можно запускать повторно.
-- ============================================================

-- Одна общая раскладка для всех потребителей: и «Должники», и дашборд
-- должны показывать одно и то же число.
--
-- security_invoker: представление читается правами вызывающего, значит RLS
-- (и ограничение менеджера своими ЖК) работает как обычно.
drop view if exists crm.overdue_installments cascade;
create view crm.overdue_installments
with (security_invoker = on)
as
with plan as (
  select
    p.id,
    p.contract_id,
    p.due_date,
    p.amount,
    sum(p.amount) over (
      partition by p.contract_id
      order by p.due_date, p.id
      rows between unbounded preceding and current row
    ) as cum
  from crm.contract_payments p
  where not p.paid
),
ctx as (
  select
    c.id                          as contract_id,
    c.amount                      as contract_amount,
    c.paid_amount,
    coalesce(sum(pl.amount), 0)   as plan_total
  from crm.contracts c
  left join plan pl on pl.contract_id = c.id
  where c.status <> 'cancelled'
  group by c.id, c.amount, c.paid_amount
)
select
  pl.id            as payment_id,
  pl.contract_id,
  pl.due_date,
  pl.amount        as scheduled_amount,
  -- Непокрытый остаток именно этой строки после раскладки поступлений.
  least(
    pl.amount,
    greatest(pl.cum - greatest(ctx.paid_amount - (ctx.contract_amount - ctx.plan_total), 0), 0)
  ) as unpaid_amount
from plan pl
join ctx on ctx.contract_id = pl.contract_id;

grant select on crm.overdue_installments to authenticated;


-- Строка на договор: только реально не закрытые просроченные платежи.
--
-- drop, а не только `create or replace`: у функции появилась новая колонка
-- remaining_total, а менять состав OUT-параметров заменой нельзя --
-- Postgres отвечает «cannot change return type of existing function».
drop function if exists crm.overdue_contracts();
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
  -- Весь остаток по договору, не только просроченная часть: на экране
  -- эти два числа больше не должны путаться друг с другом.
  remaining_total numeric,
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
    sum(oi.unpaid_amount),
    greatest(c.amount - c.paid_amount, 0),
    min(oi.due_date),
    max(oi.due_date)
  from crm.overdue_installments oi
  join crm.contracts c on c.id = oi.contract_id
  left join crm.clients cl on cl.id = c.client_id
  left join crm.objects  o  on o.id = c.object_id
  where oi.due_date < current_date
    -- Копейки округления — не долг.
    and oi.unpaid_amount > 0.005
  group by c.id, c.number, cl.id, cl.name, cl.phone, o.name, c.currency, c.amount, c.paid_amount
  order by sum(oi.unpaid_amount) desc, c.id;
$$;

grant execute on function crm.overdue_contracts() to authenticated;


-- Та же история: добавился remaining_total.
drop function if exists crm.overdue_totals();
create or replace function crm.overdue_totals()
returns table (
  currency text,
  contracts int,
  total_overdue numeric,
  remaining_total numeric
)
language sql
stable
security invoker
set search_path = crm, public
as $$
  with per_contract as (
    select
      c.id,
      c.currency,
      sum(oi.unpaid_amount)                  as overdue,
      greatest(c.amount - c.paid_amount, 0)  as remaining
    from crm.overdue_installments oi
    join crm.contracts c on c.id = oi.contract_id
    where oi.due_date < current_date
      and oi.unpaid_amount > 0.005
    group by c.id, c.currency, c.amount, c.paid_amount
  )
  select
    currency::text,
    (count(*))::int,
    sum(overdue),
    sum(remaining)
  from per_contract
  group by currency
  order by sum(overdue) desc;
$$;

grant execute on function crm.overdue_totals() to authenticated;


-- Плитка «Просрочено» на дашборде считала так же неверно, как и страница
-- должников. Пересобираем dashboard_summary с той же раскладкой -- иначе
-- два экрана показывали бы разные числа про одно и то же.
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
scoped_objects as (
  select o.id, o.status, o.building_id, o.price, o.currency, o.area
  from crm.objects o
  left join crm.buildings b on b.id = o.building_id
  where case
          when p_building_id is not null then o.building_id = p_building_id
          else coalesce(b.construction_status, 'in_progress') <> 'completed'
        end
),
scoped_contracts as (
  select c.id, c.client_id, c.amount, c.paid_amount, c.currency,
         c.signed_date, c.status, so.building_id
  from crm.contracts c
  join scoped_objects so on so.id = c.object_id
),
live_contracts as (
  select *
  from scoped_contracts
  where status <> 'cancelled'
    and (p_from is null or (signed_date is not null and signed_date >= p_from))
    and (p_to   is null or (signed_date is not null and signed_date <= p_to))
),
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
    coalesce(sum(price) filter (where status = 'available' and currency <> 'USD'), 0) as pot_tjs,
    coalesce(sum(price) filter (where status = 'available' and currency  = 'USD'), 0) as pot_usd
  from scoped_objects
),
money as (
  select
    coalesce(sum(paid_amount) filter (where currency <> 'USD'), 0) as paid_tjs,
    coalesce(sum(paid_amount) filter (where currency  = 'USD'), 0) as paid_usd,
    coalesce(sum(greatest(amount - paid_amount, 0)) filter (where currency <> 'USD'), 0) as debt_tjs,
    coalesce(sum(greatest(amount - paid_amount, 0)) filter (where currency  = 'USD'), 0) as debt_usd
  from live_contracts
),
-- Просрочка по той же раскладке, что и на странице должников.
overdue as (
  select
    coalesce(sum(oi.unpaid_amount) filter (where c.currency <> 'USD'), 0) as tjs,
    coalesce(sum(oi.unpaid_amount) filter (where c.currency  = 'USD'), 0) as usd
  from crm.overdue_installments oi
  join scoped_contracts c on c.id = oi.contract_id
  where oi.due_date < current_date
    and oi.unpaid_amount > 0.005
    and c.status <> 'cancelled'
),
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
