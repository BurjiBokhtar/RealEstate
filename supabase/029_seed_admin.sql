-- ============================================================
-- 029: готовый аккаунт администратора прямо из SQL.
--
-- Больше НИКАКОЙ возни с созданием пользователей в дашборде,
-- подтверждением почты и "не тот проект". Выполнили этот файл —
-- сразу есть рабочий вход:
--
--     Email:  admin@crm.tj
--     Пароль: Admin12345
--
-- ПОСЛЕ ПЕРВОГО ВХОДА ОБЯЗАТЕЛЬНО СМЕНИТЕ ПАРОЛЬ в программе:
-- Настройки → «Сменить пароль».
--
-- Заодно, если в базе уже есть аккаунт iammirzozoda@gmail.com,
-- который не пускал, — этот файл чинит его: ставит известный пароль
-- (Admin12345), подтверждает почту и делает админом.
--
-- Файл идемпотентный — можно запускать повторно.
-- ============================================================

-- crypt() / gen_salt() для хеша пароля.
create extension if not exists pgcrypto;

-- Универсальная процедура: создать аккаунт с паролем, если его нет,
-- либо починить существующий (пароль + подтверждение почты), и в любом
-- случае выдать роль admin.
create or replace function crm.ensure_admin(p_email text, p_password text)
returns void
language plpgsql
security definer
set search_path = auth, crm, public
as $$
declare
  v_uid uuid;
begin
  select id into v_uid from auth.users where email = p_email;

  if v_uid is null then
    v_uid := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data
    ) values (
      '00000000-0000-0000-0000-000000000000', v_uid,
      'authenticated', 'authenticated', p_email,
      crypt(p_password, gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb
    );
    insert into auth.identities (
      provider_id, user_id, identity_data, provider, created_at, updated_at
    ) values (
      v_uid::text, v_uid,
      jsonb_build_object('sub', v_uid::text, 'email', p_email),
      'email', now(), now()
    );
  else
    update auth.users
       set encrypted_password = crypt(p_password, gen_salt('bf')),
           email_confirmed_at = coalesce(email_confirmed_at, now()),
           updated_at = now()
     where id = v_uid;
    if not exists (
      select 1 from auth.identities where user_id = v_uid and provider = 'email'
    ) then
      insert into auth.identities (
        provider_id, user_id, identity_data, provider, created_at, updated_at
      ) values (
        v_uid::text, v_uid,
        jsonb_build_object('sub', v_uid::text, 'email', p_email),
        'email', now(), now()
      );
    end if;
  end if;

  insert into crm.profiles (id, role)
  values (v_uid, 'admin')
  on conflict (id) do update set role = 'admin';
end;
$$;

-- КРИТИЧНО: функция умеет назначать админа, поэтому её нельзя вызывать
-- никому, кроме самой базы. По умолчанию Postgres разрешает EXECUTE всем
-- (PUBLIC) — иначе любой аноним через API сделал бы себя админом. Отзываем.
revoke all on function crm.ensure_admin(text, text) from public;
revoke all on function crm.ensure_admin(text, text) from anon;
revoke all on function crm.ensure_admin(text, text) from authenticated;

-- Готовый вход "из коробки".
select crm.ensure_admin('admin@crm.tj', 'Admin12345');

-- Чиним/поднимаем ваш личный аккаунт, если он был заведён раньше.
select crm.ensure_admin('iammirzozoda@gmail.com', 'Admin12345');
