-- Read-only inventory for authorized DBA in an APPROVED source database.
-- Output: schema/metadata/counts only. NO user records, emails, tokens, documents or messages.
-- Must run manually after confirming the exact DATABASE URL / instance identity.
BEGIN READ ONLY;
SELECT current_database() AS database_name, current_setting('server_version') AS pg_version;
SELECT nspname AS schema_name FROM pg_namespace WHERE nspname IN ('public','auth','storage') ORDER BY 1;
SELECT schemaname, tablename, rowsecurity AS rls_enabled,
       (SELECT count(*) FROM pg_policies p WHERE p.schemaname=t.schemaname AND p.tablename=t.tablename) AS policy_count
FROM pg_tables t JOIN pg_class c ON c.relname=t.tablename JOIN pg_namespace n ON n.oid=c.relnamespace AND n.nspname=t.schemaname
WHERE schemaname IN ('public','auth','storage') ORDER BY schemaname,tablename;
SELECT schemaname, viewname FROM pg_views WHERE schemaname IN ('public','auth','storage') ORDER BY 1,2;
SELECT n.nspname AS schema_name,p.proname AS function_name,pg_get_function_identity_arguments(p.oid) AS arguments
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname IN ('public','auth','storage') ORDER BY 1,2,3;
SELECT n.nspname AS schema_name, c.relname AS table_name, t.tgname AS trigger_name
FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE NOT t.tgisinternal AND n.nspname IN ('public','auth','storage') ORDER BY 1,2,3;
SELECT pubname, schemaname, tablename FROM pg_publication_tables ORDER BY 1,2,3;
SELECT extname,extversion FROM pg_extension ORDER BY extname;
-- Approximate counts from planner statistics, NOT authoritative copy-verification values.
SELECT schemaname,relname,n_live_tup AS estimated_rows
FROM pg_stat_user_tables WHERE schemaname IN ('public','auth','storage') ORDER BY 1,2;
-- Never use this script to fetch contents of auth.*, students, payments or documents.
ROLLBACK;
