#!/usr/bin/env bash
# Resume auth data-only lab import after known audit_log_entries column drift.
# This is a LAB-ONLY diagnostic; it intentionally excludes historic audit logs.
set -Eeuo pipefail
umask 077
(( $# == 0 )) || { echo 'Arguments forbidden' >&2; exit 2; }
readonly NAME=cloud-full-restore-rehearsal-v1
readonly VOL=cloud-full-restore-rehearsal-data-v1
readonly ARCHIVE=/opt/backups/supabase/cloud-backup.dump
readonly DB=postgres
echo '=== AUTH DATA LAB RETRY — SKIP HISTORICAL AUDIT LOG ONLY ==='
test "$(docker inspect "$NAME" --format '{{.HostConfig.NetworkMode}}')" = none
test "$(docker inspect "$NAME" --format '{{.State.Running}}')" = true
test "$(docker inspect "$NAME" --format '{{range .Mounts}}{{if eq .Destination "/var/lib/postgresql/data"}}{{.Name}}{{end}}{{end}}')" = "$VOL"
test "$(docker inspect "$NAME" --format '{{range .Mounts}}{{if eq .Destination "/backup/cloud-backup.dump"}}{{.Source}}|{{.RW}}{{end}}{{end}}')" = "$ARCHIVE|false"
# No auth data committed in the previous failed --single-transaction import.
count=$(docker exec "$NAME" psql -X -v ON_ERROR_STOP=1 -U supabase_admin -d "$DB" -Atc 'SELECT count(*) FROM auth.users')
test "$count" = 0 || { echo "Auth users already present: $count; refusing replay" >&2; exit 2; }
docker exec "$NAME" sh -eu -c '
 pg_restore --list /backup/cloud-backup.dump > /tmp/auth-data-all.toc
 awk '\''!($0 ~ /^[0-9]+;/ && $0 ~ /TABLE DATA auth audit_log_entries /) '\'' /tmp/auth-data-all.toc > /tmp/auth-data-no-audit.toc
 grep -q "TABLE DATA auth audit_log_entries " /tmp/auth-data-all.toc
 if grep -q "TABLE DATA auth audit_log_entries " /tmp/auth-data-no-audit.toc; then exit 2; fi
'
echo 'Importing all selected Auth data EXCEPT auth.audit_log_entries...'
docker exec "$NAME" pg_restore --single-transaction --exit-on-error --no-owner --no-acl \
  --data-only --schema=auth --use-list=/tmp/auth-data-no-audit.toc \
  -U supabase_admin -d "$DB" /backup/cloud-backup.dump
echo '=== AUTH COUNTS ==='
docker exec "$NAME" psql -X -v ON_ERROR_STOP=1 -U supabase_admin -d "$DB" -Atc \
 "SELECT 'users='||count(*) FROM auth.users UNION ALL SELECT 'identities='||count(*) FROM auth.identities;"
echo 'Auth data import completed in the isolated lab. Public data, RLS, grants, and audit history are NOT validated.'
