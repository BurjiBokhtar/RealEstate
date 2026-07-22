-- ============================================================
-- 028: управление сотрудниками БЕЗ service-ключа.
--
-- Раньше страница «Сотрудники» ходила в серверный API с секретным
-- ключом (SUPABASE_SERVICE_ROLE_KEY). Любая ошибка этого ключа на
-- Vercel ломала всю страницу целиком — нельзя было даже увидеть
-- список.
--
-- Теперь список пользователей и выдача ролей работают через обычные
-- RPC прямо в базе (SECURITY DEFINER, доступ только админу). Никакого
-- секретного ключа не нужно — всё как с остальными данными
-- программы. Новый порядок:
--   1) админ создаёт пользователя в Supabase → Authentication → Users;
--   2) он сам появляется в списке на странице «Сотрудники»;
--   3) админ ставит ему роль и объекты прямо в программе.
--
-- Файл идемпотентный — можно запускать повторно.
-- ============================================================

-- Список всех пользователей с их ролью (роль 'none' — если ещё не
-- назначена). Только для админа. Функция выполняется от владельца БД,
-- поэтому может читать auth.users, недоступную обычному ключу.
create or replace function crm.list_staff()
returns table (id uuid, email text, role text, created_at timestamptz)
language plpgsql
security definer
set search_path = crm, public
stable
as $$
begin
  if not crm.is_admin() then
    raise exception 'Только администратор может видеть список сотрудников';
  end if;
  return query
    select u.id,
           u.email::text,
           coalesce(p.role, 'none') as role,
           u.created_at
    from auth.users u
    left join crm.profiles p on p.id = u.id
    order by u.created_at asc;
end;
$$;

grant execute on function crm.list_staff() to authenticated;

-- Выдать/сменить роль. 'none' = убрать доступ (удалить строку роли).
-- Только для админа. Себя понизить нельзя — иначе можно случайно
-- остаться без единого админа.
create or replace function crm.set_user_role(p_user uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = crm, public
as $$
begin
  if not crm.is_admin() then
    raise exception 'Только администратор может менять роли';
  end if;
  if p_role not in ('admin', 'manager', 'director', 'none') then
    raise exception 'Неизвестная роль: %', p_role;
  end if;
  if p_user = auth.uid() and p_role <> 'admin' then
    raise exception 'Нельзя снять роль администратора с самого себя';
  end if;

  if p_role = 'none' then
    delete from crm.profiles where id = p_user;
  else
    insert into crm.profiles (id, role)
    values (p_user, p_role)
    on conflict (id) do update set role = excluded.role;
  end if;
end;
$$;

grant execute on function crm.set_user_role(uuid, text) to authenticated;
