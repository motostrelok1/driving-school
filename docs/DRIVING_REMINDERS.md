# Автоматическое напоминание о занятии по вождению

Функция `send-driving-reminders` отправляет ученику напоминание примерно за 24 часа до будущего занятия со статусом `booked`.

## Что делает функция

- проверяет занятия в окне от 23,5 до 24,5 часов от текущего момента;
- отправляет push через OneSignal;
- сохраняет уведомление в общей истории сообщений;
- пишет запись в `driving_lesson_reminders`;
- не отправляет один и тот же тип напоминания по одному слоту повторно;
- при ошибке отправки снимает idempotency-claim, чтобы следующая попытка могла повторить отправку.

## Настройка

1. Выполнить миграцию `0033_driving_lesson_reminders.sql`.
2. Создать Edge Function `send-driving-reminders` в Supabase Dashboard и вставить код из `supabase/functions/send-driving-reminders/index.ts`.
3. Добавить секрет `DRIVING_REMINDER_SECRET` в Edge Function Secrets. Значение выбирает администратор и не хранит в репозитории.
4. Отключить legacy Verify JWT для этой функции. Доступ защищён заголовком `X-Reminder-Secret`.
5. В Supabase Cron создать HTTP-задачу, которая выполняется каждые 30 минут:
   - Method: POST
   - URL: `https://dznjopipisdfrojlpxrz.supabase.co/functions/v1/send-driving-reminders`
   - Header: `X-Reminder-Secret` со значением того же секрета.
6. Для теста создать booked-слот примерно через 24 часа и вручную запустить Cron/HTTP task один раз.

## Ожидаемый результат

Ученик получает push «Напоминание о занятии». В истории уведомлений появляется запись с временем занятия и ФИО инструктора, если инструктор указан.
