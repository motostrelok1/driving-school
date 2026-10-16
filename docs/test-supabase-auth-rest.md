# Тестовый Auth и REST — первая рабочая конфигурация

Данный этап добавляет **новый** Docker Compose project `driving-school-supabase-test` с отдельным PostgreSQL volume, Auth и PostgREST. Снимок /opt/backups/supabase/cloud-backup.dump используется **исключительно для восстановления схемы public** без TABLE DATA. Тестовый Postgres с новыми секретами не подключается к `supabase-db` и не открывает порт БД на хосте.

- Auth: `127.0.0.1:19999`; PostgREST: `127.0.0.1:18080`.
- Оба endpoint доступны только с VDS или через SSH tunnel. Внешний HTTPS не настроен.
- JWT/пароли генерируются локально и хранятся в root-only `/opt/driving-school-supabase-test/.env`; **не публикуйте их**.
- Не включены: Storage, Envoy gateway, Realtime, Edge Functions, email delivery, cron, OneSignal и тестовый frontend.
- Миграция прикладных прав не доказывается совпадением SQL объектов; требуются Auth login и проверки RLS через HTTP прежде чем открывать доступ.
- **Важно:** конфигурация пока не проверена фактическим запуском на сервере. Compose и скрипт могут потребовать правок в зависимости от штатных postgres roles и текущей версии Auth.

## Установка и контроль

Для ручного запуска на VDS нужны два файла из этого PR, установленная директория `/opt/driving-school-supabase-test` и осознанный review. Сценарий выполняется только один раз и отказывается от перезаписи уже существующего test volume.

Проверить отдельно `docker compose config` с test env до запуска. Не копировать рабочий `.env`.

Перед установкой желательно посмотреть, что сервисы используют только новые ресурсы и локальные порты. Не менять production Nginx/Compose. После запуска проверить ответы API и отрицательные RLS сценарии; затем отдельным PR добавить Storage и gateway.

**Изоляция:** Docker network `internal: true` запрещает прямой внешний маршрут из test services, но Docker-группе и хостовому root доверяется полный доступ; это не криптографическая граница. Пользовательские записи из cloud архивов не импортируются.
