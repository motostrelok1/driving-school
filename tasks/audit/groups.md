# Аудит групп

Тип: audit
Статус: planned
Готовность: 0%
Модуль: groups
Роль пользователя: admin

## Цель

Проверить, что уже есть для учебных групп и что нужно добавить, чтобы закрыть MVP.

## Контекст

- tasks/AI_TASK_PROMPT.md
- docs/project-map.md
- docs/mvp-scope.md
- docs/data-model.md
- status/modules.md
- src/pages/AdminDashboardPage.tsx
- src/features/admin/useAdmin.ts
- src/types/index.ts
- supabase/migrations/0001_initial.sql

## Можно менять

Ничего. Это audit-задача.

## Что проверить

- [ ] Таблица groups есть в БД.
- [ ] Тип Group есть в TypeScript.
- [ ] useGroups получает группы.
- [ ] useCreateGroup существует.
- [ ] Есть ли UI создания группы.
- [ ] Есть ли UI редактирования группы.
- [ ] Есть ли UI назначения ученика в группу.
- [ ] Достаточно ли полей name/category/start_date для MVP.

## Результат аудита

- Что уже есть:
- Чего не хватает:
- Минимальная задача для закрытия MVP:
- Следующие задачи:
