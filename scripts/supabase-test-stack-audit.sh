#!/usr/bin/env bash
# Non-secret configuration and table-grants inspection for isolated TEST stack.
set -Eeuo pipefail
(( $# == 0 )) || exit 2
readonly LAB=clean-supabase-schema-lab-v1
echo '=== EXISTING SUPABASE IMAGE REFERENCES (NO ENV OR SECRETS) ==='
for c in supabase-db supabase-auth supabase-rest supabase-realtime supabase-storage supabase-functions supabase-kong supabase-envoy; do
 if docker container inspect "$c" >/dev/null 2>&1; then
   docker inspect "$c" --format 'name={{.Name}} image={{.Config.Image}} status={{.State.Status}}'
 fi
done
echo '=== TEST LAB SAFETY ==='
test "$(docker inspect "$LAB" --format '{{.HostConfig.NetworkMode}}')" = none
test "$(docker inspect "$LAB" --format '{{len .HostConfig.PortBindings}}')" = 0
docker inspect "$LAB" --format 'lab={{.Name}} image={{.Config.Image}} status={{.State.Status}} network={{.HostConfig.NetworkMode}}'
echo '=== TEST ROLE TABLE PRIVILEGES (COUNTS, NO DATA) ==='
docker exec "$LAB" psql -X -v ON_ERROR_STOP=1 -U supabase_admin -d postgres -P pager=off <<'SQL'
WITH role_permissions AS (
 SELECT role_name,
  count(*) FILTER (WHERE has_table_privilege(role_name, format('%I.%I', schemaname, tablename), 'SELECT')) AS can_select,
  count(*) FILTER (WHERE has_table_privilege(role_name, format('%I.%I', schemaname, tablename), 'INSERT')) AS can_insert,
  count(*) FILTER (WHERE has_table_privilege(role_name, format('%I.%I', schemaname, tablename), 'UPDATE')) AS can_update,
  count(*) FILTER (WHERE has_table_privilege(role_name, format('%I.%I', schemaname, tablename), 'DELETE')) AS can_delete
 FROM pg_tables CROSS JOIN (VALUES ('anon'),('authenticated'),('service_role')) AS r(role_name)
 WHERE schemaname='public'
 GROUP BY role_name
)
SELECT * FROM role_permissions ORDER BY role_name;
SELECT grantee, privilege_type, count(*) AS grants
FROM information_schema.role_table_grants
WHERE table_schema='public' AND grantee IN ('anon','authenticated','service_role')
GROUP BY grantee, privilege_type ORDER BY grantee, privilege_type;
SELECT extname, extversion FROM pg_extension ORDER BY extname;
SQL
echo '=== AVAILABLE SERVER RESOURCES ==='
free -h | head -3
df -h /var/lib/docker | tail -1
echo 'REPORT COMPLETE — no container changes, secrets or customer rows accessed.'
