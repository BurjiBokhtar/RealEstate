-- ============================================================
-- 027: первый пользователь автоматически становится админом.
--
-- Раньше после создания базы приходилось вручную выполнять SQL,
-- чтобы выдать первому аккаунту роль admin (курица и яйцо: админов
-- ещё нет, а роли выдаёт админ). Теперь: если в системе ещё НЕТ ни
-- одного админа, первый созданный пользователь получает роль admin
-- сам. Все последующие пользователи роли НЕ получают — их создаёт
-- админ со страницы «Сотрудники».
--
-- Безопасность: правило срабатывает только пока админов ноль, то
-- есть ровно один раз за жизнь базы. Но самостоятельную регистрацию
-- всё равно нужно держать выключенной (Authentication → Sign In /
-- Providers → Allow new users to sign up → OFF) — это правило
-- «первый = админ» и открытая регистрация вместе означали бы гонку
-- за первое место.
--
-- Файл идемпотентный — можно запускать повторно.
-- ============================================================

create or replace function crm.grant_admin_to_first_user()
returns trigger
language plpgsql
security definer
set search_path = crm, public
as $$
begin
  if not exists (select 1 from crm.profiles where role = 'admin') then
    insert into crm.profiles (id, role)
    values (new.id, 'admin')
    on conflict (id) do update set role = 'admin';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_first_user_is_admin on auth.users;
create trigger trg_first_user_is_admin
after insert on auth.users
for each row execute function crm.grant_admin_to_first_user();

-- Если база уже существует и в ней ровно один пользователь без роли
-- (типичная картина свежей установки) — сделать его админом сейчас.
do $$
declare
  v_only_user uuid;
begin
  if not exists (select 1 from crm.profiles where role = 'admin') then
    select id into v_only_user from auth.users
    order by created_at asc limit 1;
    if v_only_user is not null then
      insert into crm.profiles (id, role)
      values (v_only_user, 'admin')
      on conflict (id) do update set role = 'admin';
    end if;
  end if;
end $$;
