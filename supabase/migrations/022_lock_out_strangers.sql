-- ============================================================
-- 022: посторонний с аккаунтом = никто.
--
-- Дыра: crm.my_role() возвращал 'manager' для любого вошедшего
-- пользователя БЕЗ строки в crm.profiles. Если в Supabase включена
-- самостоятельная регистрация (по умолчанию включена), чужак мог
-- зарегистрироваться напрямую через API и сразу получить права
-- менеджера: видеть всех клиентов и писать в базу.
--
-- Исправление: нет строки в profiles — роль 'none', то есть ничего
-- не видно и ничего нельзя. Роль выдаёт только админ (страница
-- «Сотрудники» создаёт profiles через service-ключ).
--
-- ВАЖНО: дополнительно отключите самостоятельную регистрацию в
-- Supabase Dashboard → Authentication → Sign In / Providers →
-- "Allow new users to sign up" → OFF. Аккаунты создаёт только админ.
--
-- Файл идемпотентный — можно запускать повторно.
-- ============================================================

create or replace function crm.my_role()
returns text
language sql
security definer
set search_path = crm, public
stable
as $$
  select coalesce((select role from crm.profiles where id = auth.uid()), 'none');
$$;

-- Есть ли у пользователя вообще какая-то роль в системе.
create or replace function crm.has_role()
returns boolean
language sql
security definer
set search_path = crm, public
stable
as $$
  select crm.my_role() in ('admin', 'manager', 'director');
$$;

-- Клиенты: раньше select был using(true) — любой аутентифицированный
-- видел всю клиентскую базу. Теперь только сотрудники.
drop policy if exists "clients_select" on crm.clients;
create policy "clients_select" on crm.clients
  for select to authenticated using (crm.has_role());

-- Квартиры/договоры/платежи: политики уже завязаны на can_view_building,
-- но ветка "building_id is null" была видна всем аутентифицированным.
-- Добавляем общий ролевой замок.
drop policy if exists "objects_select" on crm.objects;
create policy "objects_select" on crm.objects
  for select to authenticated
  using (
    crm.has_role() and (building_id is null or crm.can_view_building(building_id))
  );

drop policy if exists "contracts_select" on crm.contracts;
create policy "contracts_select" on crm.contracts
  for select to authenticated
  using (
    crm.has_role()
    and exists (
      select 1 from crm.objects o
      where o.id = object_id
        and (o.building_id is null or crm.can_view_building(o.building_id))
    )
  );

drop policy if exists "contract_payments_select" on crm.contract_payments;
create policy "contract_payments_select" on crm.contract_payments
  for select to authenticated
  using (
    crm.has_role()
    and exists (
      select 1
      from crm.contracts c
      join crm.objects o on o.id = c.object_id
      where c.id = contract_id
        and (o.building_id is null or crm.can_view_building(o.building_id))
    )
  );

-- Задачи и настройки: были открыты любому аутентифицированному.
drop policy if exists "Authenticated access to tasks" on crm.tasks;
drop policy if exists "tasks_all" on crm.tasks;
create policy "tasks_all" on crm.tasks
  for all to authenticated using (crm.has_role()) with check (crm.can_write());

drop policy if exists "settings_select" on crm.settings;
create policy "settings_select" on crm.settings
  for select to authenticated using (crm.has_role());
