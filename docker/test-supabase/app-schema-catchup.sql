-- Догонка прикладной схемы тестовой БД до уровня кода приложения.
-- Cloud-backup production отстаёт от миграций репозитория: хвост 0035
-- (колонки уведомлений + claim-функция для edge-функции send-theory-assignment)
-- в backup отсутствует. Файл идемпотентен.
-- ВАЖНО: это НЕ замена миграций — полный миграционный долг см. аудит этапа 5.
ALTER TABLE public.theory_assessments ADD COLUMN IF NOT EXISTS notification_sent_at TIMESTAMPTZ;
ALTER TABLE public.theory_assessments ADD COLUMN IF NOT EXISTS notification_claimed_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.claim_theory_assignment_notification(p_id UUID) RETURNS SETOF public.theory_assessments
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.theory_assessments SET notification_claimed_at = clock_timestamp()
  WHERE id = p_id AND cancelled_at IS NULL AND notification_sent_at IS NULL
    AND deadline_at > clock_timestamp()
    AND (notification_claimed_at IS NULL OR notification_claimed_at < clock_timestamp() - interval '1 minute')
  RETURNING *
$$;
REVOKE ALL ON FUNCTION public.claim_theory_assignment_notification(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_theory_assignment_notification(UUID) TO service_role;
