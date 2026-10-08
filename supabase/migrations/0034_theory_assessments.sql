-- Этап 1: назначения и защищённая основа официальных попыток.
-- Запуск, ответы и завершение будут доступны только через серверные RPC этапа 2.
BEGIN;

CREATE TABLE public.theory_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('credit', 'internal_exam')),
  rules_version TEXT NOT NULL,
  topic_ids TEXT[] NOT NULL DEFAULT '{}',
  question_count INTEGER NOT NULL CHECK (question_count BETWEEN 1 AND 800),
  time_limit_minutes INTEGER NOT NULL CHECK (time_limit_minutes BETWEEN 1 AND 180),
  max_errors INTEGER NOT NULL CHECK (max_errors >= 0 AND max_errors < question_count),
  opens_at TIMESTAMPTZ NOT NULL,
  deadline_at TIMESTAMPTZ NOT NULL CHECK (deadline_at > opens_at),
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, student_id),
  CHECK (array_position(topic_ids, NULL) IS NULL),
  CHECK (topic_ids <@ ARRAY['1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20','21','22','23','24','25','26','27','28','29','30','31','32','33','34','35','36','37','38']::TEXT[]),
  CHECK (
    (kind = 'credit' AND rules_version = 'credit_v1' AND cardinality(topic_ids) > 0)
    OR
    (kind = 'internal_exam' AND rules_version = 'internal_exam_v1'
      AND cardinality(topic_ids) = 0 AND question_count = 20
      AND time_limit_minutes = 20 AND max_errors = 2)
  )
);

CREATE INDEX theory_assessments_student_created_idx
  ON public.theory_assessments (student_id, created_at DESC);

CREATE TABLE public.theory_assessment_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL UNIQUE,
  student_id UUID NOT NULL,
  FOREIGN KEY (assessment_id, student_id)
    REFERENCES public.theory_assessments(id, student_id) ON DELETE CASCADE,
  rules_version TEXT NOT NULL,
  question_count INTEGER NOT NULL CHECK (question_count BETWEEN 1 AND 800),
  time_limit_minutes INTEGER NOT NULL CHECK (time_limit_minutes BETWEEN 1 AND 180),
  max_errors INTEGER NOT NULL CHECK (max_errors >= 0 AND max_errors < question_count),
  -- Только текст, варианты и изображения. Правильные ответы хранятся отдельно.
  question_snapshot JSONB NOT NULL CHECK (
    jsonb_typeof(question_snapshot) = 'array'
    AND jsonb_array_length(question_snapshot) = question_count
  ),
  answer_key JSONB NOT NULL CHECK (
    jsonb_typeof(answer_key) = 'array'
    AND jsonb_array_length(answer_key) = question_count
  ),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL CHECK (expires_at > started_at),
  finished_at TIMESTAMPTZ CHECK (finished_at >= started_at),
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'expired')),
  correct_count INTEGER CHECK (correct_count >= 0),
  error_count INTEGER CHECK (error_count >= 0),
  elapsed_seconds INTEGER CHECK (elapsed_seconds >= 0),
  passed BOOLEAN,
  CHECK (
    (status = 'running' AND finished_at IS NULL AND passed IS NULL
      AND correct_count IS NULL AND error_count IS NULL AND elapsed_seconds IS NULL)
    OR
    (status IN ('completed', 'expired') AND finished_at IS NOT NULL AND passed IS NOT NULL
      AND correct_count IS NOT NULL AND error_count IS NOT NULL AND elapsed_seconds IS NOT NULL
      AND correct_count + error_count = question_count
      AND passed = (status = 'completed' AND error_count <= max_errors))
  )
);

CREATE INDEX theory_attempts_student_started_idx
  ON public.theory_assessment_attempts (student_id, started_at DESC);

CREATE TABLE public.theory_attempt_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES public.theory_assessment_attempts(id) ON DELETE CASCADE,
  question_index INTEGER NOT NULL CHECK (question_index >= 0),
  selected_answer INTEGER NOT NULL CHECK (selected_answer > 0),
  answered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_correct BOOLEAN NOT NULL,
  UNIQUE (attempt_id, question_index)
);

ALTER TABLE public.theory_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.theory_assessment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.theory_attempt_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY theory_assessments_read ON public.theory_assessments
  FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY theory_attempts_read ON public.theory_assessment_attempts
  FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY theory_answers_read ON public.theory_attempt_answers
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.theory_assessment_attempts a
    WHERE a.id = attempt_id AND (a.student_id = auth.uid() OR public.is_admin(auth.uid()))
  ));

