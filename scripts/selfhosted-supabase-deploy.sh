#!/usr/bin/env bash
# Runs ONLY on the VDS after a verified database baseline and external backup.
set -Eeuo pipefail
umask 077
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

ARCHIVE="${1:-}"
ROOT=/opt/supabase
LEDGER=public._deploy_migrations
LOCK=/var/lock/driving-school-supabase-deploy.lock

[[ "$EUID" -eq 0 ]] || { echo "Must run as root" >&2; exit 1; }
[[ -f "$ROOT/.migration-baselined" ]] || { echo "Baseline not approved: refusing deployment" >&2; exit 1; }
[[ -f "$ARCHIVE" && ! -L "$ARCHIVE" ]] || { echo "Missing archive" >&2; exit 1; }
command -v docker >/dev/null
command -v flock >/dev/null
command -v sha256sum >/dev/null
exec 9>"$LOCK"
flock -n 9 || { echo "Another deployment is running" >&2; exit 1; }
TEMP="$(mktemp -d)"
trap 'rm -rf "$TEMP"; rm -f "$ARCHIVE"' EXIT

# Only permit expected repo-relative files; refuse symlinks and special files.
tar -tzf "$ARCHIVE" | while IFS= read -r item; do
  case "$item" in
    supabase/migrations/*|supabase/functions/*) ;;
    *) echo "Unexpected archive path: $item" >&2; exit 1 ;;
  esac
  case "$item" in *../*|/*) echo "Unsafe archive path" >&2; exit 1 ;; esac
done
tar -xzf "$ARCHIVE" -C "$TEMP" --no-same-owner
if find "$TEMP" -type l | grep -q .; then echo "Symlinks are not allowed" >&2; exit 1; fi
if find "$TEMP" ! -type d ! -type f | grep -q .; then echo "Special files are not allowed" >&2; exit 1; fi

db() { docker exec -i supabase-db psql -X -v ON_ERROR_STOP=1 -U supabase_admin -d postgres "$@"; }
[[ "$(db -Atqc "SELECT to_regclass('$LEDGER') IS NOT NULL")" == t ]] || {
  echo "Migration ledger missing; baseline required" >&2; exit 1;
}
for file in "$TEMP"/supabase/migrations/*.sql; do
  [[ -f "$file" ]] || continue
  name="$(basename "$file")"
  [[ "$name" =~ ^[0-9]{4,14}_[a-zA-Z0-9_]+\.sql$ ]] || exit 1
  sha="$(sha256sum "$file" | cut -d' ' -f1)"
  previous="$(db -Atqc "SELECT checksum FROM $LEDGER WHERE filename='$name'")"
  if [[ -n "$previous" ]]; then
    [[ "$previous" == "$sha" ]] || { echo "Applied migration changed: $name" >&2; exit 1; }
    echo "Already applied: $name"
    continue
  fi
  echo "Applying migration: $name"
  # One transaction for SQL and bookkeeping; files containing nontransactional DDL require a separate reviewed plan.
  {
    printf 'BEGIN;\n'
    cat "$file"
    printf "\nINSERT INTO %s (filename,checksum) VALUES ('%s','%s');\nCOMMIT;\n" "$LEDGER" "$name" "$sha"
  } | db -q >/dev/null
done
db -qc "NOTIFY pgrst, 'reload schema';"
echo "SQL migrations completed."

# Repo functions can have multiple files; the existing main/index.ts router must support their names.
mkdir -p "$ROOT/volumes/functions"
for dir in "$TEMP"/supabase/functions/*; do
  [[ -d "$dir" ]] || continue
  name="$(basename "$dir")"
  [[ "$name" =~ ^[a-z0-9][a-z0-9-]*$ ]] || exit 1
  mkdir -p "$ROOT/volumes/functions/$name"
  cp -a "$dir/." "$ROOT/volumes/functions/$name/"
done
cd "$ROOT"
env -i PATH="$PATH" HOME=/root docker compose -f docker-compose.yml -f docker-compose.override.yml up -d --no-deps --force-recreate functions
echo "Functions updated; check health and invocation tests."
