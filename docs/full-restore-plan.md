# Полное восстановление Supabase — план и защитные условия

## Проверено
- Облачный архив `/opt/backups/supabase/cloud-backup.dump` — формат pg_restore.
- Отдельный контейнер `cloud-restore-smoke-v1` (без сети) успешно восстановил 28 строк `public.profiles`.
- **Это не подтверждает полное восстановление Auth, Storage, RLS и расширений.**

## Шаг A — безопасная инвентаризация (этот PR)
Сценарий `scripts/supabase-full-restore-inventory.sh` читает только TOC pg_restore, подсчитывает объекты и проверяет уже восстановленные строки profiles. Никаких SQL с изменением данных. Нужно root-owned установить в `/usr/local/sbin/supabase-full-restore-inventory`; установить единственное правило sudoers для `deploy` с пустым списком аргументов. Запуск через workflow `supabase-full-restore-inventory.yml`, после явного включения repository variable `SUPABASE_FULL_RESTORE_INVENTORY_ENABLED=true`.

## Шаг B — дизайн безопасного полноценного restore (ещё не реализован)
1. Подготовить отдельный *новый* кластер Supabase PostgreSQL соответствующей версии, со штатными системными ролями и схемами. Вариант создания roles и extensions согласовать по результату TOC и штатных SQL миграций.
2. Полностью исключить побочные эффекты: изоляция сети, отсутствие published ports, неактивные `pg_cron`, `pg_net` и любой outbound HTTP. Не выполнять фоновые задания из облачного дампа.
3. Разделить системную и прикладную схему; избирательно восстановить Auth users/identities и public schema с проверкой прав, владельцев, RLS, триггеров, FK и расширений. Нельзя просто восстанавливать полный дамп в работающий `supabase-db`.
4. Сверить количество записей и UUID пользователей, записи Auth, таблицы Storage; отдельно перенести файлы Storage (дамп БД не содержит сами объекты).
5. Проверить вход и операции под ролями `anon`, `authenticated`, `service_role`, SMTP/JWT/Auth, Edge Functions. Любые действия, потенциально отправляющие уведомления, выполнять только в изоляции.
6. Перед cutover сделать свежий backup облака и storage, проверить восстановление и предусмотреть rollback.

## Запреты
- Не трогать `supabase-db`, `supabase-restore-db`, существующие тома.
- Не давать пользователю CI полный доступ к Docker socket, общий `sudo` или SQL superuser.
- Никаких персональных записей, JWT, паролей или дампов в GitHub Actions логах.
- Полный restore включать только после review и отдельных разрешений; этот PR этого НЕ делает.
