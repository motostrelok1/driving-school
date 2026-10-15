-- 0056: Private per-driving-session reviews with administrator-gated anonymous statistics.
-- This is a new system; legacy public instructor_reviews are not used for these reviews.
CREATE TABLE public.driving_lesson_reviews (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 slot_id uuid NOT NULL UNIQUE REFERENCES public.driving_slots(id) ON DELETE CASCADE,
 student_id uuid NOT NULL REFERENCES public.profiles(id),
 instructor_id uuid NOT NULL REFERENCES public.profiles(id),
 rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
 comment text NOT NULL DEFAULT '' CHECK (length(comment) <= 2000),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 published_at timestamptz,
 published_by uuid REFERENCES public.profiles(id)
);
CREATE INDEX driving_lesson_reviews_instructor_published_idx ON public.driving_lesson_reviews(instructor_id,published_at) WHERE published_at IS NOT NULL;
ALTER TABLE public.driving_lesson_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.driving_lesson_reviews FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.driving_lesson_reviews TO authenticated;
CREATE POLICY driving_lesson_reviews_read ON public.driving_lesson_reviews
 FOR SELECT TO authenticated USING (student_id=auth.uid() OR public.is_admin(auth.uid()));
-- No direct client INSERT, UPDATE or DELETE grants or policies.

CREATE OR REPLACE FUNCTION public.save_my_driving_lesson_review(
 target_slot_id uuid, target_rating integer, target_comment text DEFAULT ''
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_slot public.driving_slots%ROWTYPE; v_id uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Login required'; END IF;
 IF target_rating NOT BETWEEN 1 AND 5 OR length(coalesce(target_comment,''))>2000
 THEN RAISE EXCEPTION 'Invalid review'; END IF;
 SELECT * INTO v_slot FROM public.driving_slots WHERE id=target_slot_id;
 IF NOT FOUND OR v_slot.student_id IS DISTINCT FROM auth.uid()
    OR v_slot.status <> 'booked'
    OR v_slot.start_at + make_interval(mins => v_slot.duration_minutes) > now()
 THEN RAISE EXCEPTION 'This session is not completed or does not belong to you'; END IF;
 INSERT INTO public.driving_lesson_reviews(slot_id,student_id,instructor_id,rating,comment)
 VALUES(v_slot.id,auth.uid(),v_slot.instructor_id,target_rating,coalesce(target_comment,''))
 ON CONFLICT(slot_id) DO UPDATE
 SET rating=EXCLUDED.rating, comment=EXCLUDED.comment, updated_at=now()
 WHERE public.driving_lesson_reviews.student_id=auth.uid()
   AND public.driving_lesson_reviews.published_at IS NULL
 RETURNING id INTO v_id;
 IF v_id IS NULL THEN RAISE EXCEPTION 'Published review cannot be edited'; END IF;
 RETURN v_id;
END; $$;
REVOKE ALL ON FUNCTION public.save_my_driving_lesson_review(uuid,integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_my_driving_lesson_review(uuid,integer,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.publish_driving_lesson_reviews(target_review_ids uuid[])
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_requested integer; v_eligible integer; v_updated integer;
BEGIN
 IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin only'; END IF;
 IF target_review_ids IS NULL OR cardinality(target_review_ids)=0 OR cardinality(target_review_ids)>100
 THEN RAISE EXCEPTION 'Select 1 to 100 reviews'; END IF;
 SELECT count(DISTINCT x) INTO v_requested FROM unnest(target_review_ids) AS t(x);
 SELECT count(*) INTO v_eligible
 FROM public.driving_lesson_reviews r
 JOIN public.driving_slots s ON s.id=r.slot_id
 WHERE r.id=ANY(target_review_ids) AND r.published_at IS NULL
   AND s.student_id=r.student_id AND s.instructor_id=r.instructor_id
   AND s.status='booked'
   AND s.start_at + make_interval(mins=>s.duration_minutes) <= now() - interval '3 days';
 IF v_eligible <> v_requested THEN
  RAISE EXCEPTION 'Some reviews are missing, published, cancelled, or less than 3 days old';
 END IF;
 UPDATE public.driving_lesson_reviews
 SET published_at=now(),published_by=auth.uid()
 WHERE id=ANY(target_review_ids) AND published_at IS NULL;
 GET DIAGNOSTICS v_updated = ROW_COUNT;
 RETURN v_updated;
END; $$;
REVOKE ALL ON FUNCTION public.publish_driving_lesson_reviews(uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.publish_driving_lesson_reviews(uuid[]) TO authenticated;

-- No raw review records, comments, authors or timestamps available to instructor.
-- The count and average remain hidden until >= 5 unique authors were published.
CREATE OR REPLACE FUNCTION public.get_my_anonymous_driving_rating()
RETURNS TABLE(review_count bigint,average_rating numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_auth uuid := auth.uid(); v_unique bigint;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=v_auth AND role='instructor')
 THEN RAISE EXCEPTION 'Instructor only'; END IF;
 SELECT count(DISTINCT r.student_id) INTO v_unique
 FROM public.driving_lesson_reviews r
 JOIN public.driving_slots s ON s.id=r.slot_id
 WHERE r.instructor_id=v_auth AND r.published_at IS NOT NULL
 AND s.status='booked' AND s.student_id=r.student_id AND s.instructor_id=r.instructor_id;
 IF v_unique < 5 THEN RETURN; END IF;
 RETURN QUERY
 SELECT count(*), round(avg(r.rating),1)
 FROM public.driving_lesson_reviews r
 JOIN public.driving_slots s ON s.id=r.slot_id
 WHERE r.instructor_id=v_auth AND r.published_at IS NOT NULL
 AND s.status='booked' AND s.student_id=r.student_id AND s.instructor_id=r.instructor_id;
END; $$;
REVOKE ALL ON FUNCTION public.get_my_anonymous_driving_rating() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_my_anonymous_driving_rating() TO authenticated;
