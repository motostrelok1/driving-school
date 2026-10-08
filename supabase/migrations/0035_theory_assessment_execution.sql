-- Официальный банк, восстановление попыток и серверный подсчёт.
BEGIN;

CREATE TABLE public.theory_question_bank (
  id TEXT PRIMARY KEY,
  ticket_number INTEGER NOT NULL CHECK (ticket_number BETWEEN 1 AND 40),
  question_number INTEGER NOT NULL CHECK (question_number BETWEEN 1 AND 20),
  question_text TEXT NOT NULL CHECK (length(btrim(question_text)) > 0),
  image_path TEXT CHECK (image_path ~ '^/tickets/[a-zA-Z0-9_./-]+$' AND image_path NOT LIKE '%..%'),
  answers JSONB NOT NULL CHECK (jsonb_typeof(answers) = 'array' AND jsonb_array_length(answers) BETWEEN 2 AND 10),
  correct_answer INTEGER,
  topic_ids TEXT[] NOT NULL DEFAULT '{}',
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ticket_number, question_number),
  CHECK (array_position(topic_ids, NULL) IS NULL),
  CHECK (topic_ids <@ ARRAY['1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20','21','22','23','24','25','26','27','28','29','30','31','32','33','34','35','36','37','38']::TEXT[]),
  CHECK (approved_at IS NULL OR correct_answer IS NOT NULL)
);
ALTER TABLE public.theory_question_bank ENABLE ROW LEVEL SECURITY;
CREATE POLICY theory_bank_admin_read ON public.theory_question_bank FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));
REVOKE ALL ON public.theory_question_bank FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.theory_question_bank TO authenticated;
GRANT ALL ON public.theory_question_bank TO service_role;

-- Обратная связь о правильности ответа доступна только после завершения через RPC.
REVOKE SELECT ON public.theory_attempt_answers FROM authenticated;
GRANT SELECT (id, attempt_id, question_index, selected_answer, answered_at)
  ON public.theory_attempt_answers TO authenticated;

CREATE FUNCTION public._valid_theory_answers(p_answers JSONB) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN jsonb_typeof(p_answers) IS DISTINCT FROM 'array' THEN false ELSE
    jsonb_array_length(p_answers) BETWEEN 2 AND 10
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_answers) a
      WHERE jsonb_typeof(a->'number') IS DISTINCT FROM 'number'
        OR NOT COALESCE(a->>'number' ~ '^[1-9][0-9]*$', false)
        OR jsonb_typeof(a->'text') IS DISTINCT FROM 'string' OR length(btrim(a->>'text')) = 0)
    AND (SELECT count(*) = count(DISTINCT a->>'number') FROM jsonb_array_elements(p_answers) a)
  END
$$;

CREATE FUNCTION public.admin_import_theory_questions(p_questions JSONB) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE q JSONB; key TEXT; answer INTEGER; inserted INTEGER := 0; changed INTEGER; invalid INTEGER := 0;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Только администратор может менять банк'; END IF;
  IF jsonb_typeof(p_questions) IS DISTINCT FROM 'array' OR jsonb_array_length(p_questions) NOT BETWEEN 1 AND 1000 THEN
    RAISE EXCEPTION 'Передайте от 1 до 1000 вопросов';
  END IF;
  FOR q IN SELECT * FROM jsonb_array_elements(p_questions) LOOP
    IF NOT public._valid_theory_answers(q->'answers') THEN RAISE EXCEPTION 'Некорректные варианты ответа'; END IF;
    key := (q->>'ticketNumber') || '-' || (q->>'number');
    answer := NULL;
    IF (q->>'correctAnswer') ~ '^[1-9][0-9]*$'
      AND EXISTS (SELECT 1 FROM jsonb_array_elements(q->'answers') a WHERE a->>'number' = q->>'correctAnswer') THEN
      answer := (q->>'correctAnswer')::INTEGER;
    ELSE invalid := invalid + 1;
    END IF;
    INSERT INTO public.theory_question_bank (id, ticket_number, question_number, question_text, image_path, answers, correct_answer)
    VALUES (key, (q->>'ticketNumber')::INTEGER, (q->>'number')::INTEGER, q->>'text',
      CASE WHEN NULLIF(q->>'image', '') IS NULL THEN NULL
        WHEN q->>'image' LIKE '/tickets/%' THEN q->>'image' ELSE '/tickets/' || (q->>'image') END,
      q->'answers', answer)
    ON CONFLICT (ticket_number, question_number) DO NOTHING;
    GET DIAGNOSTICS changed = ROW_COUNT;
    inserted := inserted + changed;
  END LOOP;
  RETURN jsonb_build_object('inserted', inserted, 'invalid_keys', invalid, 'total', jsonb_array_length(p_questions));
