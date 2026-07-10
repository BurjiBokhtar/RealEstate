-- The "Настроить здание" edit page is admin-gated in the UI, but the
-- underlying RLS still let any authenticated user (including managers) call
-- the Supabase API directly to edit or delete a building. Lock that down to
-- match the app-level gate: managers can still create buildings (that's the
-- "+ Новое здание / ЖК" flow in Объекты), but editing/deleting an existing
-- one is admin-only, same as contracts.
drop policy if exists "Authenticated access to buildings" on crm.buildings;

create policy "buildings_select" on crm.buildings
  for select to authenticated using (true);

create policy "buildings_insert" on crm.buildings
  for insert to authenticated with check (true);

create policy "buildings_update" on crm.buildings
  for update to authenticated
  using (crm.is_admin())
  with check (true);

create policy "buildings_delete" on crm.buildings
  for delete to authenticated using (crm.is_admin());
