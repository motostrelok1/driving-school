#!/usr/bin/env bash
# Root-owned fixed-command diagnostic. Never accepts command line arguments.
set -euo pipefail
if (( $# != 0 )); then echo "Arguments are not accepted" >&2; exit 2; fi
readonly ARCHIVE=/opt/backups/supabase/cloud-backup.dump
readonly TEST_CONTAINER=supabase-restore-db
readonly TEST_VOLUME=supabase-restore-data-v2
readonly NETWORK=supabase-restore-test
echo "=== RESTORE PREFLIGHT — READ ONLY ==="
test -r "$ARCHIVE" || { echo "Backup missing or unreadable"; exit 1; }
stat -c 'Archive bytes: %s' "$ARCHIVE"
test "$(stat -c %a "$ARCHIVE")" = 600 || echo "NOTICE: archive mode differs from 600"
docker network inspect "$NETWORK" --format 'Network internal={{.Internal}}' | grep -qx 'Network internal=true' || { echo "Isolated network missing or not internal"; exit 1; }
docker volume inspect "$TEST_VOLUME" --format 'Test volume exists: {{.Name}}' || echo "NOTICE: new test volume is not yet created"
if ! docker container inspect "$TEST_CONTAINER" >/dev/null 2>&1; then
 echo "Test container not present — expected before recreation"
else
 docker inspect "$TEST_CONTAINER" --format 'Test container: {{.Name}} ({{.State.Status}})'
 docker inspect "$TEST_CONTAINER" --format '{{range .Mounts}}{{if eq .Destination "/var/lib/postgresql/data"}}Mounted data volume: {{.Name}}{{end}}{{end}}'
 docker inspect "$TEST_CONTAINER" --format '{{range .NetworkSettings.Networks}}{{println "Network:" .NetworkID}}{{end}}'
fi
echo "=== ACTIVE MAIN DB — STATUS ONLY ==="
docker inspect supabase-db --format 'Main DB: {{.State.Status}}'
echo "Preflight finished; no databases, containers or volumes were modified."
