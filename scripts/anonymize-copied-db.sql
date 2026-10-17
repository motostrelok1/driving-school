-- Анонимизация тестовой БД driving-school-supabase-test (одна транзакция).
-- Затрагивает только auth/public/storage схемы тестового контейнера.
-- Демо- и синтетические аккаунты (*.example.invalid, *.test.local) не трогаем.
BEGIN;

-- Пользователи, подлежащие анонимизации (реальные идентификаторы входа)
CREATE TEMP TABLE anon_users AS
SELECT u.id, u.email AS old_email, p.role
FROM auth.users u JOIN public.profiles p ON p.id = u.id
WHERE u.email NOT LIKE '%@example.invalid' AND u.email NOT LIKE '%test.local';

-- 1. Auth: согласованная замена email и метаданных, блокировка пароля
UPDATE auth.users u
SET email = 'anon-' || substr(md5(u.id::text), 1, 12) || '@example.invalid',
    raw_user_meta_data = jsonb_build_object(
      'email', 'anon-' || substr(md5(u.id::text), 1, 12) || '@example.invalid',
      'email_verified', true,
      'first_name', CASE a.role WHEN 'student' THEN 'Ученик' WHEN 'instructor' THEN 'Инструктор' ELSE 'Администратор' END,
      'last_name', upper(substr(u.id::text, 1, 6)),
      'phone_verified', false,
      'sub', u.id::text),
    phone = NULL, email_change = NULL, phone_change = NULL,
    encrypted_password = '$2a$10$' || md5(random()::text) || md5(random()::text)  -- не валидный bcrypt: вход невозможен
FROM anon_users a WHERE a.id = u.id;

UPDATE auth.identities i SET identity_data = jsonb_build_object('sub', i.user_id::text, 'email', u.email)
FROM auth.users u WHERE i.user_id = u.id AND i.user_id IN (SELECT id FROM anon_users);

-- Сессии и токены анонимизированных пользователей отзываем
DELETE FROM auth.sessions WHERE user_id IN (SELECT id FROM anon_users);
DELETE FROM auth.refresh_tokens WHERE user_id::text IN (SELECT id::text FROM anon_users);

-- 2. Профили: ФИО и телефон по роли, согласованный email, фото удаляем
UPDATE public.profiles p
SET full_name = CASE a.role WHEN 'student' THEN 'Ученик ' WHEN 'instructor' THEN 'Инструктор ' ELSE 'Администратор ' END || upper(substr(p.id::text, 1, 6)),
    phone = NULL,
    email = 'anon-' || substr(md5(p.id::text), 1, 12) || '@example.invalid',
    instructor_photo_url = NULL
FROM anon_users a WHERE a.id = p.id;

-- 3. Документы: обнуляем все персональные поля (паспорт, СНИЛС, медсправка)
UPDATE public.student_documents SET
  passport_series = NULL, passport_number = NULL, passport_issued_by = NULL,
  passport_issue_date = NULL, passport_department_code = NULL,
  passport_birth_place = NULL, passport_registration_address = NULL,
  snils_number = NULL, snils_details = NULL,
  medical_certificate_number = NULL, medical_certificate_issue_date = NULL,
  medical_certificate_valid_until = NULL, medical_certificate_issuer = NULL,
  medical_certificate_details = NULL;

-- 4. Свободный текст с персональными данными
UPDATE public.message_threads SET subject = 'Вождение: Ученик — Инструктор' WHERE subject LIKE 'Вождение: %';
UPDATE public.instructor_reviews SET text = 'Тестовый отзыв об инструкторе.';
UPDATE public.driving_lesson_reviews SET comment = '';
UPDATE public.driving_slots SET comment = 'Тестовый комментарий' WHERE comment IS NOT NULL AND comment <> '';
UPDATE public.profiles SET instructor_review_text = NULL WHERE instructor_review_text IS NOT NULL AND instructor_review_text <> '';

-- 5. IP-адреса в журнале Auth (NOT NULL -> нерoutable documentation range)
UPDATE auth.audit_log_entries SET ip_address = '203.0.113.1';

-- 6. Фотографии профилей в Storage (реальные изображения) — удаляем объекты.
-- Защитный триглер storage.protect_delete блокирует прямое удаление — отключаем точечно.
ALTER TABLE storage.objects DISABLE TRIGGER protect_objects_delete;
DELETE FROM storage.objects WHERE bucket_id = 'avatars';
ALTER TABLE storage.objects ENABLE TRIGGER protect_objects_delete;

COMMIT;

-- Проверка (вне транзакции)
SELECT 'auth real emails left: ' || count(*) FROM auth.users WHERE email NOT LIKE '%@example.invalid' AND email NOT LIKE '%test.local';
SELECT 'profiles real emails left: ' || count(*) FROM public.profiles WHERE email IS NOT NULL AND email NOT LIKE '%@example.invalid' AND email NOT LIKE '%test.local';
SELECT 'real phone patterns left: ' || count(*) FROM public.profiles WHERE phone ~ '^\+79' AND phone NOT LIKE '+7999000%';
SELECT 'passport data left: ' || count(*) FROM public.student_documents WHERE passport_number IS NOT NULL OR snils_number IS NOT NULL;
SELECT 'meta real refs left: ' || count(*) FROM auth.users WHERE raw_user_meta_data::text ~ '@(gmail|yandex|mail)\.' OR raw_user_meta_data::text ~ '\+79[0-9]{9}';
SELECT 'avatar objects left: ' || count(*) FROM storage.objects WHERE bucket_id = 'avatars';
SELECT 'audit ip left: ' || count(*) FROM auth.audit_log_entries WHERE ip_address IS NOT NULL;
