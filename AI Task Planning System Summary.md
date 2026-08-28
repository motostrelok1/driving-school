# AI Task Planning System Summary

## Что сделано

В проекте `driving-school-pwa` создана система планирования маленьких задач для ИИ-разработки текущего MVP.

Цель системы: давать ИИ не весь проект целиком, а отдельную небольшую задачу с понятным контекстом, границами, статусом, критериями готовности и отчетом о выполнении.

## Инвентаризация MVP

Было определено, что в проекте уже есть:

- авторизация через Supabase;
- роли `student`, `instructor`, `admin`;
- защищенные маршруты по ролям;
- кабинет ученика с расписанием;
- кабинет инструктора с расписанием и списком учеников;
- админка пользователей;
- создание занятий;
- таблицы Supabase: `profiles`, `groups`, `instructor_students`, `lessons`;
- базовая PWA/OneSignal-интеграция.

Также отмечено, что частично готовы или требуют проверки:

- группы;
- админское расписание;
- PWA/push;
- тесты;
- разделение UI и логики;
- актуальность RLS и ролевого доступа.

## Созданная структура

Добавлены рабочие папки:

```text
docs/
status/
tasks/
tasks/audit/
tasks/reports/
scripts/
```

Ключевые документы:

```text
docs/project-map.md
docs/mvp-scope.md
docs/data-model.md
status/modules.md
status/roadmap.md
tasks/backlog.md
```

## Правила работы ИИ

В корне проекта добавлены основные файлы:

```text
AI_TASK_PROMPT.md
TASK_TEMPLATE.md
```

Также сохранены копии:

```text
tasks/AI_TASK_PROMPT.md
tasks/TASK_TEMPLATE.md
```

В них описано:

- что ИИ должен читать перед началом задачи;
- какие файлы можно менять;
- какие файлы нельзя трогать;
- как разделять UI, логику, данные, интеграцию и тесты;
- куда писать результат;
- как обновлять статусы;
- как создавать отчет;
- что делать после завершения задачи.

## Audit-задачи

Созданы первые задачи для проверки текущего MVP без изменения кода:

```text
tasks/audit/auth.md
tasks/audit/roles-and-routes.md
tasks/audit/schedule.md
tasks/audit/admin.md
tasks/audit/groups.md
tasks/audit/pwa-push.md
```

## Отчеты по задачам

Созданы папки отчетов:

```text
tasks/reports/audit/
tasks/reports/ui/
tasks/reports/logic/
tasks/reports/data/
tasks/reports/integration/
tasks/reports/tests/
```

После выполнения задачи ИИ должен:

1. обновить сам task-файл;
2. создать или обновить отчет в `tasks/reports/<тип>/<название-задачи>.md`;
3. обновить `status/modules.md`, если изменилась готовность модуля;
4. обновить `tasks/backlog.md`, если появились новые задачи;
5. обновить HTML-дашборд, если менялись `status/modules.md` или `status/roadmap.md`.

## Статусы

В `status/modules.md` статусы переведены на русский:

```text
запланировано
в работе
частично
готово
заблокировано
```

## HTML-дашборд

Создан файл:

```text
planning-dashboard.html
```

В нем три вкладки:

### 1. Просмотр задач что сделано

Показывает данные из:

```text
status/modules.md
status/roadmap.md
```

Данные отображаются не как сырой Markdown, а как view:

- таблицы;
- бейджи статусов;
- заголовки;
- чек-листы.

### 2. Алгоритм действий

Содержит:

- алгоритм выбора следующей задачи;
- текущую MVP-карту;
- типы задач;
- главные файлы системы.

### 3. ИИ-инструкции

Содержит:

- что ИИ читает перед началом;
- промпт запуска задачи;
- что ИИ пишет после выполнения.

## Обновление дашборда без веб-сервера

Выбран вариант без локального веб-сервера.

`status/modules.md` и `status/roadmap.md` остаются источниками правды, а `planning-dashboard.html` является самодостаточной HTML-витриной.

Добавлен скрипт:

```text
scripts/update-dashboard.cjs
```

Он берет свежие данные из:

```text
status/modules.md
status/roadmap.md
```

и встраивает их внутрь:

```text
planning-dashboard.html
```

Добавлена команда:

```bash
npm run dashboard:update
```

Также можно запускать напрямую:

```bash
node scripts/update-dashboard.cjs
```

## Правило завершения задачи

Если ИИ меняет:

```text
status/modules.md
status/roadmap.md
```

то в конце задачи он должен обновить HTML-дашборд:

```bash
npm run dashboard:update
```

или:

```bash
node scripts/update-dashboard.cjs
```

## Ярлык на рабочем столе

Создан ярлык:

```text
C:\Users\VIP\OneDrive\Рабочий стол\Driving School PWA Dashboard.lnk
```

Он открывает:

```text
planning-dashboard.html
```

## Рабочий цикл

Рекомендуемый алгоритм работы:

```text
1. Открыть planning-dashboard.html.
2. Посмотреть status/modules.md и status/roadmap.md через первую вкладку.
3. Выбрать ближайшую задачу из tasks/backlog.md.
4. Передать ИИ конкретный task-файл.
5. ИИ выполняет задачу строго по AI_TASK_PROMPT.md и TASK_TEMPLATE.md.
6. ИИ обновляет task-файл и пишет отчет.
7. При необходимости обновляет modules/backlog/roadmap.
8. Если менялись modules или roadmap, запускает dashboard:update.
9. Следующая задача выбирается по обновленному состоянию.
```

## Главный результат

В проекте появилась система, которая позволяет:

- разбивать разработку на маленькие задачи;
- отдельно планировать UI, логику, данные, интеграцию и тесты;
- давать ИИ ограниченный контекст;
- фиксировать, что сделано и что осталось;
- видеть состояние MVP через HTML-дашборд;
- обновлять дашборд без веб-сервера.
