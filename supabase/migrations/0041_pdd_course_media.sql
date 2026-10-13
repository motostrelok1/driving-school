-- PR #115: isolated public image bucket for the new PDD course.
-- Run manually in Supabase SQL Editor after review; no existing buckets are changed.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('pdd-course-media', 'pdd-course-media', true, 10485760,
        ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "pdd_course_media_admin_insert" ON storage.objects;
CREATE POLICY "pdd_course_media_admin_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'pdd-course-media' AND public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "pdd_course_media_admin_update" ON storage.objects;
CREATE POLICY "pdd_course_media_admin_update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'pdd-course-media' AND public.is_admin(auth.uid()))
WITH CHECK (bucket_id = 'pdd-course-media' AND public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "pdd_course_media_admin_delete" ON storage.objects;
CREATE POLICY "pdd_course_media_admin_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'pdd-course-media' AND public.is_admin(auth.uid()));
