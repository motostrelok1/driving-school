# Аудит ролей и маршрутов

Тип: audit
Статус: planned
Готовность: 0%
Модуль: routing, auth
Роль пользователя: student, instructor, admin

## Цель

Проверить, что каждая роль попадает на правильный экран и не имеет доступа к чужим маршрутам.

## Контекст

- tasks/AI_TASK_PROMPT.md
- docs/project-map.md
- docs/mvp-scope.md
- status/modules.md
- src/App.tsx
- src/components/Layout.tsx
- src/routes/ProtectedRoute.tsx
- src/features/auth/AuthContext.tsx

## Можно менять

Ничего. Это audit-задача.

## Что проверить

- [ ] student после входа попадает на /student/schedule.
- [ ] instructor после входа попадает на /instructor/schedule.
- [ ] admin после входа попадает на /admin.
- [ ] student не открывает instructor/admin маршруты.
- [ ] instructor не открывает student/admin маршруты.
- [ ] admin не открывает student/instructor маршруты, если это ожидаемое поведение.
- [ ] Меню показывает только пункты текущей роли.

## Результат аудита

- Что работает:
- Проблемы:
- Спорные решения:
- Следующие задачи:
