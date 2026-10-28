# Карта проекта — актуальная на 27.10.2026

Frontend: React Router, исходник маршрутов — `src/App.tsx`; таблица ниже фиксирует маршруты в main. Маршрут в коде **не гарантирует** готовность соответствующих данных после P0.

| Крупный раздел | Маршруты | Роль | Текущий режим |
|---|---|---|---|
| Вход/регистрация/пароль | `/login`, `/register`, `/reset-password` | public | Auth работает; у восстановления проверить негативные сценарии |
| Старт | `/` | auth | Редирект по роли |
| Ученик: профиль и теория | `/student/profile`, `/student/theory`, `/student/theory/course`, `/student/theory/course/pdd`, `/student/theory/course/pdd/:topicId` | student | 32 ПДД + прогресс чтения |
| Ученик: билеты/экзамен | `/student/theory/testing`, `/student/theory/training/tickets`, `/student/theory/training/topics`, `/student/theory/training/marathon`, `/student/theory/exam` | student | Частичная регрессия, официальная история отдельно |
| Ученик: вождение и прочее | `/student/practice`, `/student/schedule`, `/student/messages`, `/student/payment` | student | Вождение выключено, старые данные не переносились |
| Инструктор | `/instructor/schedule`, `/instructor/students`, `/instructor/messages` | instructor | Требуют регрессии после миграции |
| Админ: управление | `/admin`, `/admin/users`, `/admin/groups`, `/admin/schedule`, `/admin/tasks`, `/admin/settings` | admin | UI существует; данные вождения могут отсутствовать |
| Админ: теория | `/admin/pdd`, `/admin/pdd/preview`, `/admin/theory-bank` | admin | Курс на VDS, банк вопросов содержит тестовые записи |
| Админ: сообщения | `/admin/messages` | admin | Сообщения и push подтверждены |
| Неизвестный маршрут | `*` | public | NotFound |

Для ручной проверки см. `docs/testing/manual/README.md` (публикуется отдельным PR #210). Для инфраструктуры см. PR #208; для SQL/Edge CI — PR #169.
