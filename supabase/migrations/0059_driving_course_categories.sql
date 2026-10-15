-- 0059. Driving course categories. Separate from legacy global driving_training_settings
-- until each student is assigned a course; do not retroactively recalculate histories.
CREATE TABLE public.driving_course_categories (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text NOT NULL UNIQUE CHECK (length(btrim(name)) BETWEEN 1 AND 60),
 academic_hours integer NOT NULL CHECK (academic_hours BETWEEN 0 AND 500),
 duration_options jsonb NOT NULL DEFAULT '[{"minutes":60,"academic_hours":0,"kind":"trial"},{"minutes":90,"academic_hours":2,"kind":"standard"},{"minutes":120,"academic_hours":3,"kind":"standard"}]'::jsonb,
 is_default boolean NOT NULL DEFAULT false,
 position integer NOT NULL DEFAULT 0,
 updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.driving_course_categories(name,academic_hours,is_default,position) VALUES
 ('B (МКПП)',58,true,0),('B (АКПП)',56,true,1),('A (МОТО)',0,true,2);
ALTER TABLE public.driving_course_categories ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.driving_course_categories FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.driving_course_categories TO authenticated;
CREATE POLICY driving_course_categories_read ON public.driving_course_categories
 FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.save_driving_course_category(
 target_id uuid,target_name text,target_hours integer,target_options jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE x jsonb; seen integer[]:=ARRAY[]::integer[]; v_id uuid; v_name text:=btrim(target_name);
BEGIN
 IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin only'; END IF;
 IF v_name IS NULL OR length(v_name) NOT BETWEEN 1 AND 60
 OR target_hours NOT BETWEEN 0 AND 500
 OR jsonb_typeof(target_options) IS DISTINCT FROM 'array'
 OR jsonb_array_length(target_options) NOT BETWEEN 1 AND 12
 THEN RAISE EXCEPTION 'Invalid course settings'; END IF;
 FOR x IN SELECT value FROM jsonb_array_elements(target_options) LOOP
  IF jsonb_typeof(x) <> 'object'
  OR (x->>'minutes') !~ '^[0-9]+$'
  OR (x->>'academic_hours') !~ '^[0-9]+$'
  OR (x->>'kind') NOT IN ('trial','standard')
  THEN RAISE EXCEPTION 'Invalid duration option'; END IF;
  IF (x->>'minutes')::int NOT BETWEEN 15 AND 240 OR (x->>'minutes')::int % 15 <> 0
  OR (x->>'academic_hours')::int NOT BETWEEN 0 AND 10
  OR (x->>'minutes')::int=ANY(seen)
  OR ((x->>'kind')='trial' AND (x->>'academic_hours')::int <> 0)
  THEN RAISE EXCEPTION 'Invalid duplicate or trial option'; END IF;
  seen:=array_append(seen,(x->>'minutes')::int);
 END LOOP;
 IF target_id IS NULL THEN
  INSERT INTO public.driving_course_categories(name,academic_hours,duration_options,position)
  VALUES(v_name,target_hours,target_options,
   (SELECT coalesce(max(position),0)+1 FROM public.driving_course_categories))
  RETURNING id INTO v_id;
 ELSE
  UPDATE public.driving_course_categories
  SET name=v_name,academic_hours=target_hours,duration_options=target_options,updated_at=now()
  WHERE id=target_id RETURNING id INTO v_id;
  IF v_id IS NULL THEN RAISE EXCEPTION 'Category not found'; END IF;
 END IF;
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.save_driving_course_category(uuid,text,integer,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_driving_course_category(uuid,text,integer,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_driving_course_category(target_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
 IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin only'; END IF;
 DELETE FROM public.driving_course_categories WHERE id=target_id AND NOT is_default;
 IF NOT FOUND THEN RAISE EXCEPTION 'Default category cannot be deleted or category not found'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.delete_driving_course_category(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.delete_driving_course_category(uuid) TO authenticated;
