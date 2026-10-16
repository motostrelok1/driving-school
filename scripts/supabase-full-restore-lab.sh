#!/usr/bin/env bash
# Isolated full-restore experiment. Root-only, no parameters, never used on production.
# IMPORTANT: This is a staged attempt; success requires comprehensive verification.
set -Eeuo pipefail
umask 077
if (( $# != 0 )); then echo 'Arguments forbidden' >&2; exit 2; fi
readonly ARCHIVE=/opt/backups/supabase/cloud-backup.dump
readonly CONTAINER=cloud-full-restore-lab-v1
readonly VOLUME=cloud-full-restore-lab-data-v1
readonly IMAGE=supabase/postgres:17.6.1.136
readonly SMOKE=cloud-restore-smoke-v1
readonly DB=restore_lab

die() { echo "STOP: $*" >&2; exit 1; }
echo '=== FULL RESTORE LAB — ISOLATED ONLY ==='
test -f "$ARCHIVE" && test -s "$ARCHIVE" || die 'Archive missing'
test "$(stat -c %a "$ARCHIVE")" = 600 || die 'Archive mode must be 600'
docker image inspect "$IMAGE" >/dev/null 2>&1 || die 'Required image not locally available'
docker container inspect supabase-db >/dev/null 2>&1 || die 'Production container name not found; refusing ambiguous environment'
docker container inspect "$SMOKE" >/dev/null 2>&1 || die 'Previous smoke test is missing'
if docker container inspect "$CONTAINER" >/dev/null 2>&1; then die 'Lab container already exists'; fi
if docker volume inspect "$VOLUME" >/dev/null 2>&1; then die 'Lab volume already exists'; fi
# Fail closed while the full Supabase dependency graph is not validated.
# A backup can contain functions, triggers and extension commands whose execution
# is not safe merely because the destination container has no network.
echo '=== FULL RESTORE SAFETY GATE ==='
echo 'BLOCKED: Auth/public/full-schema restore requires verified bootstrap,'
echo 'extension allowlist, grants, TOC selection, and trigger/function review.'
echo 'No lab containers or volumes have been created by this run.'
exit 3

echo 'Preconditions passed. Creating unique lab resources only.'
docker volume create "$VOLUME" >/dev/null
# Empty init folder disables official migrations to prevent live network jobs or background schedulers.
# This stage bootstraps a clean PostgreSQL cluster and attempts the archive's own auth/public schema.
readonly EMPTY_INIT=/opt/supabase/restore-empty-init
test -d "$EMPTY_INIT" || die 'Empty init directory missing'
test -z "$(find "$EMPTY_INIT" -mindepth 1 -maxdepth 1 -print -quit)" || die 'Init directory must be empty'
docker run -d \
  --name "$CONTAINER" --pull never --restart no \
  --network none --memory 768m --cpus 1 --pids-limit 256 \
  --cap-drop ALL --security-opt no-new-privileges \
  -e POSTGRES_USER=postgres -e POSTGRES_DB="$DB" \
  -e POSTGRES_PASSWORD="$(openssl rand -hex 32)" \
  -v "$VOLUME:/var/lib/postgresql/data" \
  -v "$ARCHIVE:/backup/cloud-backup.dump:ro" \
  -v "$EMPTY_INIT:/docker-entrypoint-initdb.d:ro" \
  "$IMAGE" postgres \
     -c config_file=/etc/postgresql/postgresql.conf \
     -c shared_preload_libraries=pg_stat_statements \
     -c listen_addresses='' > /dev/null
ready=0
for i in $(seq 1 40); do
  if docker exec "$CONTAINER" pg_isready -U postgres -d "$DB" >/dev/null 2>&1; then ready=1; break; fi
  sleep 2
done
((ready == 1)) || die 'Lab postgres did not start; inspect container logs'

echo '=== CREATE MINIMAL NONLOGIN ROLES REQUIRED FOR SCHEMA RESTORE ==='
# These roles exist only inside the disposable lab. They are not credentials or network accounts.
docker exec "$CONTAINER" psql -X -v ON_ERROR_STOP=1 -U postgres -d "$DB" -c "
DO \$\$ DECLARE r text; BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role','authenticator',
  'supabase_admin','supabase_auth_admin','supabase_storage_admin','supabase_realtime_admin',
  'supabase_vault','supabase_functions_admin'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname=r) THEN
      EXECUTE format('CREATE ROLE %I NOLOGIN',r);
    END IF;
  END LOOP;
END \$\$;"
echo '=== RESTORE SCHEMAS: public, auth, extensions (schema+data) ==='
echo 'NOTICE: PostgreSQL extension prerequisites and cross-schema ownership may prevent complete restore.'
# No cron, net or storage tables restored; avoids data-driven notification schedules.
# --exit-on-error ensures no partial result can be labelled SUCCESS.
docker exec "$CONTAINER" pg_restore \
  --exit-on-error --single-transaction --no-owner --no-acl \
  --schema=public --schema=auth --schema=extensions \
  -U postgres -d "$DB" /backup/cloud-backup.dump
echo '=== RESTORED COUNTS (only reached if above succeeded) ==='
docker exec "$CONTAINER" psql -X -v ON_ERROR_STOP=1 -U postgres -d "$DB" -Atc "SELECT 'profiles='||count(*) FROM public.profiles UNION ALL SELECT 'auth_users='||count(*) FROM auth.users;"
echo 'RESTORE COMMAND SUCCEEDED; AUTH/RLS/GRANTS/TRIGGERS/EXTENSIONS MUST STILL BE VALIDATED.'
echo 'Lab artifacts retained. No production database changed.'