-- Ни ученик, ни администратор не записывают/перезаписывают результат напрямую.
REVOKE ALL ON public.theory_assessments, public.theory_assessment_attempts,
  public.theory_attempt_answers FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.theory_assessments, public.theory_attempt_answers TO authenticated;
-- SELECT * намеренно запрещён: answer_key недоступен через клиентский API.
GRANT SELECT (id, assessment_id, student_id, rules_version, question_count,
  time_limit_minutes, max_errors, question_snapshot, started_at, expires_at,
  finished_at, status, correct_count, error_count, elapsed_seconds, passed)
  ON public.theory_assessment_attempts TO authenticated;
GRANT ALL ON public.theory_assessments, public.theory_assessment_attempts,
  public.theory_attempt_answers TO service_role;

CREATE FUNCTION public.admin_assign_theory_assessment(
  p_id UUID, p_student_id UUID, p_kind TEXT, p_topic_ids TEXT[],
  p_question_count INTEGER, p_time_limit_minutes INTEGER, p_max_errors INTEGER,
  p_opens_at TIMESTAMPTZ, p_deadline_at TIMESTAMPTZ
)
RETURNS public.theory_assessments
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  result public.theory_assessments;
  expected_rules TEXT;
  inserted_count INTEGER;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Только администратор может назначать тестирование';
  END IF;

  PERFORM 1 FROM public.profiles WHERE id = p_student_id AND role = 'student' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Назначение доступно только ученику'; END IF;

  IF p_id IS NULL OR p_kind IS NULL OR p_kind NOT IN ('credit', 'internal_exam')
    OR p_topic_ids IS NULL OR p_opens_at IS NULL OR p_deadline_at IS NULL THEN
    RAISE EXCEPTION 'Заполните тип, темы и сроки тестирования';
  END IF;

  IF cardinality(p_topic_ids) <> (SELECT count(DISTINCT topic_id) FROM unnest(p_topic_ids) topic_id) THEN
    RAISE EXCEPTION 'Темы не должны повторяться';
  END IF;
  expected_rules := CASE WHEN p_kind = 'credit' THEN 'credit_v1' ELSE 'internal_exam_v1' END;

  -- UUID формы защищает от дублей при повторном клике/сетевой повторной отправке.
  INSERT INTO public.theory_assessments (id, student_id, created_by, kind,
    rules_version, topic_ids, question_count, time_limit_minutes, max_errors, opens_at, deadline_at)
  VALUES (p_id, p_student_id, auth.uid(), p_kind, expected_rules, p_topic_ids,
    p_question_count, p_time_limit_minutes, p_max_errors, p_opens_at, p_deadline_at)
  ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS inserted_count = ROW_COUNT;

  SELECT * INTO STRICT result FROM public.theory_assessments WHERE id = p_id;
  IF result.created_by IS DISTINCT FROM auth.uid()
    OR result.student_id IS DISTINCT FROM p_student_id OR result.kind IS DISTINCT FROM p_kind
    OR result.topic_ids IS DISTINCT FROM p_topic_ids
    OR result.question_count IS DISTINCT FROM p_question_count
    OR result.time_limit_minutes IS DISTINCT FROM p_time_limit_minutes
    OR result.max_errors IS DISTINCT FROM p_max_errors
    OR result.opens_at IS DISTINCT FROM p_opens_at OR result.deadline_at IS DISTINCT FROM p_deadline_at THEN
    RAISE EXCEPTION 'Назначение уже сохранено с другими параметрами. Обновите список';
  END IF;
  -- Повтор успешного запроса возможен даже после истечения срока назначения.
  IF inserted_count = 1 AND p_deadline_at <= now() THEN
    RAISE EXCEPTION 'Крайний срок должен быть в будущем';
  END IF;
  RETURN result;
END;
$$;

CREATE FUNCTION public.admin_cancel_theory_assessment(p_id UUID)
RETURNS public.theory_assessments
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE result public.theory_assessments;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Только администратор может отменять тестирование';
  END IF;
  SELECT * INTO STRICT result FROM public.theory_assessments WHERE id = p_id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.theory_assessment_attempts WHERE assessment_id = p_id) THEN
    RAISE EXCEPTION 'Ученик уже начал попытку. Отмена недоступна';
  END IF;
  UPDATE public.theory_assessments SET cancelled_at = COALESCE(cancelled_at, now())
    WHERE id = p_id RETURNING * INTO result;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_assign_theory_assessment(UUID, UUID, TEXT, TEXT[], INTEGER, INTEGER, INTEGER, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_cancel_theory_assessment(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_assign_theory_assessment(UUID, UUID, TEXT, TEXT[], INTEGER, INTEGER, INTEGER, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_cancel_theory_assessment(UUID) TO authenticated;

COMMIT;
