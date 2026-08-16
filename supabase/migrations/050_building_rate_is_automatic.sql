-- ============================================================
-- 050: цена за 1 м² доходит до квартир САМА, без кнопок.
--
-- ЧТО БЫЛО НЕ ТАК. Цена квартиры — хранимое число, и записывалось оно ровно
-- один раз: в конструкторе этажей, в момент создания квартиры. Всё
-- остальное время связи со ставкой здания не было. Мы её чинили дважды —
-- сперва из браузера (65fbb56, откачено), потом функцией в базе (048) — и
-- оба раза пересчёт запускался ТОЛЬКО когда человек менял ставку и
-- соглашался в диалоге. Достаточно было:
--   * забыть нажать,
--   * сохранить ту же ставку (изменения нет — пересчёта нет),
--   * создать квартиру позже, когда ставка уже стояла,
--   * вписать площадь позже, чем ставку,
-- и квартира навсегда оставалась без цены. Дашборд честно суммирует
-- objects.price, поэтому такие квартиры давали ноль, а карточка «Потенциал
-- непроданных» показывала сумму по половине дома.
--
-- ЗДЕСЬ ПОДХОД ДРУГОЙ. Связь «цена квартиры = её площадь × ставка здания»
-- перестаёт быть разовым действием и становится правилом базы. Три
-- триггера закрывают три момента, когда цена может разойтись:
--
--   1. изменили ставку здания   -> пересчитались непроданные квартиры;
--   2. создали квартиру         -> цена посчиталась сразу;
--   3. вписали площадь позже    -> цена посчиталась сразу.
--
-- Нажимать больше ничего не нужно. Кнопка «Применить» остаётся — она нужна
-- для квартир, созданных ДО этой миграции.
--
-- ЧТО НЕ ТРОГАЕТСЯ (везде одинаково):
--   * проданные (status = 'sold') — цена зафиксирована сделкой;
--   * квартиры без площади — умножать не на что;
--   * квартиры в долларах — ставка здания указана в сомони.
--
-- ДОГОВОРЫ НЕ ЗАТРАГИВАЮТСЯ: у contracts своя сумма (contracts.amount), она
-- хранится отдельно от objects.price.
--
-- ОЧИСТКА СТАВКИ НЕ СТИРАЕТ ЦЕНЫ. Если price_per_sqm стал NULL, триггер
-- ничего не делает: снять цены можно только осознанно, из карточки здания,
-- с отдельным подтверждением. Иначе случайно очищенное поле молча обнулило
-- бы прайс всего дома.
--
-- ПРАВА: SECURITY DEFINER — намеренно, и это отличается от функции 048.
-- Там пересчёт был действием пользователя, и политика objects_update
-- (не-админ меняет только свободные квартиры) должна была его ограничивать.
-- Здесь это не действие, а инвариант данных: если ставка здания изменилась,
-- цены обязаны сойтись целиком, а не на тех строках, до которых дотянулись
-- права. Само право менять ставку по-прежнему проверяется на buildings.
--
-- Идемпотентно, повторный запуск безопасен.
-- ============================================================

-- ---------- 1. ставка здания изменилась ----------

create or replace function crm.apply_building_rate()
returns trigger
language plpgsql
security definer
set search_path = crm, public
as $$
begin
  -- NULL — это «ставка не задана», а не «обнулить прайс». См. шапку файла.
  if new.price_per_sqm is null or new.price_per_sqm <= 0 then
    return new;
  end if;

  update crm.objects
  set price = round(area * new.price_per_sqm, 2)
  where building_id = new.id
    and status <> 'sold'
    and currency = 'TJS'
    and area is not null
    and area > 0
    -- Не трогаем строки, которые уже стоят на этой цене: лишний UPDATE
    -- дёргает триггер updated_at и заставляет базу писать зря.
    and price is distinct from round(area * new.price_per_sqm, 2);

  return new;
end;
$$;

drop trigger if exists trg_apply_building_rate on crm.buildings;
create trigger trg_apply_building_rate
  after update of price_per_sqm on crm.buildings
  for each row
  when (new.price_per_sqm is distinct from old.price_per_sqm)
  execute function crm.apply_building_rate();

-- ---------- 2. и 3. квартира создана / у неё появилась площадь ----------

create or replace function crm.price_unit_from_building()
returns trigger
language plpgsql
security definer
set search_path = crm, public
as $$
declare
  v_rate numeric;
begin
  if new.building_id is null
     or new.status = 'sold'
     or new.currency <> 'TJS'
     or new.area is null
     or new.area <= 0
  then
    return new;
  end if;

  -- Цену, введённую руками, не перебиваем: ставка здания — значение по
  -- умолчанию, а не запрет назначить квартире свою цену.
  if new.price is not null and new.price > 0 then
    return new;
  end if;

  select b.price_per_sqm into v_rate
  from crm.buildings b
  where b.id = new.building_id;

  if v_rate is null or v_rate <= 0 then
    return new;
  end if;

  new.price := round(new.area * v_rate, 2);
  return new;
end;
$$;

drop trigger if exists trg_price_unit_from_building on crm.objects;
create trigger trg_price_unit_from_building
  before insert or update of area, building_id on crm.objects
  for each row
  execute function crm.price_unit_from_building();

-- ---------- разовая сверка существующих данных ----------
--
-- Всё, что накопилось до этой миграции: квартиры, у которых есть площадь и
-- есть ставка здания, но цены нет. Ровно те 178 строк, из-за которых
-- «Потенциал непроданных» считал половину. Дальше за этим следят триггеры.

update crm.objects o
set price = round(o.area * b.price_per_sqm, 2)
from crm.buildings b
where b.id = o.building_id
  and o.status <> 'sold'
  and o.currency = 'TJS'
  and o.area is not null
  and o.area > 0
  and (o.price is null or o.price = 0)
  and b.price_per_sqm is not null
  and b.price_per_sqm > 0;
