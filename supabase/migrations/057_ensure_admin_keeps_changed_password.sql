-- ============================================================
-- 057: повторный запуск 000_full_setup.sql больше не сбрасывает пароль
-- заводского админа обратно на Admin12345.
--
-- ЧТО БЫЛО НЕ ТАК. crm.ensure_admin('admin@crm.tj', 'Admin12345') стоит в
-- самом конце установочного файла и выполняется КАЖДЫЙ раз, когда файл
-- запускают — а файл специально сделан идемпотентным и его именно так и
-- советуют запускать заново при каждой новой миграции. Внутри функции
-- ветка «аккаунт уже есть» чинит его сломанные поля — и почти везде это
-- сделано аккуратно, через coalesce(поле, значение_по_умолчанию), то есть
-- трогает только то, что реально пустое (NULL). Кроме одного поля:
--
--   update auth.users set encrypted_password = crypt(p_password, ...)
--
-- Это не coalesce — пароль переписывался БЕЗУСЛОВНО, при каждом запуске,
-- даже если человек уже вошёл и честно сменил пароль в Настройках. Отсюда
-- и жалоба: «меняю пароль, а он всё равно старый» — пароль менялся
-- успешно, но следующий же прогон этого файла (а его просят запускать
-- при каждой новой миграции) тихо возвращал его обратно на Admin12345.
--
-- ЧТО МЕНЯЕТСЯ. Пароль задаётся только при СОЗДАНИИ аккаунта — «готовый
-- вход из коробки» при самой первой установке. Если аккаунт уже
-- существует, пароль больше не трогается никогда, вместе с остальными
-- полями, которые и так чинились только если были пустые.
--
-- ЕСЛИ ПАРОЛЬ ДЕЙСТВИТЕЛЬНО ЗАБЫТ. Правильный путь теперь — как для
-- любого обычного пользователя: Supabase → Authentication → Users →
-- выбрать аккаунт → задать новый пароль там. Не перезапуск этого файла.
--
-- Идемпотентно, повторный запуск безопасен.
-- ============================================================

create or replace function crm.ensure_admin(p_email text, p_password text)
returns void
language plpgsql
security definer
set search_path = auth, crm, public, extensions
as $$
declare
  v_uid uuid;
begin
  select id into v_uid from auth.users where email = p_email;

  if v_uid is null then
    v_uid := gen_random_uuid();
    -- ВАЖНО: служебные token-поля задаём пустой строкой, а не оставляем
    -- NULL. Иначе при входе GoTrue (сервис авторизации Supabase) не может
    -- прочитать строку и падает с "Database error querying schema".
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token,
      email_change_token_new, email_change, email_change_token_current,
      phone_change, phone_change_token, reauthentication_token
    ) values (
      '00000000-0000-0000-0000-000000000000', v_uid,
      'authenticated', 'authenticated', p_email,
      crypt(p_password, gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      '', '', '', '', '', '', '', ''
    );
    insert into auth.identities (
      provider_id, user_id, identity_data, provider, created_at, updated_at
    ) values (
      v_uid::text, v_uid,
      jsonb_build_object('sub', v_uid::text, 'email', p_email),
      'email', now(), now()
    );
  else
    -- Чиним уже созданный аккаунт -- но только то, что реально пустое.
    -- Пароль сюда намеренно НЕ входит: если человек его сменил, это его
    -- осознанный пароль, и повторный запуск этого файла не должен его
    -- отменять.
    update auth.users
       set email_confirmed_at = coalesce(email_confirmed_at, now()),
           confirmation_token = coalesce(confirmation_token, ''),
           recovery_token = coalesce(recovery_token, ''),
           email_change_token_new = coalesce(email_change_token_new, ''),
           email_change = coalesce(email_change, ''),
           email_change_token_current = coalesce(email_change_token_current, ''),
           phone_change = coalesce(phone_change, ''),
           phone_change_token = coalesce(phone_change_token, ''),
           reauthentication_token = coalesce(reauthentication_token, ''),
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

revoke all on function crm.ensure_admin(text, text) from public;
revoke all on function crm.ensure_admin(text, text) from anon;
revoke all on function crm.ensure_admin(text, text) from authenticated;
