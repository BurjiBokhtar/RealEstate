-- ============================================================
-- 024: индексы под реальные запросы приложения.
--
-- Все списки в приложении уже пагинированы (по 25 строк), но без
-- индексов Postgres всё равно перебирает таблицы целиком при каждом
-- фильтре. Эти индексы покрывают ровно те запросы, которые страницы
-- делают постоянно:
--   контракты по клиенту (карточка клиента, колонка долга в списке),
--   контракты по квартире (шахматка),
--   платежи по договору (графики, расиды),
--   квартиры по зданию (шахматка),
--   журнал по дате (страница журнала),
--   клиенты по дате создания (список клиентов).
--
-- Файл идемпотентный — можно запускать повторно.
-- ============================================================

create index if not exists idx_contracts_client_id on crm.contracts (client_id);
create index if not exists idx_contracts_object_id on crm.contracts (object_id);
create index if not exists idx_contract_payments_contract_id
  on crm.contract_payments (contract_id);
create index if not exists idx_objects_building_id on crm.objects (building_id);
create index if not exists idx_audit_log_created_at
  on crm.audit_log (created_at desc);
create index if not exists idx_clients_created_at on crm.clients (created_at desc);
-- Поиск клиентов по имени/телефону идёт через ilike '%…%' -- обычный
-- btree тут не помогает, нужен триграммный.
create extension if not exists pg_trgm;
create index if not exists idx_clients_name_trgm
  on crm.clients using gin (name gin_trgm_ops);
create index if not exists idx_clients_phone_trgm
  on crm.clients using gin (phone gin_trgm_ops);
