-- 0047: editable metadata for the new PDD course catalog.
-- Does not change student routes or published content.
CREATE TABLE IF NOT EXISTS public.pdd_course_catalog (
  section_id text PRIMARY KEY CHECK (section_id ~ '^(s([1-9]|1[0-9]|2[0-6])|signs|markup|dopusk|neispravnosti|custom_[0-9a-f]{32})$'),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 180),
  sort_order integer NOT NULL CHECK (sort_order > 0),
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pdd_course_catalog ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pdd_course_catalog FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.pdd_course_catalog TO authenticated;
DROP POLICY IF EXISTS pdd_course_catalog_admin_select ON public.pdd_course_catalog;
CREATE POLICY pdd_course_catalog_admin_select ON public.pdd_course_catalog FOR SELECT TO authenticated
 USING (public.is_admin(auth.uid()));
DROP POLICY IF EXISTS pdd_course_catalog_admin_insert ON public.pdd_course_catalog;
CREATE POLICY pdd_course_catalog_admin_insert ON public.pdd_course_catalog FOR INSERT TO authenticated
 WITH CHECK (public.is_admin(auth.uid()));
DROP POLICY IF EXISTS pdd_course_catalog_admin_update ON public.pdd_course_catalog;
CREATE POLICY pdd_course_catalog_admin_update ON public.pdd_course_catalog FOR UPDATE TO authenticated
 USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

INSERT INTO public.pdd_course_catalog(section_id,title,sort_order) VALUES
  ('s1', 'Общие положения', 1),
  ('s2', 'Общие обязанности водителей', 2),
  ('s3', 'Применение специальных сигналов', 3),
  ('s4', 'Обязанности пешеходов', 4),
  ('s5', 'Обязанности пассажиров', 5),
  ('s6', 'Сигналы светофора и регулировщика', 6),
  ('s7', 'Применение аварийной сигнализации и знака аварийной остановки', 7),
  ('s8', 'Начало движения, маневрирование', 8),
  ('s9', 'Расположение транспортных средств на проезжей части', 9),
  ('s10', 'Скорость движения', 10),
  ('s11', 'Обгон, опережение, встречный разъезд', 11),
  ('s12', 'Остановка и стоянка', 12),
  ('s13', 'Проезд перекрестков', 13),
  ('s14', 'Пешеходные переходы и места остановок маршрутных транспортных средств', 14),
  ('s15', 'Движение через железнодорожные пути', 15),
  ('s16', 'Движение по автомагистралям', 16),
  ('s17', 'Движение в жилых зонах', 17),
  ('s18', 'Приоритет маршрутных транспортных средств', 18),
  ('s19', 'Пользование внешними световыми приборами', 19),
  ('s20', 'Буксировка механических транспортных средств', 20),
  ('s21', 'Учебная езда', 21),
  ('s22', 'Перевозка людей', 22),
  ('s23', 'Перевозка грузов', 23),
  ('s24', 'Дополнительные требования к движению велосипедистов, водителей мопедов и лиц,', 24),
  ('s25', 'Дополнительные требования к движению гужевых повозок, а также к прогону животных', 25),
  ('s26', 'Нормы времени управления транспортным средством и отдыха', 26),
  ('signs', 'Дорожные знаки', 27),
  ('markup', 'Дорожная разметка и ее характеристики', 28),
  ('dopusk', 'Основные положения по допуску транспортных средств к эксплуатации и обязанности должностных лиц по обеспечению безопасности дорожного движения', 29),
  ('neispravnosti', 'Перечень неисправностей и условий, при которых запрещается эксплуатация транспортных средств', 30)
ON CONFLICT (section_id) DO NOTHING;

-- Soft archive rather than DELETE: retain version history and references.
-- Client editing controls and custom section publication support ship in follow-up PRs.
