# AGENTS.md — Правила работы с проектом

## Что это за проект

Progressive Web Application для автошколы. MVP включает кабинеты ученика, инструктора и администратора с расписанием занятий, управлением пользователями и push-уведомлениями.

## Стек и ключевые технологии

- **Frontend:** React 19, TypeScript, Vite
- **Styling:** Tailwind CSS v4 (CSS-based конфигурация через `@import "tailwindcss"` и `@theme`)
- **State / Server cache:** TanStack Query (React Query)
- **Routing:** React Router v7
- **Backend / Auth / DB:** Supabase (PostgreSQL, Auth, RLS)
- **Push notifications:** OneSignal Web Push
- **Icons:** Lucide React
- **Dates:** date-fns
- **Utilities:** clsx + tailwind-merge

## Архитектурные решения

### Организация кода

- `src/components/` — чистые UI-компоненты без бизнес-логики.
- `src/features/` — бизнес-логика, разбитая по доменам.
- `src/pages/` — страницы, собирающие компоненты и фичи.
- `src/hooks/` — общие переиспользуемые хуки.
- `src/lib/` — инициализация внешних сервисов.
- `src/types/` — TypeScript-типы.
- `supabase/migrations/` — SQL-миграции схемы.

### Паттерны

- Все серверные операции оборачиваются в TanStack Query hooks (`useQuery` / `useMutation`).
- Доступ по ролям реализован через `ProtectedRoute` и проверку `role` из `useAuth`.
- Supabase RLS-политики отвечают за безопасность данных на уровне БД.
- Стилизация — Tailwind utility classes, составные классы через `cn()`.

## Как запускать и проверять

```bash
npm install
npm run dev     # http://localhost:5173
npm run build   # production-сборка
npm run lint    # линтер
```

## Правила внесения изменений

1. **Минимальные изменения.** Не переписывай лишнее, не меняй форматирование и стиль без нужды.
2. **Сохраняй существующие паттерны.** Новый код должен читаться так же, как старый.
3. **Проверяй сборку.** После изменений обязательно `npm run build` и `npm run lint`.
4. **Обновляй миграции.** Если меняешь схему БД — добавь или измени SQL в `supabase/migrations/`.
5. **Обновляй типы.** Новые сущности добавляй в `src/types/index.ts`.
6. **Обновляй env-переменные.** Новые ключи добавляй в `.env.example`.
7. **Обновляй документацию.** Если изменения касаются архитектуры или запуска — правь README и `КАК_ВНОСИТЬ_ИЗМЕНЕНИЯ.md`.

## Роли пользователей

- `student` — ученик, видит своё расписание.
- `instructor` — инструктор, видит расписание, своих учеников, отмечает занятия.
- `admin` — администратор, управляет пользователями, группами, расписанием.

## Важные файлы

- `src/App.tsx` — маршруты и провайдеры.
- `src/features/auth/AuthContext.tsx` — контекст авторизации.
- `src/hooks/useAuth.ts` — хук для доступа к авторизации.
- `src/routes/ProtectedRoute.tsx` — защита маршрутов по ролям.
- `src/lib/supabase.ts` — инициализация Supabase.
- `src/lib/onesignal.ts` — инициализация OneSignal.
- `supabase/migrations/0001_initial.sql` — начальная схема БД.
- `vite.config.ts` — конфиг Vite и PWA.
- `src/index.css` — Tailwind CSS конфигурация.

## Чего избегать

- Не используй `node-sass` или тяжёлые нативные зависимости без согласования.
- Не коммить `.env.local` и другие файлы с секретами.
- Не добавляй лишние абстракции ради абстракций.

## Связь с пользователем

- Все ответы пиши на русском языке.
- Для крупных изменений используй режим планирования.
- Если требования неясные — уточняй через AskUserQuestion.
