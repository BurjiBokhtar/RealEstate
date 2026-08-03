-- Construction-stage tracking for a building/ЖК: planning (нет ещё продаж),
-- in_progress (стройка идёт, актуально для дашборда), completed (сдан --
-- его данные больше не тянут общую статистику дашборда, а сворачиваются в
-- одну сжатую строку). Idempotent: safe to run on a database that already
-- has this column.
alter table crm.buildings
  add column if not exists construction_status text not null default 'in_progress';

alter table crm.buildings
  drop constraint if exists buildings_construction_status_check;

alter table crm.buildings
  add constraint buildings_construction_status_check
  check (construction_status in ('planning', 'in_progress', 'completed'));
