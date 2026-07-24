-- Deleting a building currently orphans its units (building_id set to null),
-- which then show up as stray rows in the top-level Объекты list. Fix so
-- deleting a building removes all of its units in one transaction.

alter table crm.objects
  drop constraint if exists objects_building_id_fkey;

alter table crm.objects
  add constraint objects_building_id_fkey
  foreign key (building_id) references crm.buildings(id) on delete cascade;
