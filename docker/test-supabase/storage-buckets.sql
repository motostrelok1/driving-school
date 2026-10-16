INSERT INTO storage.buckets (id, name, public) VALUES
  ('avatars', 'avatars', true),
  ('lesson-media', 'lesson-media', true),
  ('student-documents', 'student-documents', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "public read avatars" ON storage.objects;
DROP POLICY IF EXISTS "public read lesson media" ON storage.objects;
DROP POLICY IF EXISTS "own private docs read" ON storage.objects;
DROP POLICY IF EXISTS "own avatar upload" ON storage.objects;
DROP POLICY IF EXISTS "own student docs upload" ON storage.objects;
DROP POLICY IF EXISTS "staff upload lesson media" ON storage.objects;
DROP POLICY IF EXISTS "owner update own objects" ON storage.objects;
DROP POLICY IF EXISTS "owner delete own objects" ON storage.objects;

CREATE POLICY "public read avatars" ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'avatars');
CREATE POLICY "public read lesson media" ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'lesson-media');
CREATE POLICY "own private docs read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'student-documents' AND owner = auth.uid());

-- Загрузка только в предназначенный бакет: avatars и student-documents — свои
-- файлы любому авторизованному, lesson-media — только инструкторам и админам
-- (проверка роли из public.profiles; строка своего профиля владельцу видна).
DROP POLICY IF EXISTS "authenticated upload own objects" ON storage.objects;
CREATE POLICY "own avatar upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND owner = auth.uid());
CREATE POLICY "own student docs upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'student-documents' AND owner = auth.uid());
CREATE POLICY "staff upload lesson media" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'lesson-media' AND owner = auth.uid()
    AND EXISTS (SELECT 1 FROM public.profiles
                WHERE id = auth.uid() AND role IN ('instructor', 'admin')));

CREATE POLICY "owner update own objects" ON storage.objects FOR UPDATE TO authenticated
  USING (owner = auth.uid()) WITH CHECK (owner = auth.uid());
CREATE POLICY "owner delete own objects" ON storage.objects FOR DELETE TO authenticated
  USING (owner = auth.uid());
