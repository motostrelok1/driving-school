# Аудит PWA и push

Тип: audit
Статус: planned
Готовность: 0%
Модуль: pwa, notifications
Роль пользователя: student, instructor, admin

## Цель

Проверить готовность PWA-сборки, сервис-воркера и OneSignal push-уведомлений.

## Контекст

- tasks/AI_TASK_PROMPT.md
- docs/project-map.md
- docs/mvp-scope.md
- status/modules.md
- src/components/NotificationButton.tsx
- src/lib/onesignal.ts
- vite.config.ts
- public/push/onesignal/OneSignalSDKWorker.js
- package.json

## Можно менять

Ничего. Это audit-задача.

## Что проверить

- [ ] vite-plugin-pwa настроен.
- [ ] manifest существует после сборки.
- [ ] service worker создается.
- [ ] OneSignal App ID берется из env.
- [ ] Без App ID кнопка не ломает приложение.
- [ ] Можно запросить разрешение на уведомления.
- [ ] Можно отключить уведомления.
- [ ] Состояния enabled/disabled/blocked отображаются корректно.
- [ ] PWA устанавливается в браузере.

## Результат аудита

- Что работает:
- Что требует реальной проверки в браузере:
- Риски:
- Следующие задачи:
