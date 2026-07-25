-- Objects (property units) become admin-only for create and edit, matching
-- buildings. Managers/directors can still SELECT them, book them (contracts +
-- the SECURITY DEFINER reservation RPC set the unit's status, not a direct
-- object write), and record payments -- but they can no longer add, rename,
-- reprice, or restructure a unit. Delete was already admin-only.

drop policy if exists "objects_insert" on crm.objects;
drop policy if exists "objects_update" on crm.objects;

create policy "objects_insert" on crm.objects
  for insert to authenticated
  with check (
    crm.is_admin() and (building_id is null or crm.can_view_building(building_id))
  );

create policy "objects_update" on crm.objects
  for update to authenticated
  using (
    crm.is_admin()
    and (building_id is null or crm.can_view_building(building_id))
  )
  with check (crm.is_admin());
