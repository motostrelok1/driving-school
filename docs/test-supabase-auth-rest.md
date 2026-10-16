# Тестовый Auth и REST — первая рабочая конфигурация

Данный этап добавляет **новый** Docker Compose project `driving-school-supabase-test` с отдельным PostgreSQL volume, Auth и PostgREST. Снимок /opt/backups/supabase/cloud-backup.dump используется **исключительно для восстановления схемы public** без TABLE DATA. Тестовый Postgres с новыми секретами не подключается к `supabase-db` и не открывает порт БД на хосте.

- Auth: `127.0.0.1:19999`; PostgREST: `127.0.0.1:18080`; Mailpit UI: `127.0.0.1:18025`.
- Оба endpoint доступны только с VDS или через SSH tunnel. Внешний HTTPS не настроен.
- JWT/пароли генерируются локально и хранятся в root-only `/opt/driving-school-supabase-test/.env`; **не публикуйте их**.
- Не включены: Storage, Envoy gateway, Realtime, Edge Functions, cron, OneSignal и тестовый frontend.
- Миграция прикладных прав не доказывается совпадением SQL объектов; требуются Auth login и проверки RLS через HTTP прежде чем открывать доступ.

## Что изменилось после первого рабочего запуска

1. **Триггер `on_auth_user_created` создаётся установщиком.** Восстановление из архива грузит DDL только схемы `public`, поэтому триггер на `auth.users` в дампе отсутствует. `scripts/install-test-supabase-auth-rest.sh` после restore выполняет `CREATE OR REPLACE FUNCTION public.handle_new_user()` (ФИО из `first_name`/`last_name`/`middle_name`| `patronymic`, телефон, роль жёстко `student`) и `CREATE TRIGGER on_auth_user_created`, затем проверяет наличие триггера. Без этого шага регистрация проходит, но профиль не создаётся.
2. **Mailpit ловит всю почту стека.** Сервис `mailpit` внутри `test_internal`; SMTP Auth направлен на `mailpit:1025`, заданы `GOTRUE_SMTP_FROM` / `GOTRUE_SMTP_ADMIN_EMAIL`. Исходящих рассылок быть не может: сеть internal. Письма (recovery/confirm) читаются через UI `127.0.0.1:18025` или API `/api/v1/message/latest`.
3. **Публикация портов — через socat-прокси.** У контейнеров, подключённых только к `internal: true` сети, Docker не поднимает host port forwarding (проверено на docker 29.9.1). Поэтому `ports:` убраны с auth/rest/mailpit и добавлены сервисы `auth-local`, `rest-local`, `mailpit-local` (alpine/socat), подключённые к обеим сетям (`test_internal` + `test_edge`) и публикующие порты только на `127.0.0.1`. Сервисы данных остаются без исходящего доступа.
4. **Регрессионный тест auth-потоков** — `scripts/supabase-test-auth-flows.sh`. Прогоняет на живом стеке: signup → строка профиля с ФИО/телефоном/ролью, login/refresh/logout, отказ при неверном пароле, сброс пароля через письмо mailpit (`/recover` → `token_hash` из письма → `/verify` → смена пароля → повторный вход, старый пароль отклонён). Создаёт одного случайного тестового пользователя за прогон, не трогает production-контейнеры.

## Установка и контроль

Для ручного запуска на VDS нужны два файла из этого PR, установленная директория `/opt/driving-school-supabase-test` и осознанный review. Сценарий выполняется только один раз и отказывается от перезаписи уже существующего test volume.

Проверить отдельно `docker compose config` с test env до запуска. Не копировать рабочий `.env`.

Перед установкой желательно посмотреть, что сервисы используют только новые ресурсы и локальные порты. Не менять production Nginx/Compose. После запуска проверить ответы API и отрицательные RLS сценарии; затем отдельным PR добавить Storage и gateway.

**Изоляция:** Docker network `internal: true` запрещает прямой внешний маршрут из test services, но Docker-группе и хостовому root доверяется полный доступ; это не криптографическая граница. Пользовательские записи из cloud архивов не импортируются.
