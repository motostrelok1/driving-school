CREATE TABLE IF NOT EXISTS public.pdd_articles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  topic_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  content JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

DROP TRIGGER IF EXISTS set_pdd_articles_updated_at ON public.pdd_articles;
CREATE TRIGGER set_pdd_articles_updated_at
  BEFORE UPDATE ON public.pdd_articles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.pdd_articles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read pdd articles" ON public.pdd_articles;
DROP POLICY IF EXISTS "Admins can manage pdd articles" ON public.pdd_articles;

CREATE POLICY "Authenticated can read pdd articles"
  ON public.pdd_articles FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage pdd articles"
  ON public.pdd_articles FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));
