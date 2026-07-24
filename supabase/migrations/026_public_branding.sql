-- ============================================================
-- 026: название и логотип компании для страницы входа.
--
-- Настройки целиком (реквизиты, шаблоны SMS) читают только сотрудники
-- (022), но страница входа показывается ДО входа — ей нужно название
-- и логотип. Эта функция отдаёт только эти два поля и ничего больше,
-- поэтому её можно открыть анонимным без риска.
--
-- Файл идемпотентный — можно запускать повторно.
-- ============================================================

create or replace function crm.public_branding()
returns table (company_name text, company_logo_url text)
language sql
security definer
set search_path = crm, public
stable
as $$
  select s.company_name, s.company_logo_url
  from crm.settings s
  limit 1;
$$;

grant execute on function crm.public_branding() to anon, authenticated;
