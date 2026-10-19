-- P0 scoped migration dependency inventory (SOURCE CLOUD ONLY).
-- Read-only metadata. No PII, rows, secrets, or object names/paths from Storage.
-- Run in the SQL editor of confirmed cloud project dznjopipisdfrojlpxrz.
BEGIN READ ONLY;

-- All public relations (names + RLS). Classify exact theory/auth dependencies manually.
SELECT n.nspname AS schema_name, c.relname AS relation_name,
       c.relkind AS kind, c.relrowsecurity AS rls_enabled
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname IN ('public','auth','storage') AND c.relkind IN ('r','p')
ORDER BY 1,2;

-- Foreign keys: inspect inbound and outbound dependencies before selecting tables.
SELECT ns.nspname AS source_schema, src.relname AS source_table,
       con.conname AS constraint_name,
       nt.nspname AS target_schema, dst.relname AS target_table,
       pg_get_constraintdef(con.oid, true) AS fk_definition
FROM pg_constraint con
JOIN pg_class src ON src.oid=con.conrelid
JOIN pg_namespace ns ON ns.oid=src.relnamespace
JOIN pg_class dst ON dst.oid=con.confrelid
JOIN pg_namespace nt ON nt.oid=dst.relnamespace
WHERE con.contype='f'
  AND (ns.nspname IN ('public','auth','storage') OR nt.nspname IN ('public','auth','storage'))
ORDER BY 1,2,3;

-- Columns metadata only; identify theoretical progress, revisions, exam relationships.
SELECT table_schema,table_name,column_name,data_type,is_nullable
FROM information_schema.columns
WHERE table_schema='public'
ORDER BY table_name,ordinal_position;

-- Trigger and function names, not function bodies (avoid exposing embedded secrets).
SELECT n.nspname AS schema_name,c.relname AS table_name,t.tgname AS trigger_name,
       pn.nspname AS function_schema,p.proname AS function_name
FROM pg_trigger t
JOIN pg_class c ON c.oid=t.tgrelid
JOIN pg_namespace n ON n.oid=c.relnamespace
JOIN pg_proc p ON p.oid=t.tgfoid
JOIN pg_namespace pn ON pn.oid=p.pronamespace
WHERE NOT t.tgisinternal AND n.nspname IN ('public','auth','storage')
ORDER BY 1,2,3;

-- Summary only: authorized operator may compare source vs target counts later.
SELECT schemaname,relname,n_live_tup AS estimated_rows
FROM pg_stat_user_tables
WHERE schemaname IN ('public','auth','storage')
ORDER BY 1,2;

-- Count-only Storage inventory. Do not disclose bucket names until classified.
SELECT (SELECT count(*) FROM storage.buckets) AS bucket_count,
       (SELECT count(*) FROM storage.objects) AS object_count;
ROLLBACK;
