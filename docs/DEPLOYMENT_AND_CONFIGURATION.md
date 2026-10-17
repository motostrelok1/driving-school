# Driving School PWA — развёртывание и настройка

Статус: руководство по текущему исходному коду и подтверждённому тестовому стенду (2026-10-17). Не является автоматическим production-install скриптом. Перед эксплуатацией сверить реальные пути, Nginx и CI на конкретном VDS. **Не изменять** production, `edu.dvizh-school.ru` и `lms.dvizh-school.ru` по этому руководству без отдельной проверки.

## Архитектура
Репозиторий `motostrelok1/driving-school`: React/Vite/TypeScript PWA. `npm run build` вызывает `tsc -b && vite build`, выдаёт `dist/`. Backend — Supabase Auth, REST/PostgREST, Storage, Realtime и Edge Functions. Для теста: фронтенд `https://test.dvizh-school.ru`, API `https://supabase-test.dvizh-school.ru`; рабочие `dvizh-school.ru` и `supabase.dvizh-school.ru` не смешивать с тестом.

## Требования
Ubuntu/VDS с Nginx и HTTPS, Node.js совместимый с Vite 8 (рекомендуется Node 22+), npm, Git, DNS A-записи для PWA и API. Перед установкой проверить версию Node, RAM, диск, порты, текущие виртуальные хосты и резервные копии. Размещать фронтенд и backend в разных каталогах/контейнерных проектах.

## Сборка тестовой PWA (существующее окружение)
```bash
cd /var/www/driving-school-test
git status --short
git fetch origin
# Обновлять ветку только после проверки локальных изменений и версии backend.
npm ci
npm run lint
npm run build
```
Создать `.env.local` **на сервере** с правами 0600, не помещать в Git:
```dotenv
VITE_SUPABASE_URL=https://supabase-test.dvizh-school.ru
VITE_SUPABASE_ANON_KEY=<TEST_ANON_KEY FROM LOCAL ROOT-ONLY TEST ENV>
# VITE_ONESIGNAL_APP_ID не задавать в тесте
```
Поскольку Vite подставляет `VITE_*` во время сборки, обязательно пересобрать при смене окружения. Anon key публичен по конструкции; **service_role, JWT_SECRET и SMTP-пароли никогда не размещать в VITE_ переменных**. Значение TEST_ANON_KEY брать только из локального root-only `/opt/driving-school-supabase-test/.env`, не выводить на экран и не копировать в чат. Разрешения `.env.local`: `chmod 600 .env.local`.

## HTTPS и Nginx
Подготовить отдельный Nginx vhost для `test.dvizh-school.ru`, который раздаёт `/var/www/driving-school-test/dist` как статическую PWA. SPA fallback: `try_files $uri $uri/ /index.html`; проверить выдачу `manifest.webmanifest`, service worker и статических assets. Сначала `nginx -t`, затем включить только этот vhost, выпустить TLS сертификат и проверить HTTP → HTTPS. При смене домена важно другое происхождение для PWA service worker: не размещать test на production origin. Реальная конфигурация Nginx на VDS может отличаться; не заменять существующий production vhost.

## Backend и разрешённые origin
API gateway обязан поддерживать `/auth/v1`, `/rest/v1`, `/storage/v1`, `/realtime/v1` (WebSocket upgrade) и `/functions/v1`. CORS для test origin: только `https://test.dvizh-school.ru`, корректный OPTIONS и ACAO, без раскрытия credentials. Function origin задаётся `FUNCTIONS_CORS_ORIGIN`. Backend test использует отдельные JWT и пароль PostgreSQL, Mailpit и заглушки OneSignal. Не подключать test к рабочей БД или к production OneSignal.

## Регистрация, почта, роли
В GoTrue выбирать режим: `MAILER_AUTOCONFIRM=false` для обязательного подтверждения email; в тесте SMTP → Mailpit; для production нужны отдельные реальные SMTP credentials, FROM/domain, TLS, SPF/DKIM/DMARC и корректные redirect URL в Auth. Проверить подтверждение, resend, recovery и истечение ссылок. Создание профиля ученика зависит от триггера `on_auth_user_created` на `auth.users` и `public.handle_new_user`: нельзя восстановить только схему `public` и забыть триггер. Первый администратор создаётся через согласованный bootstrap, не через изменение user metadata. Роли student/instructor/admin живут в `public.profiles`, доступ ограничивает RLS.

Web Push до email-confirmation **пока не реализован**: план в `docs/REGISTRATION_PRECONFIRM_PUSH_SPEC.md`, PR #198. Подписка без сессии требует отдельной защищённой привязки. Не считать её функцией релиза.

## Миграции, Storage, Realtime и Edge
Тестовый стек `docker/test-supabase` построен на частичном schema-only восстановлении из архива и catch-up SQL; **это не способ установки новой школы с нуля**. Найдено отставание миграций 0035/0040/0056, PR #197 должен быть проверен и согласован отдельно. Не применять старые миграции к production автоматически; PR #169 draft и не разрешает деплой.

Storage: бакеты `avatars`, `lesson-media` (публичные) и `student-documents` (приватный), проверять RLS. Realtime: схема `_realtime` и таблицы публикации `supabase_realtime` должны быть созданы **до старта**; `TEST_REALTIME_ENC_KEY` — 16 байт. Edge runtime: шесть прикладных функций, специальные cron/webhook секреты, тестовые OneSignal credentials. Для production настоящие push включаются только после проверки и явного разрешения.

## Smoke checklist после деплоя
1. HTTPS PWA/API, manifest, service worker, отсутствие production URL в тестовом bundle; Auth signup/login/refresh/recovery, email confirmation.
2. Аккаунты admin/instructor/student: роли, RLS, инструктор/слоты/бронь/отмена, теория (банк/назначение/попытка), чаты, документы и Storage; негативные проверки доступа к чужим записям.
3. Realtime WebSocket доставляет разрешённые изменения, чужие не доставляет; Edge endpoints отклоняют неавторизованные вызовы.
4. Mailpit принимает тестовые письма, OneSignal mock не отправляет настоящих push; cron не обращается к рабочему API.
5. PostgreSQL + Storage backup и восстановление проверены на новых томах, есть проверенный rollback приложения.

Тесты репозитория: `scripts/supabase-test-auth-flows.sh`, `scripts/supabase-test-rls-roles.sh`, `scripts/supabase-test-rls-data.sh`, `scripts/supabase-test-storage.sh`, `scripts/supabase-test-realtime.sh`, `scripts/supabase-test-functions.sh`. Их следует запускать **только на выделенном тестовом стенде** в соответствии с их guards.

## Обновление и откат
Перед обновлением: снять проверяемую резервную копию DB+Storage, зафиксировать git SHA/образ/теги, проверить наличие незакоммиченных изменений, CI и миграционную совместимость. Применять миграции только после тестирования на клоне. Для отката интерфейса можно вернуть предыдущий `dist`; откат базы не равен откату фронтенда и требует отдельной процедуры восстановления.

## Границы готовности
Test PWA доступна по HTTPS согласно серверной проверке; полная браузерная приёмка, backup/restore и финальный cutover audit ещё необходимы. Будущий воспроизводимый чистый деплой выполняет **Driving School Kit поверх Supabase Lite Core**, не этот test restore.
