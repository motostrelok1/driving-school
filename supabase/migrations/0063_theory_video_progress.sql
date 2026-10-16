-- 0063: Server-backed watched theory videos and admin-safe aggregate progress.
CREATE TABLE IF NOT EXISTS public.theory_video_progress (
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 video_id text NOT NULL CHECK (video_id IN (
  '6s8PiXa5EjvdJ5kf6vVVMN','af99nHFP8TNdC5BHtKgDqF',
  'bmsevH7PhcEEufgxKfzRLH','gkrYkSyakYLRNQ8e3XWppQ','jtH5cB3qNEwkocW62GcR1P'
 )),
 watched_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (user_id,video_id)
);
ALTER TABLE public.theory_video_progress ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.theory_video_progress FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.theory_video_progress TO authenticated;
CREATE POLICY theory_video_own_read ON public.theory_video_progress FOR SELECT TO authenticated USING (user_id=(SELECT auth.uid()));
CREATE POLICY theory_video_own_insert ON public.theory_video_progress FOR INSERT TO authenticated WITH CHECK (user_id=(SELECT auth.uid()));
CREATE OR REPLACE FUNCTION public.get_admin_student_theory_progress(target_student_id uuid)
RETURNS TABLE(read_sections integer,published_sections integer,watched_videos integer,total_videos integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
 IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin only'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=target_student_id AND role='student')
 THEN RAISE EXCEPTION 'Student not found'; END IF;
 RETURN QUERY
 WITH published AS (
 SELECT c.section_id FROM public.pdd_course_catalog c
 JOIN public.pdd_course_publications p ON p.section_id=c.section_id
 WHERE NOT c.is_archived
 )
 SELECT
 (SELECT count(*)::int FROM public.pdd_section_read_progress r JOIN published p ON p.section_id=r.section_id WHERE r.user_id=target_student_id),
 (SELECT count(*)::int FROM published),
 (SELECT count(*)::int FROM public.theory_video_progress v WHERE v.user_id=target_student_id),
 5::int;
END $$;
REVOKE ALL ON FUNCTION public.get_admin_student_theory_progress(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_admin_student_theory_progress(uuid) TO authenticated;
