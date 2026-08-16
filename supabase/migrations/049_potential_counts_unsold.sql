-- ============================================================
-- 049: «Потенциал непроданных» считает непроданные, а не только свободные.
--
-- ЧТО БЫЛО НЕ ТАК. Карточка называется «Потенциал непроданных», а сумма под
-- ней бралась по фильтру status = 'available' — то есть только по СВОБОДНЫМ.
-- Забронированные и «в работе» давали ровно ноль, хотя ни одна из них не
-- продана. Отсюда и ощущение неверного числа: подпись обещает одно, а
-- арифметика считает другое. Старый вариант подписи это признавал открыто —
-- там было написано «по N СВОБОДНЫМ квартирам».
--
-- Напоминание, почему «забронирована» здесь означает «денег ещё не было»:
-- recompute_object_status ставит 'sold', как только по договору прошёл хоть
-- один платёж (paid_amount > 0), и 'reserved' — пока не прошёл ни одного.
-- Значит забронированная квартира — это ещё не выручка, и её место именно в
-- потенциале.
--
-- ЧТО МЕНЯЕТСЯ. Ровно четыре фильтра внутри obj_stats: сумма в сомони, сумма
-- в долларах, счётчик квартир с ценой и счётчик квартир без цены. Везде
-- status = 'available' заменено на status <> 'sold'. Всё остальное в функции
-- не тронуто, включая счётчики статусов и площади.
--
-- Из непроданных исключается только продано. Статус 'rented' формально тоже
-- останется в сумме, но в этой базе его никто не ставит: автоматика знает
-- только available / reserved / sold.
--
-- Число на дашборде после этого ВЫРАСТЕТ — это ожидаемо, в него войдёт вся
-- непроданная площадь, а не одна свободная.
--
-- Идемпотентно, повторный запуск безопасен.
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
    coalesce(sum(price) filter (where status <> 'sold' and currency <> 'USD'), 0) as pot_tjs,
    coalesce(sum(price) filter (where status <> 'sold' and currency  = 'USD'), 0) as pot_usd,
    (count(*) filter (where status <> 'sold' and price is not null and price > 0))::int
      as pot_units,
    (count(*) filter (where status <> 'sold' and (price is null or price = 0)))::int
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
-- The end of the window: the last month that actually has a signing, so the
-- chart lands where the data is even if the newest contract is not this month.
month_end as (
  select coalesce(
           date_trunc('month', max(signed_date)),
           date_trunc('month', current_date)
         ) as m
  from scoped_contracts
  where status <> 'cancelled' and signed_date is not null
),
-- Six consecutive calendar months. A month with no sales must be a zero on the
-- axis, not a missing point.
month_axis as (
  select to_char(g, 'YYYY-MM') as month
  from month_end me,
       generate_series(me.m - interval '5 months', me.m, interval '1 month') as g
),
month_rev as (
  select
    ax.month,
    coalesce(sum(c.amount) filter (where c.currency <> 'USD'), 0) as tjs,
    coalesce(sum(c.amount) filter (where c.currency  = 'USD'), 0) as usd
  from month_axis ax
  left join scoped_contracts c
         on c.status <> 'cancelled'
        and c.signed_date is not null
        and to_char(c.signed_date, 'YYYY-MM') = ax.month
  group by ax.month
  order by ax.month
),
-- Same treatment for the daily chart: every day in the chosen period appears,
-- including the ones with no money received.
day_axis as (
  select g::date as day
  from generate_series(
         coalesce(p_from, current_date),
         coalesce(p_to, current_date),
         interval '1 day'
       ) as g
  where p_from is not null and p_to is not null
),
day_rev as (
  select
    ax.day,
    coalesce(sum(p.amount) filter (where c.currency <> 'USD'), 0) as tjs,
    coalesce(sum(p.amount) filter (where c.currency  = 'USD'), 0) as usd
  from day_axis ax
  left join crm.contract_payments p
         on p.paid and p.paid_date = ax.day
  left join scoped_contracts c on c.id = p.contract_id
  group by ax.day
  order by ax.day
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
