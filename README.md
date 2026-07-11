# Автошкола PWA

Progressive Web Application для автошколы с личными кабинетами ученика, инструктора и администратора.

## Возможности MVP

- Регистрация и вход через email/пароль (Supabase Auth)
- Роли: ученик, инструктор, администратор
- Кабинет ученика: расписание занятий, история
- Кабинет инструктора: расписание, список учеников, отметка занятий
- Кабинет администратора: пользователи, группы, расписание
- Push-уведомления через OneSignal
- PWA: установка на телефон/десктоп, офлайн-кэширование

## Стек

- React 19 + TypeScript
- Vite + `vite-plugin-pwa`
- Tailwind CSS v4
- React Router + TanStack Query
- Supabase (Auth + PostgreSQL)
- OneSignal Web Push
- Vercel (хостинг)

## Быстрый старт

### 1. Клонирование и установка зависимостей

```bash
cd driving-school-pwa
npm install
```

### 2. Настройка Supabase

1. Создайте проект на [supabase.com](https://supabase.com).
2. Перейдите в SQL Editor и выполните содержимое файла `supabase/migrations/0001_initial.sql`.
3. Включите Email/Password провайдер в Authentication → Providers.
4. Скопируйте URL и anon key из Project Settings → API.

### 3. Настройка OneSignal (опционально)

1. Создайте приложение на [onesignal.com](https://onesignal.com).
2. Выберите платформу Web.
3. Скопируйте App ID.

### 4. Переменные окружения

Скопируйте `.env.example` в `.env.local` и заполните:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_ONESIGNAL_APP_ID=your-onesignal-app-id
```

### 5. Запуск локально

```bash
npm run dev
```

Приложение будет доступно по адресу `http://localhost:5173`.

## Создание первого администратора

Через Supabase SQL Editor выполните:

```sql
-- Сначала зарегистрируйтесь через приложение, затем выполните:
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'your-admin-email@example.com';
```

Или включите подтверждение email и назначьте роль через SQL после регистрации.

## Деплой на Vercel

1. Загрузите проект на GitHub.
2. Импортируйте репозиторий в [Vercel](https://vercel.com).
3. Добавьте переменные окружения (с префиксом `VITE_`).
4. Нажмите Deploy.

## Роли пользователей

- `student` — ученик, видит своё расписание
- `instructor` — инструктор, видит расписание и учеников
- `admin` — администратор, управляет пользователями и расписанием

## Структура проекта

```
src/
  components/       # UI-компоненты и Layout
  features/         # Фиче-модули (auth, schedule, admin, instructors)
  hooks/            # Общие React-хуки
  lib/              # Инициализация Supabase и OneSignal
  pages/            # Страницы приложения
  routes/           # Защищённые маршруты
  types/            # TypeScript типы
  utils/            # Утилиты
```

## Следующие шаги

- Кабинет родителя
- Кабинет директора с отчётами
- CRM: воронка продаж, договоры, оплаты
- Чат между учеником и инструктором
