-- Expose the company hero theme/pattern through the anon public_branding RPC,
-- so the LOGIN page (pre-auth, no session) can paint itself in the company's
-- chosen theme instead of the default plum. Only these four non-sensitive
-- fields are returned; nothing else from settings.
--
-- DROP first: Postgres refuses to change a function's return type via CREATE
-- OR REPLACE (the old signature returned only name+logo).
drop function if exists crm.public_branding();

create or replace function crm.public_branding()
returns table (
  company_name text,
  company_logo_url text,
  hero_theme text,
  hero_pattern text
)
language sql
security definer
set search_path = crm, public
stable
as $$
  select s.company_name, s.company_logo_url, s.hero_theme, s.hero_pattern
  from crm.settings s
  limit 1;
$$;

grant execute on function crm.public_branding() to anon, authenticated;
