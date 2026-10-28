# Автошкола «Движ» — PWA

Веб-приложение автошколы с ролями **администратор**, **инструктор**, **ученик**, курсом ПДД, расписанием, сообщениями и push-уведомлениями.

## Production на 27 октября 2026

- Сайт: https://dvizh-school.ru — Nginx, React/Vite PWA на VDS.
- Собственный Supabase API: https://supabase.dvizh-school.ru; PostgreSQL, GoTrue Auth, PostgREST, Storage, Edge Functions.
- Ранее использованный Supabase Cloud сохранён для возможного отката, **не является активным production**.
- Первый перенос включал **пользователей и всю «Теорию»**, но не переносил старые чаты, занятия, платежи, документы и расписание.
- Роли/профили: **33** (30 Cloud + 3 keeper). **32** опубликованных раздела ПДД, **49** ревизий, 4 изображения из собственного Storage.
- Доступ к «Вождению» временно отключён через `driving_enabled=false`. Нельзя интерпретировать отсутствие старых записей как удаление данных Cloud.
- OneSignal и сообщения проверены после миграции; статус «Прочитано» может иметь ошибочный цвет из-за старого delivery_status.
- P0.10 — период наблюдения **24–72 ч** и первый автоматический бэкап после исправления ночного cron ещё требуют финального отчёта. Не объявлять окончательный PASS заранее.

## Технологии

React 19, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query, Supabase (self-hosted) и OneSignal Web Push. GitHub Actions используются для сборки/доставки frontend; автоматический production deploy SQL/Edge в PR #169 **не включён**.

## Локальная разработка

```bash
npm install
cp .env.example .env.local
npm run dev
npm run build
```

Задайте `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_ONESIGNAL_APP_ID` для нужного окружения. Только публичные браузерные ключи допустимы в `VITE_*`; REST API Key OneSignal, service_role, пароли PostgreSQL и SSH-ключи никогда не помещать в frontend, PR или логи. Деплой production выполняется по проверенному runbook, не командой из локальной инструкции.

## Документация и план

- [Текущий статус и исторический прогресс](PROGRESS.md)
- [Roadmap](status/roadmap.md)
- [Готовность модулей](status/modules.md)
- [Актуальный backlog](tasks/backlog.md)
- [Карта разделов и маршрутов](docs/project-map.md)
- [Manual QA / чек-листы](docs/testing/manual/README.md) — отдельный PR по issue #210
- [Инструкция администратора](docs/ADMINISTRATOR_USER_GUIDE.md)
- [PR #208 — перенос / стабилизация](https://github.com/motostrelok1/driving-school/pull/208)
- [PR #180 — видео-прогресс](https://github.com/motostrelok1/driving-school/pull/180)
- [PR #169 — CI/CD SQL/Edge](https://github.com/motostrelok1/driving-school/pull/169)

Статусы: **Готово и проверено**, **Реализовано, не проверено**, **В работе**, **Запланировано**. Наличие исходника или слитого PR не доказывает работу на production.

## Приоритеты

1. Завершить наблюдение P0.10 и проверку автоматического бэкапа.
2. Ввести ручные регрессионные тест-кейсы по разделам (#210).
3. Протестировать SQL 0063 и реализовать админский серверный прогресс (#180).
4. Доделать карточку здоровья (#172), уведомления о слотах (#160), безопасность SQL/Edge CI (#169).
5. Отдельно согласовать восстановление вождения и связанных данных на собственном Supabase.
