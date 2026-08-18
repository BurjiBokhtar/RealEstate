-- ============================================================
-- 054: сервисному ключу дали права на схему crm. Наконец настоящая причина
-- «permission denied for schema crm» / «Invalid API key» у SMS-рассылки.
--
-- ЧТО БЫЛО НЕ ТАК. Схема crm и все её таблицы выдавались правами трижды по
-- ходу файла (при создании, потом ещё дважды) — и каждый раз одной и той же
-- строкой:
--
--   grant usage on schema crm to anon, authenticated;
--   grant all on all tables in schema crm to anon, authenticated;
--   grant all on all sequences in schema crm to anon, authenticated;
--   alter default privileges in schema crm grant all on tables to anon, authenticated;
--
-- Ни разу — ни одного упоминания service_role. Обычный вход в программу
-- работает через anon/authenticated, поэтому сайт был в полном порядке.
-- А /api/sms/*, /api/cron/* подключаются SUPABASE_SERVICE_ROLE_KEY — это
-- РОЛЬ В БАЗЕ ПОСТГРЕС с именем service_role, и у неё не было даже права
-- заглянуть в схему crm, не то что читать settings. Отсюда и ошибка: ключ
-- настоящий, из правильного проекта — но роль, которую он представляет,
-- никогда не получала доступа.
--
-- Раньше эта ошибка была подписана «скорее всего ключ из другого проекта»
-- (см. adminErrorMessage в serviceClient.ts) — и это было ПРАВДОПОДОБНОЕ,
-- но не то объяснение: причина была здесь, в базе, а не в Vercel.
--
-- ЧТО ДЕЛАЕТ ЭТОТ ФАЙЛ. Даёт service_role ровно то же самое, что уже есть
-- у authenticated: доступ к схеме, ко всем существующим таблицам и
-- последовательностям, право выполнять функции, и правило на будущее —
-- новая таблица/функция появится уже с этим правом, без ручной правки.
--
-- ПОЧЕМУ ЭТО БЕЗОПАСНО. service_role и так проходит мимо RLS по конструкции
-- Supabase (это и есть смысл «служебной» роли) — у него уже есть полный
-- доступ к данным на уровне движка. Явные grant здесь не открывают ничего
-- нового, они лишь снимают отдельный, более ранний барьер Постгреса
-- (владение схемой/объектом), который стоял ПЕРЕД проверкой RLS и обрубал
-- запрос до неё.
--
-- Идемпотентно, повторный запуск безопасен.
-- ============================================================

grant usage on schema crm to service_role;
grant all on all tables in schema crm to service_role;
grant all on all sequences in schema crm to service_role;
grant execute on all functions in schema crm to service_role;

alter default privileges in schema crm grant all on tables to service_role;
alter default privileges in schema crm grant all on sequences to service_role;
alter default privileges in schema crm grant execute on functions to service_role;
