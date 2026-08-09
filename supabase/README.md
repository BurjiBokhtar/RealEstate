# База данных

## Установка — ОДИН файл

Supabase → **SQL Editor** → откройте [`000_full_setup.sql`](000_full_setup.sql)
на GitHub → кнопка **Raw** → выделить всё (Ctrl+A) → скопировать → вставить →
**Run**. Это вся база: таблицы, роли, права, функции.

После него:
1. **Authentication → Users → Add user** — первый пользователь (Auto Confirm);
   он автоматически станет админом. Либо сразу войдите готовым аккаунтом из
   файла: `admin@crm.tj` / `Admin12345` (обязательно смените пароль в Настройках).
2. **Authentication → Sign In / Providers → Allow new users to sign up → OFF.**
3. Три ключа проекта → Vercel → Environment Variables → Redeploy.

Остальных сотрудников создаёте в Supabase → Authentication, а роли им даёте
в самой программе (Настройки → Сотрудники).

## Обновление уже работающей базы

Дашборд, страница «Должники» и список объектов считают свои итоги **в базе**
(функции `crm.dashboard_summary`, `crm.overdue_contracts`,
`crm.building_unit_stats`). Без них дашборд покажет красную плашку «не удалось
посчитать статистику» и нули.

Supabase → **SQL Editor** → вставить содержимое
[`migrations/038_dashboard_summary.sql`](migrations/038_dashboard_summary.sql),
затем [`migrations/039_overdue_pagination.sql`](migrations/039_overdue_pagination.sql)
[`migrations/040_sms_scheduler.sql`](migrations/040_sms_scheduler.sql)
[`migrations/041_client_second_phone.sql`](migrations/041_client_second_phone.sql)
[`migrations/042_paid_amount_from_payments.sql`](migrations/042_paid_amount_from_payments.sql)
[`migrations/043_real_overdue.sql`](migrations/043_real_overdue.sql)
[`migrations/044_potential_revenue_detail.sql`](migrations/044_potential_revenue_detail.sql)
[`migrations/045_area_split_and_overdue_by_building.sql`](migrations/045_area_split_and_overdue_by_building.sql)
и [`migrations/046_gapless_revenue_series.sql`](migrations/046_gapless_revenue_series.sql)
→ **Run**. Все файлы идемпотентные, повторный запуск безопасен.

## Переменные окружения на сервере

Две переменные задаются **на Vercel**, а не в программе. Без них SMS-рассылка
и создание сотрудников молча отклоняются с ошибкой доступа.

### 1. `SUPABASE_SERVICE_ROLE_KEY` — где взять

1. Supabase → выберите **тот же проект**, что указан в
   `NEXT_PUBLIC_SUPABASE_URL`. Имя проекта — это первая часть адреса:
   `https://<ЭТО-И-ЕСТЬ-ПРОЕКТ>.supabase.co`.
2. **Project Settings → API Keys**.
3. Скопируйте ключ:
   - в новых проектах он в разделе **Secret keys** и начинается с `sb_secret_…`;
   - в старых — в **Project API keys**, строка **`service_role`**, кнопка
     **Reveal**, ключ начинается с `eyJ…`.

**Ключ должен быть из того же проекта, что и URL.** Ключ из другого проекта —
самая частая причина ошибки: сервер не может проверить вашу сессию, и в
Настройках появляется сообщение с названиями обоих проектов.

Это **секрет**: он обходит все правила доступа RLS. Никогда не давайте ему
префикс `NEXT_PUBLIC_` (это отправит его в браузер) и не коммитьте в git.

### 2. `CRON_SECRET` — где взять

Нигде: это **любая длинная случайная строка**, вы придумываете её сами. Она
нужна, чтобы платный SMS-шлюз не мог дёрнуть кто угодно из интернета: Vercel
подставляет её в заголовок `Authorization` при вызове задач из `vercel.json`,
а маршрут сверяет. Не задана — каждый ночной запуск отклоняется, и SMS не
уходят.

Сгенерировать (любой из способов):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

### 3. Как задать в Vercel

1. Vercel → ваш проект → **Settings → Environment Variables**.
2. **Add New** → Key: `SUPABASE_SERVICE_ROLE_KEY`, Value: ключ из Supabase.
3. Отметьте окружения — как минимум **Production**.
4. Так же добавьте `CRON_SECRET`.
5. **Deployments → у последнего деплоя ⋯ → Redeploy.** Без этого шага Vercel
   продолжит работать со старыми значениями: переменные читаются в момент
   сборки, а не на лету.

Для локального запуска те же строки кладутся в `.env.local` в корне проекта
(см. `.env.local.example`); этот файл в git не попадает.

### 4. Проверка

Настройки → **SMS-напоминания**. Панель внизу сама скажет, чего не хватает:
не заполнены ключ/имя отправителя, не задан `CRON_SECRET`, либо ключ от
другого проекта Supabase. Когда предупреждений нет:

1. **«Отправить»** рядом с номером — одно тестовое SMS.
2. **«Отправить сейчас»** — прогон рассылки по графику прямо сейчас (жать
   можно повторно: у каждого взноса своя отметка, дважды никому не уйдёт).
3. **«Запустить рассылку»** — включает ежедневный автоматический прогон.

## Папка `migrations/`

Это исходные части, из которых собран `000_full_setup.sql` — их трогать не
нужно. Они лежат отдельно, чтобы можно было точечно обновлять уже работающую
базу: когда добавляется новая возможность, запускается только новый файл
(например `031_office_type.sql`), а не весь `000` заново. Все файлы
идемпотентные — повторный запуск ничего не ломает.

## Обязательная настройка в Dashboard

Authentication → Sign In / Providers → **Allow new users to sign up → OFF**.

## Переменные окружения

См. `.env.local.example` в корне проекта. Отдельно: `SUPABASE_SERVICE_ROLE_KEY`
(нужен только для кнопки «создать сотрудника прямо в программе»; список и роли
работают без него).
