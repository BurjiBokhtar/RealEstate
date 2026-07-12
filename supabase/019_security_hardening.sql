-- Security review findings:
--
-- 1) The crm-media storage bucket accepted any file of any size from any
--    authenticated user -- the app only ever hinted at "images and PDF"
--    via the file picker's client-side "accept" attribute, which does
--    nothing to stop a direct upload call with a different content-type.
--    Cap size and restrict to the types the UI actually uses; Supabase
--    Storage enforces this itself, so it holds even if the app's own
--    client-side check (src/lib/supabase/upload.ts) is bypassed.
update storage.buckets
set file_size_limit = 10485760, -- 10 MB
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
where id = 'crm-media';

-- 2) /api/cron/* routes only checked CRON_SECRET when it happened to be
--    set -- since it was never actually configured (missing from
--    .env.local.example, never documented), both routes were reachable by
--    anyone on the internet with the service-role key behind them, able to
--    trigger SMS sends through the paid gateway on demand. Fixed in the
--    route code to fail closed (reject everything when the secret isn't
--    configured, not just when it's set and doesn't match) -- noted here
--    since it's the other half of this pass and needs CRON_SECRET actually
--    set in Vercel's project environment variables to keep the scheduled
--    jobs themselves working.
--
-- 3) crm.settings (company info, SMS gateway credentials, contract
--    template) was still on the original 005 policy -- any authenticated
--    user, not just admins, could write to it (and the settings page had
--    no role gate at all, so any manager visiting /settings saw the raw
--    SMS API key and could save changes). App code now restricts the page
--    itself to admins and stops the app-wide settings provider from ever
--    fetching sms_api_key; this closes the write side at the database
--    level so it holds even if someone bypasses the UI.
drop policy if exists "Allow all access to settings" on crm.settings;
drop policy if exists "Authenticated access to settings" on crm.settings;

create policy "settings_select" on crm.settings
  for select to authenticated using (true);

create policy "settings_update" on crm.settings
  for update to authenticated using (crm.is_admin()) with check (crm.is_admin());
