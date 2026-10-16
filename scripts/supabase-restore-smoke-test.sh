#!/usr/bin/env bash
# Root-owned fixed-command, one-shot smoke test of one public table.
# Never modifies existing Docker containers, volumes, databases, or networks.
set -Eeuo pipefail
umask 077
if (( $# )); then echo "Arguments forbidden" >&2; exit 2; fi
readonly ARCHIVE=/opt/backups/supabase/cloud-backup.dump
readonly TEST_CONTAINER=cloud-restore-smoke-v1
readonly TEST_VOLUME=cloud-restore-smoke-data-v1
readonly IMAGE=postgres:17.6
readonly MAIN_CONTAINER=supabase-db

echo '=== CLOUD BACKUP SINGLE-TABLE RESTORE TEST ==='
test -f "$ARCHIVE" && test -s "$ARCHIVE" || { echo 'Missing backup'; exit 1; }
test "$(stat -c %a "$ARCHIVE")" = 600 || { echo 'Backup file permissions must be 600'; exit 1; }
docker inspect "$MAIN_CONTAINER" --format 'Production DB: {{.State.Status}}' >/dev/null
docker image inspect "$IMAGE" >/dev/null || { echo 'Expected PostgreSQL image not cached. Stop.'; exit 1; }
if docker container inspect "$TEST_CONTAINER" >/dev/null 2>&1; then
  echo "Stop: test container already exists; no changes made."
  exit 1
fi
if docker volume inspect "$TEST_VOLUME" >/dev/null 2>&1; then
  echo "Stop: test volume already exists; no changes made."
  exit 1
fi

# Fixed independent volume and container. No network, no published ports.
docker volume create "$TEST_VOLUME" >/dev/null
docker run -d \
  --name "$TEST_CONTAINER" \
  --pull never \
  --network none \
  --memory 768m --cpus 1 \
  --restart no \
  -e POSTGRES_USER=restore_smoke \
  -e POSTGRES_DB=restore_smoke \
  -e POSTGRES_PASSWORD="$(openssl rand -hex 32)" \
  -v "$TEST_VOLUME:/var/lib/postgresql/data" \
  -v "$ARCHIVE:/backup/cloud-backup.dump:ro" \
  "$IMAGE" \
  postgres -c listen_addresses='' >/dev/null

echo 'Waiting for isolated test database...'
ready=0
for i in $(seq 1 30); do
  if docker exec "$TEST_CONTAINER" pg_isready -U restore_smoke -d restore_smoke >/dev/null 2>&1; then ready=1; break; fi
  sleep 2
done
if (( ready != 1 )); then echo 'Isolated PostgreSQL did not become ready'; exit 1; fi
echo 'Restoring public.profiles schema (no constraints, policies, or triggers)...'
docker exec "$TEST_CONTAINER" pg_restore \
  --exit-on-error --no-owner --no-acl --section=pre-data \
  --schema=public --table=profiles -U restore_smoke -d restore_smoke \
  /backup/cloud-backup.dump
echo 'Restoring public.profiles data...'
docker exec "$TEST_CONTAINER" pg_restore \
  --exit-on-error --no-owner --no-acl --data-only \
  --schema=public --table=profiles -U restore_smoke -d restore_smoke \
  /backup/cloud-backup.dump
echo '=== VERIFIED RESTORED ROW COUNT (snapshot only) ==='
docker exec "$TEST_CONTAINER" psql -X -v ON_ERROR_STOP=1 -U restore_smoke -d restore_smoke \
  -Atc 'SELECT count(*) FROM public.profiles;'
echo 'SUCCESS: one-table smoke test restored into an isolated no-network PostgreSQL.'
echo 'TEST ARTIFACTS ARE RETAINED. DO NOT TREAT THIS AS FULL AUTH/RLS RESTORE.'
