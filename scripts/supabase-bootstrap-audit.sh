#!/usr/bin/env bash
# Read-only audit of the exact installed Supabase PostgreSQL image.
set -Eeuo pipefail
if (( $# != 0 )); then echo 'No arguments supported' >&2; exit 2; fi
readonly IMAGE=supabase/postgres:17.6.1.136
docker image inspect "$IMAGE" >/dev/null
echo '=== IMAGE ENTRYPOINT/CMD ==='
docker image inspect "$IMAGE" --format 'Entrypoint={{json .Config.Entrypoint}} Cmd={{json .Config.Cmd}}'
echo '=== INIT TREE ==='
docker run --rm --network none --entrypoint sh "$IMAGE" -c '
set -eu
find /docker-entrypoint-initdb.d -maxdepth 2 -type f -print | sort | sed -n "1,90p"
printf "\n=== BOOTSTRAP MARKERS ===\n"
grep -nE "POSTGRES_USER|supabase_admin|initdb|migrate.sh" /docker-entrypoint-initdb.d/migrate.sh /docker-entrypoint-initdb.d/init-scripts/00000000000000-initial-schema.sql 2>/dev/null | head -45 || true
printf "\n=== EXTENSION PRELOAD MARKERS ===\n"
grep -n "shared_preload_libraries" /etc/postgresql/postgresql.conf | head -8 || true
'
echo 'Audit complete. No existing databases, containers or volumes modified.'
