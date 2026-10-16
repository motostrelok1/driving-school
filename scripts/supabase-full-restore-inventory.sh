#!/usr/bin/env bash
# Read-only inventory of a pg_restore archive and current smoke container.
set -euo pipefail
if (( $# != 0 )); then echo 'Arguments not allowed' >&2; exit 2; fi
readonly ARCHIVE=/opt/backups/supabase/cloud-backup.dump
readonly SMOKE=cloud-restore-smoke-v1
test -f "$ARCHIVE" && test -s "$ARCHIVE"
test "$(stat -c %a "$ARCHIVE")" = 600
docker inspect "$SMOKE" --format '{{.State.Running}}' | grep -qx true
# Exact mount validation: never use a different container with a matching name.
docker inspect "$SMOKE" --format '{{range .Mounts}}{{if eq .Destination "/backup/cloud-backup.dump"}}{{.Source}}|{{.RW}}{{end}}{{end}}' | grep -Fx "$ARCHIVE|false" >/dev/null
docker inspect "$SMOKE" --format '{{.HostConfig.NetworkMode}}' | grep -qx none
echo '=== FULL RESTORE INVENTORY — READ ONLY ==='
stat -c 'Archive bytes: %s' "$ARCHIVE"
echo '=== PG_RESTORE ARCHIVE HEADER ==='
docker exec "$SMOKE" pg_restore --list /backup/cloud-backup.dump | sed -n '1,14p'
echo '=== PUBLIC AND AUTH OBJECT COUNTS (TOC) ==='
docker exec "$SMOKE" pg_restore --list /backup/cloud-backup.dump | awk '
  /^[0-9]+; / {
    s=$0
    if (s ~ / TABLE DATA public /) n["public table-data"]++
    if (s ~ / TABLE DATA auth /) n["auth table-data"]++
    if (s ~ / TABLE public /) n["public tables"]++
    if (s ~ / FUNCTION public /) n["public functions"]++
    if (s ~ / POLICY public /) n["public policies"]++
    if (s ~ / TRIGGER public /) n["public triggers"]++
    if (s ~ / FK CONSTRAINT public /) n["public foreign keys"]++
    if (s ~ / TABLE DATA storage /) n["storage table-data"]++
    if (s ~ / EXTENSION /) n["extension entries"]++
  }
  END {
    split("public tables|public table-data|auth table-data|public functions|public policies|public triggers|public foreign keys|storage table-data|extension entries", labels, "|")
    for (i=1;i<=9;i++) printf "%s: %d\n",labels[i],n[labels[i]]+0
  }'
echo '=== RESTORED SMOKE TABLE ROW COUNT ==='
docker exec "$SMOKE" psql -X -v ON_ERROR_STOP=1 -U restore_smoke -d restore_smoke -Atc 'SELECT count(*) FROM public.profiles;'
echo '=== LIVE MAIN DB STATUS ONLY ==='
docker inspect supabase-db --format '{{.State.Status}}'
echo 'Done. No restore, data modifications or network calls.'
