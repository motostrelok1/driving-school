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

## Официальное тестирование

Назначение из карточки ученика, проверяемый банк вопросов и серверное прохождение в «Теория → Тестирование»: [инструкция установки и проверки](docs/THEORY_ASSESSMENTS.md). Нужны миграции `0034_theory_assessments.sql`, `0035_theory_assessment_execution.sql` и Edge Function `send-theory-assignment`. Исходные билеты импортируются как черновики: перед официальным тестом администратор проверяет и одобряет достаточное количество вопросов.

## Запланировано: раскрытая карточка ученика

- [Issue #172](https://github.com/motostrelok1/driving-school/issues/172) — редизайн списка учеников администратора: раскрытая карточка по утверждаемому макету, прогресс теории/вождения, здоровье/скоринг, проблемы и быстрые действия.
- [Спецификация](docs/ADMIN_STUDENT_EXPANDED_CARD_SPEC.md). Статус: запланировано; реализация не начата.

## Актуальный статус и план (16.10.2026)

- [Сводка реализованного и запланированного по рабочему чату](docs/CHAT_ROADMAP_2026-10-16.md) — источник текущего статуса PR/Issues, приоритетов и ограничений.
- [#172](https://github.com/motostrelok1/driving-school/issues/172): раскрытая админ-карточка **частично реализована** (PR #174/#178 merged); теория в PR #180 ожидает миграцию; скоринг впереди. Это уточняет более раннюю отметку «не начато» выше.
- [#160](https://github.com/motostrelok1/driving-school/issues/160): недельная сетка готова, push по 3+ свободным слотам раз в час — впереди.
- [#170](https://github.com/motostrelok1/driving-school/issues/170): аудит производительности запланирован; спецификация в [PR #171](https://github.com/motostrelok1/driving-school/pull/171), пока не merged.
- [#167](https://github.com/motostrelok1/driving-school/issues/167): Tiptap описан, код редактора пока не внедрён.

**Фактическое размещение PWA:** `dvizh-school.ru` на собственном сервере с GitHub Actions auto-deploy. Раздел «Деплой на Vercel» выше является устаревшей первоначальной инструкцией и не описывает текущий production. Отдельные сайты `edu.dvizh-school.ru` и `lms.dvizh-school.ru` этим репозиторием не затрагиваются.

## Текущий план на 18.10.2026

**Актуальный источник статуса:** [сводка 18 октября](docs/CHAT_STATUS_2026-10-18.md). Более ранние блоки «не начато» / «PR #171 открыт» ниже/выше — исторические и могут устареть. PR #171 закрыт без merge, но спецификация производительности уже в main; PR #180 открыт, требует согласования SQL 0063. Код карточки #174/#178 merged, скоринг и push #160 ещё впереди.
