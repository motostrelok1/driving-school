# Аудит авторизации

Тип: audit
Статус: planned
Готовность: 0%
Модуль: auth
Роль пользователя: public, student, instructor, admin

## Цель

Проверить, насколько готовы вход, регистрация, восстановление пароля, загрузка профиля и выход.

## Контекст

- tasks/AI_TASK_PROMPT.md
- docs/project-map.md
- docs/mvp-scope.md
- status/modules.md
- src/pages/LoginPage.tsx
- src/pages/RegisterPage.tsx
- src/features/auth/AuthContext.tsx
- src/hooks/useAuth.ts
- src/routes/ProtectedRoute.tsx
- supabase/migrations/0007_account_email_exists.sql

## Можно менять

Ничего. Это audit-задача.

## Нельзя менять

- Не менять код.
- Не менять БД.
- Не исправлять найденные проблемы в этой задаче.

## Что проверить

- [ ] Вход по email/password.
- [ ] Регистрация нового ученика.
- [ ] Создание профиля после регистрации.
- [ ] Восстановление пароля.
- [ ] Поведение при неверном пароле.
- [ ] Поведение при уже авторизованном пользователе.
- [ ] Выход из аккаунта.
- [ ] Загрузка role/profile.

## Результат аудита

Заполнить:

- Что работает:
- Что не проверено:
- Проблемы:
- Риски:
- Следующие задачи:
