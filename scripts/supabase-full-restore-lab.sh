#!/usr/bin/env bash
# One-shot isolated full restore rehearsal. Never target any existing database.
set -Eeuo pipefail
umask 077
(( $# == 0 )) || { echo 'No arguments permitted' >&2; exit 2; }
readonly ARCHIVE=/opt/backups/supabase/cloud-backup.dump
readonly IMAGE=supabase/postgres:17.6.1.136
readonly NAME=cloud-full-restore-rehearsal-v1
readonly VOL=cloud-full-restore-rehearsal-data-v1
readonly DB=postgres
err() { printf 'FAILED at line %s. Isolated artifacts retained for inspection.\n' "$1" >&2; }
trap 'err "$LINENO"' ERR
echo '=== ISOLATED RESTORE REHEARSAL ==='
test -f "$ARCHIVE" && test -s "$ARCHIVE"
test "$(stat -c %a "$ARCHIVE")" = 600
docker image inspect "$IMAGE" >/dev/null
# Existing instances and volumes are never reused, removed or modified.
if docker container inspect "$NAME" >/dev/null 2>&1 || docker volume inspect "$VOL" >/dev/null 2>&1; then
  echo 'Fixed test container/volume name already exists — refusing to change it.' >&2; exit 2
fi
# The full Supabase bootstrap requires pg_cron/pg_net extensions. The isolated
# container has no network and no published ports; it cannot reach production.
# Do not attach a shared Docker network or run API/Edge services in this lab.
docker volume create "$VOL" >/dev/null
echo 'Initializing a fresh Supabase database with bundled migrations...'
docker run -d --name "$NAME" --pull never --restart no \
  --network none --memory 1024m --cpus 1 --pids-limit 256 \
  --security-opt no-new-privileges \
  -e POSTGRES_USER=supabase_admin -e POSTGRES_DB="$DB" \
  -e POSTGRES_PASSWORD="$(openssl rand -hex 32)" \
  -v "$VOL:/var/lib/postgresql/data" \
  -v "$ARCHIVE:/backup/cloud-backup.dump:ro" \
  "$IMAGE" postgres -D /etc/postgresql -c listen_addresses='' >/dev/null
# pg_isready can become true before init scripts finish. Wait until the
# bootstrap explicitly finishes (the entrypoint emits the completion marker).
ready=0
for i in $(seq 1 120); do
  if docker logs "$NAME" 2>&1 | grep -q 'PostgreSQL init process complete'; then ready=1; break; fi
  if test "$(docker inspect "$NAME" --format '{{.State.Running}}')" != true; then
    echo 'Container exited during bootstrap; examine local Docker logs' >&2; exit 1
  fi
  sleep 3
done
(( ready == 1 )) || { echo 'Supabase bootstrap did not finish within 6 minutes' >&2; exit 1; }
execsql() { docker exec "$NAME" psql -X -v ON_ERROR_STOP=1 -U supabase_admin -d "$DB" -Atc "$1"; }
restore() { docker exec "$NAME" pg_restore --single-transaction --exit-on-error --no-owner --no-acl -U supabase_admin -d "$DB" "$@" /backup/cloud-backup.dump; }
echo 'Restoring application public schema before user data...'
restore --section=pre-data --schema=public
echo 'Restoring Auth users and related Auth data into bootstrap-created tables...'
restore --data-only --schema=auth
echo 'Restoring application data...'
restore --data-only --schema=public
echo 'Restoring public constraints, indexes, triggers and RLS...'
restore --section=post-data --schema=public
echo '=== BASIC RESTORE ASSERTIONS ==='
execsql "SELECT 'users='||count(*) FROM auth.users UNION ALL SELECT 'profiles='||count(*) FROM public.profiles;"
execsql "SELECT 'public_tables='||count(*) FROM pg_tables WHERE schemaname='public';"
execsql "SELECT 'public_policies='||count(*) FROM pg_policies WHERE schemaname='public';"
echo 'The command completed. This is NOT proof of working login, ownership, grants or Storage.'
echo 'DO NOT point any application at this laboratory cluster.'
