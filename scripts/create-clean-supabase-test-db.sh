#!/usr/bin/env bash
# Create an isolated EMPTY Supabase schema laboratory from a schema-only selection.
# NEVER connects to, replaces, or alters an existing Supabase PostgreSQL database.
set -Eeuo pipefail
umask 077
(( $# == 0 )) || { echo "No arguments accepted" >&2; exit 2; }
readonly IMAGE=supabase/postgres:17.6.1.136
readonly ARCHIVE=/opt/backups/supabase/cloud-backup.dump
readonly CONTAINER=clean-supabase-schema-lab-v1
readonly VOLUME=clean-supabase-schema-lab-data-v1
readonly DB=postgres
fail(){ echo "FAIL: $*" >&2; exit 1; }
echo '=== CLEAN SUPABASE SCHEMA LAB ==='
test -r "$ARCHIVE" && test -s "$ARCHIVE" || fail "Backup missing"
test "$(stat -c %a "$ARCHIVE")" = 600 || fail "Backup permissions should be 600"
docker image inspect "$IMAGE" >/dev/null || fail "Pinned image not available"
docker inspect supabase-db >/dev/null || fail "Expected main database container missing"
if docker inspect "$CONTAINER" >/dev/null 2>&1 || docker volume inspect "$VOLUME" >/dev/null 2>&1; then
  fail "Dedicated test resource already exists; refusing to overwrite"
fi
echo 'Creating fresh dedicated volume and disconnected container'
docker volume create "$VOLUME" >/dev/null
docker run -d --pull never --restart no --name "$CONTAINER" \
  --network none --memory 1024m --cpus 1 --pids-limit 256 --security-opt no-new-privileges \
  -e POSTGRES_USER=supabase_admin -e POSTGRES_DB="$DB" \
  -e POSTGRES_PASSWORD="$(openssl rand -hex 32)" \
  -v "$VOLUME:/var/lib/postgresql/data" \
  -v "$ARCHIVE:/backup/cloud-backup.dump:ro" \
  "$IMAGE" postgres -D /etc/postgresql -c listen_addresses='' >/dev/null
test "$(docker inspect "$CONTAINER" --format '{{.HostConfig.NetworkMode}}')" = none || fail 'Network is not isolated'
test "$(docker inspect "$CONTAINER" --format '{{len .HostConfig.PortBindings}}')" = 0 || fail 'Unexpected exposed ports'
echo 'Waiting for official Supabase database bootstrap'
boot=0
for _ in $(seq 1 120); do
 if docker logs "$CONTAINER" 2>&1 | grep -q 'PostgreSQL init process complete'; then boot=1; break; fi
 if test "$(docker inspect "$CONTAINER" --format '{{.State.Running}}')" != true; then fail 'Bootstrap container stopped'; fi
 sleep 3
done
(( boot == 1 )) || fail 'Bootstrap timed out'
psql_lab(){ docker exec "$CONTAINER" psql -X -v ON_ERROR_STOP=1 -U supabase_admin -d "$DB" -Atc "$1"; }
ready=0
for _ in $(seq 1 30); do
 if psql_lab 'select 1' 2>/dev/null | grep -qx 1; then ready=1; break; fi
 sleep 2
done
(( ready == 1 )) || fail 'PostgreSQL not ready after bootstrap'
# Exclude the existing public SCHEMA and all TABLE DATA entries; pg_restore schema
# sections preserve types, functions, tables, policies, foreign keys and triggers.
echo 'Creating explicit schema-only public TOC'
docker exec "$CONTAINER" sh -eu -c '
 pg_restore -l /backup/cloud-backup.dump > /tmp/backup.toc
 awk '\''/^[0-9]+;/ && / SCHEMA - public / {next} {print}'\'' /tmp/backup.toc > /tmp/public-schema.toc
'
echo 'Restoring PUBLIC schema DDL only (never TABLE DATA)'
docker exec "$CONTAINER" pg_restore --exit-on-error --single-transaction \
 --no-owner --no-acl --schema=public --section=pre-data \
 --use-list=/tmp/public-schema.toc -U supabase_admin -d "$DB" /backup/cloud-backup.dump
docker exec "$CONTAINER" pg_restore --exit-on-error --single-transaction \
 --no-owner --no-acl --schema=public --section=post-data \
 --use-list=/tmp/public-schema.toc -U supabase_admin -d "$DB" /backup/cloud-backup.dump
echo '=== EMPTY DATA AND STRUCTURE ASSERTIONS ==='
psql_lab "SELECT 'auth_users='||count(*) FROM auth.users UNION ALL SELECT 'profiles='||count(*) FROM public.profiles;"
psql_lab "SELECT 'public_tables='||count(*) FROM pg_tables WHERE schemaname='public';"
psql_lab "SELECT 'public_functions='||count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public';"
psql_lab "SELECT 'public_policies='||count(*) FROM pg_policies WHERE schemaname='public';"
test "$(psql_lab 'SELECT count(*) FROM auth.users')" = 0 || fail 'Expected no Auth users'
test "$(psql_lab 'SELECT count(*) FROM public.profiles')" = 0 || fail 'Expected no profiles'
test "$(psql_lab "SELECT count(*) FROM pg_tables WHERE schemaname='public'")" = 30 || fail 'Unexpected public table count'
test "$(psql_lab "SELECT count(*) FROM pg_policies WHERE schemaname='public'")" = 60 || fail 'Unexpected policy count'
echo 'SCHEMA DDL APPLIED, BUT GRANTS/RLS FUNCTIONAL TESTS AND AUTH API ARE STILL REQUIRED.'
echo 'No API services started, no production records restored, no production resources changed.'
echo 'Test container and volume retained for later verification; do not point production here.'
