-- ============================================================
-- 053: журнал событий помнит, В КАКОМ договоре/квартире/клиенте произошло
-- событие, а не только голый UUID и список изменённых полей.
--
-- ЧТО БЫЛО НЕ ТАК. crm.log_change()/crm.log_delete() писали:
--   * insert/delete -- всю строку целиком (to_jsonb);
--   * update        -- только изменившиеся поля, {поле: {old, new}}.
-- Для клиента этого достаточно: у строки уже есть name. Но для платежа
-- (contract_payments) и договора (contracts) собственного человекочитаемого
-- имени нет — только client_id/object_id/contract_id, голые UUID. Запись
-- «Пардохт · 16516.66» ничего не говорит, в счёт какого договора, какой
-- квартиры и какого клиента это было. Экран журнала показывал именно это.
--
-- Второй, отдельный баг был на фронтенде: страница журнала ищет
-- details.changed, а триггер никогда не клал diff под ключ "changed" — он
-- И ЕСТЬ details. Поэтому у каждой строки «Тагйирдихӣ» в колонке
-- «Тафсилот» всегда стоял прочерк, даже когда изменения были. Правится в
-- src/app/(app)/settings/audit-log/page.tsx отдельным коммитом.
--
-- ЧТО МЕНЯЕТСЯ. Новая функция crm.audit_context(entity_type, id) одним
-- запросом на нужный тип сущности достаёт то, что относится к делу: имя
-- клиента, номер договора, имя/квартиру объекта, здание, валюту договора.
-- Кладётся в details под ключ "_context" — с подчёркиванием, чтобы никогда
-- не столкнуться с настоящим именем колонки. jsonb_strip_nulls убирает
-- то, что для этого типа сущности не имеет смысла (у клиента нет номера
-- договора), так что фронтенду достаточно проверить, какие ключи вообще
-- пришли.
--
-- ПОЧЕМУ ОДНА ФУНКЦИЯ ПО ID, А НЕ ПО СТРОКЕ NEW/OLD. Она вызывается и из
-- log_change (после INSERT/UPDATE, строка уже видна), и из log_delete
-- (BEFORE DELETE, строка ещё жива) — но она не трогает удаляемую/меняемую
-- строку напрямую, а ищет её заново по id и достраивает связи (платёж →
-- договор → клиент/квартира → здание). Так один код работает в обоих
-- триггерах без дублирования.
--
-- Идемпотентно, повторный запуск безопасен.
-- ============================================================

create or replace function crm.audit_context(p_entity_type text, p_entity_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = crm, public
as $$
declare
  v_client_name text;
  v_contract_number text;
  v_object_name text;
  v_building_name text;
  v_currency crm.currency;
begin
  if p_entity_type = 'client' then
    select c.name into v_client_name
    from crm.clients c
    where c.id = p_entity_id;

  elsif p_entity_type = 'contract' then
    select cl.name, c.number, o.name, b.name, c.currency
      into v_client_name, v_contract_number, v_object_name, v_building_name, v_currency
    from crm.contracts c
    left join crm.clients cl on cl.id = c.client_id
    left join crm.objects o on o.id = c.object_id
    left join crm.buildings b on b.id = o.building_id
    where c.id = p_entity_id;

  elsif p_entity_type = 'contract_payment' then
    select cl.name, c.number, o.name, b.name, c.currency
      into v_client_name, v_contract_number, v_object_name, v_building_name, v_currency
    from crm.contract_payments p
    join crm.contracts c on c.id = p.contract_id
    left join crm.clients cl on cl.id = c.client_id
    left join crm.objects o on o.id = c.object_id
    left join crm.buildings b on b.id = o.building_id
    where p.id = p_entity_id;

  elsif p_entity_type = 'object' then
    select o.name, b.name into v_object_name, v_building_name
    from crm.objects o
    left join crm.buildings b on b.id = o.building_id
    where o.id = p_entity_id;
  end if;

  return jsonb_strip_nulls(jsonb_build_object(
    'client_name', v_client_name,
    'contract_number', v_contract_number,
    'object_name', v_object_name,
    'building_name', v_building_name,
    'currency', v_currency
  ));
end;
$$;

create or replace function crm.log_change()
returns trigger
language plpgsql
security definer
set search_path = crm, public
as $$
declare
  v_diff jsonb;
  v_context jsonb;
begin
  v_context := crm.audit_context(TG_ARGV[0], NEW.id);

  if TG_OP = 'INSERT' then
    insert into crm.audit_log (actor_id, action, entity_type, entity_id, details)
    values (
      auth.uid(), 'create', TG_ARGV[0], NEW.id,
      to_jsonb(NEW) || jsonb_build_object('_context', v_context)
    );
    return NEW;
  end if;

  -- UPDATE: only the fields that actually changed, old -> new, so the log
  -- reads as "what happened" instead of two full row dumps.
  select coalesce(
    jsonb_object_agg(n.key, jsonb_build_object('old', o.value, 'new', n.value)),
    '{}'::jsonb
  )
  into v_diff
  from jsonb_each(to_jsonb(NEW)) n
  join jsonb_each(to_jsonb(OLD)) o using (key)
  where n.value is distinct from o.value
    and n.key not in ('updated_at');

  if v_diff <> '{}'::jsonb then
    insert into crm.audit_log (actor_id, action, entity_type, entity_id, details)
    values (
      auth.uid(), 'update', TG_ARGV[0], NEW.id,
      v_diff || jsonb_build_object('_context', v_context)
    );
  end if;
  return NEW;
end;
$$;

create or replace function crm.log_delete()
returns trigger
language plpgsql
security definer
set search_path = crm, public
as $$
declare
  v_context jsonb;
begin
  -- BEFORE DELETE: OLD still exists, and so does everything audit_context
  -- looks up through it (only OLD itself is about to go away).
  v_context := crm.audit_context(TG_ARGV[0], OLD.id);
  insert into crm.audit_log (actor_id, action, entity_type, entity_id, details)
  values (
    auth.uid(), 'delete', TG_ARGV[0], OLD.id,
    to_jsonb(OLD) || jsonb_build_object('_context', v_context)
  );
  return OLD;
end;
$$;
