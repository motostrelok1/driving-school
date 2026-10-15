-- 0061: Short admin button label for each driving category.
ALTER TABLE public.driving_course_categories
 ADD COLUMN short_label text NOT NULL DEFAULT 'B'
 CHECK (char_length(btrim(short_label)) BETWEEN 1 AND 12);
UPDATE public.driving_course_categories SET short_label =
 CASE name WHEN 'B (МКПП)' THEN 'B(М)' WHEN 'B (АКПП)' THEN 'B(А)'
 WHEN 'A (МОТО)' THEN 'A' ELSE left(name,12) END;
CREATE OR REPLACE FUNCTION public.set_driving_course_short_label(target_id uuid,target_label text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
 IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin only'; END IF;
 IF target_label IS NULL OR length(btrim(target_label)) NOT BETWEEN 1 AND 12
 THEN RAISE EXCEPTION 'Short label must be 1-12 characters'; END IF;
 UPDATE public.driving_course_categories SET short_label=btrim(target_label),updated_at=now() WHERE id=target_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Category not found'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.set_driving_course_short_label(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_driving_course_short_label(uuid,text) TO authenticated;