END $$;

CREATE FUNCTION public.admin_save_theory_question(p_id TEXT, p_text TEXT, p_answers JSONB,
  p_correct_answer INTEGER, p_topic_ids TEXT[], p_approve BOOLEAN) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Только администратор может менять банк'; END IF;
  IF p_approve IS NULL OR p_topic_ids IS NULL OR NOT public._valid_theory_answers(p_answers) THEN
    RAISE EXCEPTION 'Проверьте варианты и темы вопроса';
  END IF;
  IF p_approve AND (p_correct_answer IS NULL OR NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_answers) a WHERE (a->>'number')::INTEGER = p_correct_answer
  )) THEN RAISE EXCEPTION 'Выберите существующий правильный ответ'; END IF;
  UPDATE public.theory_question_bank SET question_text = p_text, answers = p_answers,
    correct_answer = p_correct_answer, topic_ids = p_topic_ids,
    approved_at = CASE WHEN p_approve THEN clock_timestamp() END,
    approved_by = CASE WHEN p_approve THEN auth.uid() END, updated_at = clock_timestamp()
  WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Вопрос не найден'; END IF;
END $$;

CREATE FUNCTION public._finish_theory_attempt(p_id UUID, p_expired BOOLEAN) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.theory_assessment_attempts; correct INTEGER; ended TIMESTAMPTZ; expired BOOLEAN; server_now TIMESTAMPTZ;
BEGIN
  SELECT * INTO STRICT a FROM public.theory_assessment_attempts WHERE id = p_id FOR UPDATE;
  IF a.status <> 'running' THEN RETURN; END IF;
  server_now := clock_timestamp();
  expired := p_expired OR server_now >= a.expires_at;
  ended := LEAST(server_now, a.expires_at);
  SELECT count(*) FILTER (WHERE is_correct) INTO correct FROM public.theory_attempt_answers WHERE attempt_id = p_id;
  UPDATE public.theory_assessment_attempts SET
    status = CASE WHEN expired THEN 'expired' ELSE 'completed' END,
    finished_at = ended, correct_count = correct, error_count = a.question_count - correct,
    elapsed_seconds = GREATEST(0, floor(extract(epoch FROM ended - a.started_at))::INTEGER),
    passed = NOT expired AND a.question_count - correct <= a.max_errors
  WHERE id = p_id;
END $$;

CREATE FUNCTION public._theory_attempt_payload(p_id UUID) RETURNS JSONB
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('server_time', clock_timestamp(), 'attempt', to_jsonb(a) - 'answer_key',
    'answers', COALESCE((SELECT jsonb_agg(jsonb_build_object('question_index', question_index,
      'selected_answer', selected_answer, 'answered_at', answered_at) ORDER BY question_index)
      FROM public.theory_attempt_answers WHERE attempt_id = a.id), '[]'::JSONB))
  FROM public.theory_assessment_attempts a WHERE a.id = p_id
$$;

CREATE FUNCTION public.get_my_theory_attempt(p_attempt_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.theory_assessment_attempts;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'student') THEN
    RAISE EXCEPTION 'Доступно только ученику';
  END IF;
  SELECT * INTO a FROM public.theory_assessment_attempts WHERE id = p_attempt_id AND student_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Попытка не найдена'; END IF;
  IF a.status = 'running' AND clock_timestamp() >= a.expires_at THEN PERFORM public._finish_theory_attempt(a.id, true); END IF;
  RETURN public._theory_attempt_payload(a.id);
END $$;

CREATE FUNCTION public.get_my_theory_assessments() RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE expired_row RECORD; result JSONB;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'student') THEN
    RAISE EXCEPTION 'Доступно только ученику';
  END IF;
  FOR expired_row IN SELECT id FROM public.theory_assessment_attempts
    WHERE student_id = auth.uid() AND status = 'running' AND expires_at <= clock_timestamp() ORDER BY id LOOP
    PERFORM public._finish_theory_attempt(expired_row.id, true);
  END LOOP;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('assessment', to_jsonb(t),
    'attempt', CASE WHEN a.id IS NULL THEN NULL ELSE to_jsonb(a) - 'answer_key' - 'question_snapshot' END,
    'available_questions', (SELECT count(*) FROM public.theory_question_bank b WHERE approved_at IS NOT NULL
      AND (t.kind = 'internal_exam' OR b.topic_ids && t.topic_ids))) ORDER BY t.created_at DESC), '[]'::JSONB)
  INTO result FROM public.theory_assessments t LEFT JOIN public.theory_assessment_attempts a ON a.assessment_id = t.id
  WHERE t.student_id = auth.uid();
  RETURN jsonb_build_object('server_time', clock_timestamp(), 'items', result);
END $$;

CREATE FUNCTION public.student_start_theory_assessment(p_assessment_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.theory_assessments; a public.theory_assessment_attempts; started TIMESTAMPTZ;
  questions JSONB; keys JSONB;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'student') THEN
    RAISE EXCEPTION 'Доступно только ученику';
  END IF;
  SELECT * INTO t FROM public.theory_assessments WHERE id = p_assessment_id AND student_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Назначение не найдено'; END IF;
  SELECT * INTO a FROM public.theory_assessment_attempts WHERE assessment_id = t.id FOR UPDATE;
  IF FOUND THEN RETURN public.get_my_theory_attempt(a.id); END IF;
  started := clock_timestamp();
  IF t.cancelled_at IS NOT NULL THEN RAISE EXCEPTION 'Назначение отменено'; END IF;
  IF started < t.opens_at THEN RAISE EXCEPTION 'Тестирование ещё не открыто'; END IF;
  IF started >= t.deadline_at THEN RAISE EXCEPTION 'Срок тестирования истёк'; END IF;
  WITH selected AS (
    SELECT b.*, row_number() OVER () AS position FROM (
      SELECT * FROM public.theory_question_bank WHERE approved_at IS NOT NULL
        AND (t.kind = 'internal_exam' OR topic_ids && t.topic_ids)
      ORDER BY random() LIMIT t.question_count
    ) b
  ) SELECT jsonb_agg(jsonb_build_object('key', id, 'ticketNumber', ticket_number,
    'number', question_number, 'text', question_text, 'image', image_path,
    'answers', (SELECT jsonb_agg(jsonb_build_object('number', (opt->>'number')::INTEGER, 'text', opt->>'text'))
      FROM jsonb_array_elements(answers) opt)) ORDER BY position),
    jsonb_agg(correct_answer ORDER BY position) INTO questions, keys FROM selected;
  IF COALESCE(jsonb_array_length(questions), 0) <> t.question_count THEN
    RAISE EXCEPTION 'В проверенном банке недостаточно вопросов по назначенным темам. Обратитесь к администратору';
  END IF;
  INSERT INTO public.theory_assessment_attempts (assessment_id, student_id, rules_version,
    question_count, time_limit_minutes, max_errors, question_snapshot, answer_key, started_at, expires_at)
  VALUES (t.id, auth.uid(), t.rules_version, t.question_count, t.time_limit_minutes, t.max_errors,
    questions, keys, started, LEAST(started + make_interval(mins => t.time_limit_minutes), t.deadline_at))
  RETURNING * INTO a;
  RETURN public._theory_attempt_payload(a.id);
END $$;

