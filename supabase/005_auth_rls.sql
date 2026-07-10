-- RealEstate CRM: require a logged-in Supabase Auth user for all data access.
-- Run this ONLY after you've created at least one user in
-- Supabase Dashboard -> Authentication -> Users -> Add user,
-- since anonymous access to every table below is removed.

drop policy if exists "Allow all access to objects" on crm.objects;
create policy "Authenticated access to objects" on crm.objects
  for all to authenticated using (true) with check (true);

drop policy if exists "Allow all access to clients" on crm.clients;
create policy "Authenticated access to clients" on crm.clients
  for all to authenticated using (true) with check (true);

drop policy if exists "Allow all access to tasks" on crm.tasks;
create policy "Authenticated access to tasks" on crm.tasks
  for all to authenticated using (true) with check (true);

drop policy if exists "Allow all access to contracts" on crm.contracts;
create policy "Authenticated access to contracts" on crm.contracts
  for all to authenticated using (true) with check (true);

drop policy if exists "Allow all access to buildings" on crm.buildings;
create policy "Authenticated access to buildings" on crm.buildings
  for all to authenticated using (true) with check (true);

drop policy if exists "Allow all access to settings" on crm.settings;
create policy "Authenticated access to settings" on crm.settings
  for all to authenticated using (true) with check (true);

drop policy if exists "Allow all access to contract_payments" on crm.contract_payments;
create policy "Authenticated access to contract_payments" on crm.contract_payments
  for all to authenticated using (true) with check (true);

-- Storage stays public-read (facade photos/plans are non-sensitive marketing
-- images), but only logged-in users may upload/modify/delete.
drop policy if exists "Public upload crm-media" on storage.objects;
create policy "Authenticated upload crm-media" on storage.objects
  for insert to authenticated with check (bucket_id = 'crm-media');

drop policy if exists "Public update crm-media" on storage.objects;
create policy "Authenticated update crm-media" on storage.objects
  for update to authenticated using (bucket_id = 'crm-media');

drop policy if exists "Public delete crm-media" on storage.objects;
create policy "Authenticated delete crm-media" on storage.objects
  for delete to authenticated using (bucket_id = 'crm-media');
