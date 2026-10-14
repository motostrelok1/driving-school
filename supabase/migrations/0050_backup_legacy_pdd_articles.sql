-- 0050: one-time SQL snapshot of legacy PDD articles before student cutover.
-- Safe: does not modify public.pdd_articles or any student route.
-- Run as project owner in Supabase SQL Editor; do not re-run to refresh backup.
BEGIN;

CREATE SCHEMA IF NOT EXISTS pdd_backup;
REVOKE ALL ON SCHEMA pdd_backup FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA pdd_backup FROM PUBLIC, anon, authenticated;
REVOKE CREATE ON SCHEMA pdd_backup FROM PUBLIC;

-- Fail rather than accidentally overwrite an earlier snapshot.
CREATE TABLE pdd_backup.pdd_articles_before_cutover_20261014 AS
  SELECT id, topic_id, title, content, created_at, updated_at
  FROM public.pdd_articles;

DO $$
DECLARE
  v_source_count bigint;
  v_backup_count bigint;
  v_source_digest text;
  v_backup_digest text;
BEGIN
  SELECT count(*) INTO v_source_count FROM public.pdd_articles;
  SELECT count(*) INTO v_backup_count FROM pdd_backup.pdd_articles_before_cutover_20261014;
  IF v_source_count = 0 OR v_source_count <> v_backup_count THEN
    RAISE EXCEPTION 'PDD backup count mismatch or source empty: % versus %', v_source_count, v_backup_count;
  END IF;

  SELECT md5(string_agg(row_to_json(a)::text, ',' ORDER BY a.topic_id))
    INTO v_source_digest FROM public.pdd_articles a;
  SELECT md5(string_agg(row_to_json(a)::text, ',' ORDER BY a.topic_id))
    INTO v_backup_digest FROM pdd_backup.pdd_articles_before_cutover_20261014 a;
  IF v_source_digest IS DISTINCT FROM v_backup_digest THEN
    RAISE EXCEPTION 'PDD backup contents differ from source';
  END IF;
END $$;

REVOKE ALL ON pdd_backup.pdd_articles_before_cutover_20261014 FROM PUBLIC, anon, authenticated;
COMMENT ON TABLE pdd_backup.pdd_articles_before_cutover_20261014
  IS 'Immutable-by-procedure pre-cutover copy of legacy PDD articles; keep until rollback window closes.';
COMMIT;

-- Read-only verification (run separately after a successful migration):
-- SELECT count(*) FROM public.pdd_articles;
-- SELECT count(*) FROM pdd_backup.pdd_articles_before_cutover_20261014;
