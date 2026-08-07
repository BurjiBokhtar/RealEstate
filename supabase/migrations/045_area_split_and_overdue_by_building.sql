-- ============================================================
-- 045: данные под новые графики.
--
--  1. Площадь по статусам — чтобы «Общая площадь / Осталось в продаже»
--     перестали быть двумя плитками и стали одним кольцом «продано /
--     забронировано / в продаже». Раньше отдавались только total и
--     available, а проданной площади не было вовсе — её нельзя было
--     получить вычитанием, потому что между ними ещё брони и «в работе».
--
--  2. Просрочка с разбивкой по ЖК и фильтром по ЖК — страница «Должники»
--     показывает просрочку графиком по объектам, и в фильтре появляется
--     выбор ЖК.
--
-- ВНИМАНИЕ на DROP. У overdue_contracts/overdue_totals меняется И состав
-- колонок, И сигнатура (появляется параметр). Ни то, ни другое
-- `create or replace` не умеет: по колонкам Postgres отвечает «cannot
-- change return type», а добавление параметра со значением по умолчанию
-- создало бы ВТОРУЮ перегрузку — и вызов без аргументов стал бы
-- неоднозначным. Поэтому обе удаляются явно.
--
-- Файл идемпотентный -- можно запускать повторно.
-- ============================================================

-- ---- 1. Просрочка по ЖК ----

drop function if exists crm.overdue_contracts();
drop function if exists crm.overdue_contracts(uuid);
create function crm.overdue_contracts(p_building_id uuid default null)
returns table (
  contract_id uuid,
  contract_number text,
  client_id uuid,
  client_name text,
  client_phone text,
  object_name text,
  building_id uuid,
  building_name text,
  currency text,
  missed_count int,
  total_overdue numeric,
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
    o.building_id,
    b.name,
    c.currency::text,
    (count(*))::int,
    sum(oi.unpaid_amount),
    greatest(c.amount - c.paid_amount, 0),
    min(oi.due_date),
    max(oi.due_date)
  from crm.overdue_installments oi
  join crm.contracts c on c.id = oi.contract_id
  left join crm.clients   cl on cl.id = c.client_id
  left join crm.objects   o  on o.id = c.object_id
  left join crm.buildings b  on b.id = o.building_id
  where oi.due_date < current_date
    and oi.unpaid_amount > 0.005
    and (p_building_id is null or o.building_id = p_building_id)
  group by c.id, c.number, cl.id, cl.name, cl.phone, o.name, o.building_id, b.name,
           c.currency, c.amount, c.paid_amount
  order by sum(oi.unpaid_amount) desc, c.id;
$$;

grant execute on function crm.overdue_contracts(uuid) to authenticated;


drop function if exists crm.overdue_totals();
drop function if exists crm.overdue_totals(uuid);
create function crm.overdue_totals(p_building_id uuid default null)
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
    left join crm.objects o on o.id = c.object_id
    where oi.due_date < current_date
      and oi.unpaid_amount > 0.005
      and (p_building_id is null or o.building_id = p_building_id)
    group by c.id, c.currency, c.amount, c.paid_amount
  )
  select currency::text, (count(*))::int, sum(overdue), sum(remaining)
  from per_contract
  group by currency
  order by sum(overdue) desc;
$$;

grant execute on function crm.overdue_totals(uuid) to authenticated;


-- Просрочка, сгруппированная по ЖК: ровно то, что рисует график на
-- странице должников. Объекты без ЖК собираются в одну строку с NULL --
-- терять их нельзя, долг есть долг.
drop function if exists crm.overdue_by_building();
create function crm.overdue_by_building()
returns table (
  building_id uuid,
  building_name text,
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
    o.building_id,
    coalesce(b.name, '—'),
    c.currency::text,
    (count(distinct c.id))::int,
    sum(oi.unpaid_amount)
  from crm.overdue_installments oi
  join crm.contracts c on c.id = oi.contract_id
  left join crm.objects   o on o.id = c.object_id
  left join crm.buildings b on b.id = o.building_id
  where oi.due_date < current_date
    and oi.unpaid_amount > 0.005
  group by o.building_id, b.name, c.currency
  order by sum(oi.unpaid_amount) desc;
$$;

grant execute on function crm.overdue_by_building() to authenticated;


-- ---- 2. Площадь по статусам в dashboard_summary ----

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
    coalesce(sum(area), 0)                                      as area_total,
    coalesce(sum(area) filter (where status = 'available'), 0)   as area_available,
    coalesce(sum(area) filter (where status = 'reserved'), 0)    as area_reserved,
    coalesce(sum(area) filter (where status = 'sold'), 0)        as area_sold,
    coalesce(sum(area) filter (where status = 'rented'), 0)      as area_rented,
    coalesce(sum(area) filter (where status = 'in_progress'), 0) as area_in_progress,
    coalesce(sum(price) filter (where status = 'available' and currency <> 'USD'), 0) as pot_tjs,
    coalesce(sum(price) filter (where status = 'available' and currency  = 'USD'), 0) as pot_usd,
    (count(*) filter (where status = 'available' and price is not null and price > 0))::int
      as pot_units,
    (count(*) filter (where status = 'available' and (price is null or price = 0)))::int
      as pot_no_price
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
overdue as (
  select
    coalesce(sum(oi.unpaid_amount) filter (where c.currency <> 'USD'), 0) as tjs,
    coalesce(sum(oi.unpaid_amount) filter (where c.currency  = 'USD'), 0) as usd,
    (count(distinct c.id))::int                                          as contracts
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
  'area_split', (
    select jsonb_build_object(
      'sold', area_sold, 'reserved', area_reserved, 'available', area_available,
      'rented', area_rented, 'in_progress', area_in_progress
    ) from obj_stats
  ),
  'potential', (select jsonb_build_object('tjs', pot_tjs, 'usd', pot_usd) from obj_stats),
  'potential_units', (select pot_units from obj_stats),
  'potential_no_price', (select pot_no_price from obj_stats),
  'paid', (select jsonb_build_object('tjs', paid_tjs, 'usd', paid_usd) from money),
  'debt', (select jsonb_build_object('tjs', debt_tjs, 'usd', debt_usd) from money),
  'overdue', (select jsonb_build_object('tjs', tjs, 'usd', usd) from overdue),
  'overdue_contracts', (select contracts from overdue),
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