CREATE FUNCTION public.student_answer_theory_question(p_attempt_id UUID, p_question_index INTEGER, p_selected_answer INTEGER)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.theory_assessment_attempts; saved INTEGER;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'student') THEN
    RAISE EXCEPTION 'Доступно только ученику';
  END IF;
  SELECT * INTO a FROM public.theory_assessment_attempts WHERE id = p_attempt_id AND student_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Попытка не найдена'; END IF;
  IF a.status <> 'running' THEN RETURN public._theory_attempt_payload(a.id); END IF;
  IF clock_timestamp() >= a.expires_at THEN
    PERFORM public._finish_theory_attempt(a.id, true);
    RETURN public._theory_attempt_payload(a.id);
  END IF;
  IF p_question_index IS NULL OR p_question_index NOT BETWEEN 0 AND a.question_count - 1
    OR p_selected_answer IS NULL OR NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(a.question_snapshot->p_question_index->'answers') opt
      WHERE (opt->>'number')::INTEGER = p_selected_answer
    ) THEN RAISE EXCEPTION 'Некорректный вопрос или вариант ответа'; END IF;
  SELECT selected_answer INTO saved FROM public.theory_attempt_answers WHERE attempt_id = a.id AND question_index = p_question_index;
  IF FOUND THEN
    IF saved <> p_selected_answer THEN RAISE EXCEPTION 'Ответ уже сохранён. Изменение недоступно'; END IF;
    RETURN public._theory_attempt_payload(a.id);
  END IF;
  INSERT INTO public.theory_attempt_answers (attempt_id, question_index, selected_answer, answered_at, is_correct)
  VALUES (a.id, p_question_index, p_selected_answer, clock_timestamp(), (a.answer_key->>p_question_index)::INTEGER = p_selected_answer);
  IF (SELECT count(*) FROM public.theory_attempt_answers WHERE attempt_id = a.id) = a.question_count THEN
    PERFORM public._finish_theory_attempt(a.id, false);
  END IF;
  RETURN public._theory_attempt_payload(a.id);
END $$;

CREATE FUNCTION public.student_finish_theory_attempt(p_attempt_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'student')
    OR NOT EXISTS (SELECT 1 FROM public.theory_assessment_attempts WHERE id = p_attempt_id AND student_id = auth.uid()) THEN
    RAISE EXCEPTION 'Попытка не найдена';
  END IF;
  PERFORM public._finish_theory_attempt(p_attempt_id, false);
  RETURN public._theory_attempt_payload(p_attempt_id);
END $$;

-- Приватные помощники нельзя вызывать напрямую с клиента.
REVOKE ALL ON FUNCTION public._valid_theory_answers(JSONB), public._finish_theory_attempt(UUID, BOOLEAN),
  public._theory_attempt_payload(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_import_theory_questions(JSONB),
  public.admin_save_theory_question(TEXT, TEXT, JSONB, INTEGER, TEXT[], BOOLEAN), public.get_my_theory_attempt(UUID),
  public.get_my_theory_assessments(), public.student_start_theory_assessment(UUID),
  public.student_answer_theory_question(UUID, INTEGER, INTEGER), public.student_finish_theory_attempt(UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_import_theory_questions(JSONB),
  public.admin_save_theory_question(TEXT, TEXT, JSONB, INTEGER, TEXT[], BOOLEAN), public.get_my_theory_attempt(UUID),
  public.get_my_theory_assessments(), public.student_start_theory_assessment(UUID),
  public.student_answer_theory_question(UUID, INTEGER, INTEGER), public.student_finish_theory_attempt(UUID)
  TO authenticated;

ALTER TABLE public.theory_assessments ADD COLUMN notification_sent_at TIMESTAMPTZ,
  ADD COLUMN notification_claimed_at TIMESTAMPTZ;
CREATE FUNCTION public.claim_theory_assignment_notification(p_id UUID) RETURNS SETOF public.theory_assessments
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.theory_assessments SET notification_claimed_at = clock_timestamp()
  WHERE id = p_id AND cancelled_at IS NULL AND notification_sent_at IS NULL
    AND deadline_at > clock_timestamp()
    AND (notification_claimed_at IS NULL OR notification_claimed_at < clock_timestamp() - interval '1 minute')
  RETURNING *
$$;
REVOKE ALL ON FUNCTION public.claim_theory_assignment_notification(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_theory_assignment_notification(UUID) TO service_role;

COMMIT;
