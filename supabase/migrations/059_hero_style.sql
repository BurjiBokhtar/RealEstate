-- ============================================================
-- 059: hero_style -- a second, independent axis from hero_theme/hero_pattern.
--
-- ЧТО БЫЛО НЕ ТАК. Every company theme (Атлас/Зумуррад/Шафақ/Лимӯ) painted
-- the SAME shape: a 3-stop diagonal gradient, slowly panning, with two
-- drifting glow blobs behind the headline. Only the three colour stops
-- changed between them -- so with four themes picked, the dashboard still
-- felt like one design wearing four outfits, not four designs.
--
-- ЧТО МЕНЯЕТСЯ. hero_style adds a second, orthogonal choice: the SHAPE of
-- the dashboard hero, independent of its colour.
--   'gradient' (default) -- the existing animated three-stop blend. Nothing
--      changes for anyone who doesn't touch this.
--   'flat'     -- a solid --hero-1 panel. No pan, no glow blobs.
--   'outline'  -- flips it light: white panel, the theme colour lives in
--      the border / button / accents only, not the whole surface.
--   'block'    -- 'flat' with the revenue figure called out in a solid
--      --hero-3 block instead of a translucent white one.
-- All four read off the SAME --hero-1/2/3 tokens each colour theme already
-- sets (globals.css), so this is not tied to Лимӯ specifically -- any
-- theme can use any style; Лимӯ just needed one that isn't the gradient.
--
-- Идемпотентно, повторный запуск безопасен.
-- ============================================================

alter table crm.settings add column if not exists hero_style text;

-- Same reasoning as 034: public_branding() is the anon-accessible RPC the
-- pre-auth login page and the root layout read to paint <html> before the
-- first byte, so hero_style has to travel through it too -- otherwise a
-- flat/outline/block choice would flash to the gradient default on every
-- load and only correct itself once AppShell's client-side settings fetch
-- lands.
-- DROP first: Postgres refuses to widen a function's return type via
-- CREATE OR REPLACE.
drop function if exists crm.public_branding();

create or replace function crm.public_branding()
returns table (
  company_name text,
  company_logo_url text,
  hero_theme text,
  hero_pattern text,
  hero_style text
)
language sql
security definer
set search_path = crm, public
stable
as $$
  select s.company_name, s.company_logo_url, s.hero_theme, s.hero_pattern, s.hero_style
  from crm.settings s
  limit 1;
$$;

grant execute on function crm.public_branding() to anon, authenticated;
