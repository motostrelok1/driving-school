#!/usr/bin/env bash
# Резервное копирование тестового стека: PostgreSQL (pg_dump -Fc) + файлы Storage.
# Sentinel-проверка: бэкапим только анонимизированную тестовую БД (demo-admin@test.local).
# Ротация: храним 7 последних пар. Restore-проверка: pg_restore --list + подъём sidecar.
set -Eeuo pipefail
umask 077
if (( $# > 1 )); then echo "Usage: backup-test-stack.sh [--verify-restore]" >&2; exit 2; fi

readonly DB=driving-school-supabase-test-db-1
readonly STORAGE=driving-school-supabase-test-storage-1
readonly OUT=/opt/backups/supabase-test
readonly KEEP=7
readonly VERBOSE_RESTORE=${1:-}

fail(){ echo "BLOCKED: $*" >&2; exit 1; }

docker inspect "$DB" --format '{{.State.Running}}' | grep -q true || fail "DB container $DB is not running"
docker inspect "$STORAGE" --format '{{.State.Running}}' | grep -q true || fail "Storage container $STORAGE is not running"
# Бэкапим только очищенную тестовую БД: без sentinel-аккаунта отказываемся
docker exec "$DB" psql -X -At -U supabase_admin -d postgres \
  -c "SELECT 1 FROM auth.users WHERE email='demo-admin@test.local'" | grep -q 1 \
  || fail "Sentinel demo-admin@test.local not found — refusing to back up unknown DB"

mkdir -p "$OUT"
chmod 700 "$OUT"
TS=$(date -u +%Y%m%dT%H%M%SZ)
PG_FILE="$OUT/pg-$TS.dump"
ST_FILE="$OUT/storage-$TS.tgz"

echo "Stage 1: pg_dump (custom format)"
docker exec "$DB" pg_dump -U supabase_admin -d postgres -Fc --no-owner --no-acl > "$PG_FILE"
test -s "$PG_FILE" || fail "Empty pg dump"

echo "Stage 2: storage files tar"
docker exec "$STORAGE" tar czf - -C /var/lib/storage . > "$ST_FILE"
test -s "$ST_FILE" || fail "Empty storage archive"

echo "Stage 3: integrity checks"
# pg_restore --list проверяет заголовок и TOC дампа
docker run --rm -i --network none -v "$OUT:/b:ro" postgres:17 \
  pg_restore --list "/b/$(basename "$PG_FILE")" > /dev/null || fail "pg_restore --list failed"
tar tzf "$ST_FILE" > /dev/null || fail "Storage archive unreadable"
# Счётчики ключевых сущностей — сверяем с живой БД
LIVE_CATALOG=$(docker exec "$DB" psql -X -At -U supabase_admin -d postgres -c "SELECT count(*) FROM public.pdd_course_catalog;")
echo "Live catalog rows: $LIVE_CATALOG"
echo "pg size: $(du -h "$PG_FILE" | cut -f1), storage size: $(du -h "$ST_FILE" | cut -f1)"

if [[ "$VERBOSE_RESTORE" = "--verify-restore" ]]; then
  echo "Stage 4: full restore into throwaway sidecar (network none)"
  LAB="backup-verify-$TS"
  docker rm -f "$LAB" >/dev/null 2>&1 || true
  docker run -d --name "$LAB" --network none -e POSTGRES_PASSWORD=x postgres:17 >/dev/null
  for _ in $(seq 1 60); do docker exec "$LAB" pg_isready -U postgres -q && break; sleep 1; done
  docker exec "$LAB" psql -U postgres -q -c "CREATE DATABASE v;"
  docker exec -i "$LAB" pg_restore -U postgres -d v --no-owner --no-acl < "$PG_FILE" >/dev/null 2>&1 || true
  RESTORED=$(docker exec "$LAB" psql -U postgres -d v -At -c "SELECT count(*) FROM public.pdd_course_catalog;" 2>/dev/null || echo "FAIL")
  PROFILES=$(docker exec "$LAB" psql -U postgres -d v -At -c "SELECT count(*) FROM public.profiles;" 2>/dev/null || echo "FAIL")
  AUTH=$(docker exec "$LAB" psql -U postgres -d v -At -c "SELECT count(*) FROM auth.users;" 2>/dev/null || echo "FAIL")
  echo "Restored: catalog=$RESTORED profiles=$PROFILES auth_users=$AUTH"
  test "$RESTORED" = "$LIVE_CATALOG" || fail "Restored catalog mismatch: $RESTORED != $LIVE_CATALOG"
  test "$AUTH" != "FAIL" && test "$AUTH" -gt 0 || fail "Restored auth.users empty"
  docker rm -f "$LAB" >/dev/null
  echo "Restore verification PASSED"
fi

echo "Stage 5: rotation (keep $KEEP)"
ls -1t "$OUT"/pg-*.dump | tail -n +$((KEEP + 1)) | xargs -r rm -f
ls -1t "$OUT"/storage-*.tgz | tail -n +$((KEEP + 1)) | xargs -r rm -f

echo "=== BACKUP DONE: $(basename "$PG_FILE") + $(basename "$ST_FILE") ==="
