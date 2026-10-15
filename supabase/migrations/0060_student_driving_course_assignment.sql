-- 0060: Explicit student course assignment, without modifying past bookings.
CREATE TABLE public.student_driving_courses (
 student_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
 category_id uuid NOT NULL REFERENCES public.driving_course_categories(id) ON DELETE RESTRICT,
 updated_at timestamptz NOT NULL DEFAULT now(),
 assigned_by uuid REFERENCES public.profiles(id)
);
ALTER TABLE public.student_driving_courses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.student_driving_courses FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.student_driving_courses TO authenticated;
CREATE POLICY student_course_read ON public.student_driving_courses
 FOR SELECT TO authenticated USING(student_id=auth.uid() OR public.is_admin(auth.uid()));
CREATE OR REPLACE FUNCTION public.set_student_driving_course(target_student_id uuid,target_category_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
 IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin only'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=target_student_id AND role='student')
 THEN RAISE EXCEPTION 'Student not found'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.driving_course_categories WHERE id=target_category_id)
 THEN RAISE EXCEPTION 'Course category not found'; END IF;
 INSERT INTO public.student_driving_courses(student_id,category_id,updated_at,assigned_by)
 VALUES(target_student_id,target_category_id,now(),auth.uid())
 ON CONFLICT(student_id) DO UPDATE SET category_id=excluded.category_id,updated_at=now(),assigned_by=auth.uid();
END $$;
REVOKE ALL ON FUNCTION public.set_student_driving_course(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_student_driving_course(uuid,uuid) TO authenticated;
