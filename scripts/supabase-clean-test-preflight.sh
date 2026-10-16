#!/usr/bin/env bash
# Read-only validation of the isolated, empty schema before attaching API services.
set -Eeuo pipefail
(( $# == 0 )) || { echo 'No arguments accepted' >&2; exit 2; }
readonly C=clean-supabase-schema-lab-v1
readonly V=clean-supabase-schema-lab-data-v1
readonly DB=postgres
fail(){ echo "BLOCKED: $*" >&2; exit 1; }
test "$(docker inspect "$C" --format '{{.HostConfig.NetworkMode}}')" = none || fail "test database must remain disconnected"
test "$(docker inspect "$C" --format '{{len .HostConfig.PortBindings}}')" = 0 || fail 'unexpected published ports'
test "$(docker inspect "$C" --format '{{range .Mounts}}{{if eq .Destination "/var/lib/postgresql/data"}}{{.Name}}{{end}}{{end}}')" = "$V" || fail 'unexpected data volume'
sql(){ docker exec "$C" psql -X -v ON_ERROR_STOP=1 -U supabase_admin -d "$DB" -Atc "$1"; }
sql "SELECT 'auth_users='||count(*) FROM auth.users UNION ALL SELECT 'public_tables='||count(*) FROM pg_tables WHERE schemaname='public' UNION ALL SELECT 'profiles='||count(*) FROM public.profiles UNION ALL SELECT 'rls_policies='||count(*) FROM pg_policies WHERE schemaname='public';"
for spec in 'auth.users:0' 'public.profiles:0'; do
 name=${spec%%:*}; expected=${spec##*:}
 test "$(sql "SELECT count(*) FROM $name")" = "$expected" || fail "data found in $name"
done
test "$(sql "SELECT count(*) FROM pg_tables WHERE schemaname='public'")" = 30 || fail 'table count mismatch'
test "$(sql "SELECT count(*) FROM pg_policies WHERE schemaname='public'")" = 60 || fail 'policy count mismatch'
test "$(sql "SELECT count(*) FROM pg_constraint co JOIN pg_namespace n ON n.oid=co.connamespace WHERE n.nspname='public' AND co.contype='f'")" = 44 || fail 'FK count mismatch'
test "$(sql "SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal")" = 16 || fail 'trigger count mismatch'
echo '=== OWNER AND PRIVILEGE INVENTORY (NON-AUTHORITATIVE) ==='
sql "SELECT 'owner='||pg_get_userbyid(c.relowner)||', tables='||count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p') GROUP BY c.relowner ORDER BY 1;"
sql "SELECT 'role='||r.rolname||', schema_usage='||has_schema_privilege(r.rolname, 'public', 'USAGE')||', schema_create='||has_schema_privilege(r.rolname, 'public', 'CREATE') FROM pg_roles r WHERE rolname IN ('anon','authenticated','service_role','authenticator') ORDER BY rolname;"
sql "SELECT 'table='||c.relname||', owner='||pg_get_userbyid(c.relowner)||', rls='||c.relrowsecurity||', forced='||c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p') ORDER BY c.relname;"
echo 'READ-ONLY PRE-FLIGHT PASSED. This does NOT validate API grants, JWT, policies, login, or Storage.'
