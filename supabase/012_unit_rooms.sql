-- Track room count per unit (needed for the block/entrance/room-type
-- constructor: "3 однокомнатных по 45 м², 2 двухкомнатных по 65 м²").
alter table crm.objects add column if not exists rooms smallint;
