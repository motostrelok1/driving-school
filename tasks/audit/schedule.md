# Аудит расписания

Тип: audit
Статус: planned
Готовность: 0%
Модуль: schedule
Роль пользователя: student, instructor, admin

## Цель

Проверить готовность расписания: получение занятий, отображение, создание и изменение статусов.

## Контекст

- tasks/AI_TASK_PROMPT.md
- docs/project-map.md
- docs/mvp-scope.md
- docs/data-model.md
- status/modules.md
- src/pages/StudentSchedulePage.tsx
- src/pages/SchedulePage.tsx
- src/pages/AdminSchedulePage.tsx
- src/features/schedule/useLessons.ts
- src/features/schedule/LessonList.tsx
- supabase/migrations/0001_initial.sql

## Можно менять

Ничего. Это audit-задача.

## Что проверить

- [ ] Ученик видит только свои занятия.
- [ ] Инструктор видит только свои занятия.
- [ ] Инструктор может отметить прошедшее занятие как completed.
- [ ] Инструктор может отменить прошедшее занятие.
- [ ] Админ может создать занятие.
- [ ] Проверить, видит ли админ все занятия или только связанные с ним.
- [ ] Проверить пустые состояния.
- [ ] Проверить формат дат и длительность.

## Результат аудита

- Что работает:
- Что требует исправления:
- Риски RLS:
- Следующие задачи:
