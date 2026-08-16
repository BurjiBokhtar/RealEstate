-- ============================================================
-- 048: смена цены за 1 м² здания пересчитывает квартиры.
--
-- ЧТО БЫЛО НЕ ТАК. buildings.price_per_sqm участвовал ровно в одном месте —
-- в конструкторе этажей, когда квартиры ТОЛЬКО создаются: там один раз
-- считалось objects.price = area * price_per_sqm и записывалось в квартиру.
-- Дальше связи не было никакой. Админ менял цену за метр в карточке здания,
-- в базе менялось одно число в одной строке — и всё. Шахматка показывает
-- objects.price каждой квартиры, поэтому она честно показывала старые
-- суммы: их никто не пересчитывал.
--
-- ПОЧЕМУ ИМЕННО ФУНКЦИЯ В БАЗЕ. Это уже пробовали сделать из программы
-- (коммит 65fbb56, откачен коммитом 1b16dd2: собиралось без ошибок, но на
-- живом сайте не срабатывало, причину тогда не нашли). Тот вариант слал
-- обычные REST-запросы вида PATCH objects?id=in.(...), перечисляя id
-- квартир прямо в адресе — по ~37 символов на каждую, до 100 штук в
-- запросе. Это адрес длиной под 4 КБ, а шлюзы (Vercel, Cloudflare) режут
-- такие адреса. Отсюда и «собирается, но ничего не меняет».
--
-- Здесь никакого списка id нет вообще: один UPDATE внутри базы, отбор по
-- building_id. Длина запроса не зависит от числа квартир, и выполняется он
-- либо целиком, либо никак.
--
-- ЧТО НЕ ТРОГАЕТСЯ:
--   * проданные (status = 'sold') — цена продажи зафиксирована сделкой;
--   * квартиры без площади — считать не из чего (area * ставка = NULL);
--   * квартиры в долларах — ставка в карточке здания указана в сомони
--     (так и написано на самом поле), умножать на неё цену в USD нельзя.
--   Каждая такая группа возвращается отдельным счётчиком, чтобы программа
--   сказала о них вслух, а не молча пропустила.
--
-- ДОГОВОРЫ НЕ ЗАТРАГИВАЮТСЯ. У contracts своя сумма (contracts.amount), она
-- живёт отдельно от objects.price. Пересчёт цены забронированной квартиры
-- НЕ переписывает сумму уже подписанного договора.
--
-- ПРАВА. SECURITY INVOKER (по умолчанию) — намеренно. Политика
-- objects_update разрешает не-админу менять только свободные квартиры
-- (status = 'available'), и через эту функцию это ограничение остаётся в
-- силе: строки, на которые у вызывающего нет прав, просто не попадут в
-- UPDATE. SECURITY DEFINER здесь дал бы любому сотруднику право
-- переоценить забронированные квартиры чужого дома.
--
-- Идемпотентно, повторный запуск безопасен.
-- ============================================================

-- Тип результата может меняться при доработках, а PostgreSQL не разрешает
-- менять его через create or replace — поэтому сначала снимаем старую.
drop function if exists crm.reprice_building_units(uuid, numeric);

create function crm.reprice_building_units(
  p_building_id uuid,
  p_price_per_sqm numeric
)
returns table (
  repriced integer,
  skipped_sold integer,
  skipped_no_area integer,
  skipped_currency integer
)
language plpgsql
as $$
declare
  v_repriced integer;
begin
  if p_price_per_sqm is null or p_price_per_sqm <= 0 then
    raise exception 'Цена за 1 м² должна быть больше нуля';
  end if;

  with updated as (
    update crm.objects
    set price = round(area * p_price_per_sqm, 2)
    where building_id = p_building_id
      and status <> 'sold'
      and currency = 'TJS'
      and area is not null
      and area > 0
    returning 1
  )
  select count(*)::integer into v_repriced from updated;

  return query
  select
    v_repriced,
    (
      select count(*)::integer
      from crm.objects
      where building_id = p_building_id
        and status = 'sold'
    ),
    (
      select count(*)::integer
      from crm.objects
      where building_id = p_building_id
        and status <> 'sold'
        and currency = 'TJS'
        and (area is null or area <= 0)
    ),
    (
      select count(*)::integer
      from crm.objects
      where building_id = p_building_id
        and status <> 'sold'
        and currency <> 'TJS'
    );
end;
$$;

grant execute on function crm.reprice_building_units(uuid, numeric) to authenticated;
