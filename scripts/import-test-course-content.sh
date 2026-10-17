#!/usr/bin/env bash
# Идемпотентный перенос учебного контента (ПДД) из cloud-backup.dump в тестовую БД.
# Источник читается в одноразовом контейнере postgres:17 (sidecar, network none),
# далее mirror-замена в тестовой БД: публикации/ревизии/черновики приводятся к
# состоянию источника, каталог синхронизируется upsert'ом (на него ссылается
# прогресс чтения). НЕ трогает: пользователей, документы, прогресс чтения,
# банк вопросов (в источнике отсутствует).
set -Eeuo pipefail
umask 077
if (( $# )); then echo "Arguments forbidden" >&2; exit 2; fi

readonly DB=driving-school-supabase-test-db-1
readonly SRC=course-src-lab
readonly BACKUP_DIR=/opt/backups/supabase
readonly SRCDB=s

fail(){ echo "BLOCKED: $*" >&2; exit 1; }
sql(){ docker exec -i "$DB" psql -X -At -q -U supabase_admin -d postgres -v ON_ERROR_STOP=1 "$@"; }

docker inspect "$DB" --format '{{.State.Running}}' 2>/dev/null | grep -q true || fail "DB container $DB is not running"
test -r "$BACKUP_DIR/cloud-backup.dump" || fail "Archive $BACKUP_DIR/cloud-backup.dump missing"

echo 'Stage 1: source sidecar (throwaway postgres:17, no network)'
docker rm -f "$SRC" >/dev/null 2>&1 || true
docker run -d --name "$SRC" --network none -e POSTGRES_PASSWORD=x \
  -v "$BACKUP_DIR:/b:ro" postgres:17 >/dev/null
for _ in $(seq 1 60); do
  docker exec "$SRC" pg_isready -U postgres -q && break
  sleep 1
done
docker exec "$SRC" psql -U postgres -q -c "CREATE DATABASE $SRCDB;"
# Полное восстановление sidecar'а: extension-ошибки допустимы, проверяем счётчики.
docker exec "$SRC" pg_restore -U postgres -d "$SRCDB" /b/cloud-backup.dump >/dev/null 2>&1 || true
src_count=$(docker exec "$SRC" psql -U postgres -d "$SRCDB" -At -c 'SELECT count(*) FROM public.pdd_course_catalog;')
test "$src_count" -gt 0 || fail 'Source catalog is empty — archive unusable'
echo "Source catalog rows: $src_count"

echo 'Stage 2: column INSERTs from sidecar'
docker exec "$SRC" pg_dump -U postgres -d "$SRCDB" --data-only --column-inserts \
  -t pdd_course_catalog -t pdd_course_drafts -t pdd_course_draft_revisions \
  -t pdd_course_published_revisions -t pdd_course_publications \
  | grep -E '^INSERT INTO' > /tmp/course-raw.sql
test -s /tmp/course-raw.sql || fail 'No content rows extracted from archive'
docker rm -f "$SRC" >/dev/null
echo "Insert statements: $(wc -l < /tmp/course-raw.sql)"

echo 'Stage 3: adapt (identity OVERRIDING + catalog upsert)'
sed -E 's/^INSERT INTO public\.(pdd_course_draft_revisions|pdd_course_published_revisions) (\(.*\)) VALUES /INSERT INTO public.\1 \2 OVERRIDING SYSTEM VALUE VALUES /' /tmp/course-raw.sql \
  | sed -E 's/^INSERT INTO public\.pdd_course_catalog (\(.*\)) VALUES (.*);$/INSERT INTO public.pdd_course_catalog \1 VALUES \2 ON CONFLICT (section_id) DO UPDATE SET title = EXCLUDED.title, sort_order = EXCLUDED.sort_order, is_archived = EXCLUDED.is_archived, updated_at = EXCLUDED.updated_at;/' \
  > /tmp/course-inserts.sql

echo 'Stage 4: mirror replace in target (user triggers off, FK-safe order)'
sql <<'SQL'
BEGIN;
ALTER TABLE public.pdd_course_publications DISABLE TRIGGER USER;
ALTER TABLE public.pdd_course_published_revisions DISABLE TRIGGER USER;
ALTER TABLE public.pdd_course_draft_revisions DISABLE TRIGGER USER;
ALTER TABLE public.pdd_course_drafts DISABLE TRIGGER USER;
ALTER TABLE public.pdd_course_catalog DISABLE TRIGGER USER;
DELETE FROM public.pdd_course_publications;
DELETE FROM public.pdd_course_published_revisions;
DELETE FROM public.pdd_course_draft_revisions;
DELETE FROM public.pdd_course_drafts;
-- Пользователи-авторы части ревизий в источнике удалены: FK снимаем на время
-- импорта, после него обнуляем висячие ссылки и возвращаем ограничения.
ALTER TABLE public.pdd_course_draft_revisions DROP CONSTRAINT pdd_course_draft_revisions_saved_by_fkey;
ALTER TABLE public.pdd_course_drafts DROP CONSTRAINT pdd_course_drafts_updated_by_fkey;
ALTER TABLE public.pdd_course_publications DROP CONSTRAINT pdd_course_publications_published_by_fkey;
ALTER TABLE public.pdd_course_published_revisions DROP CONSTRAINT pdd_course_published_revisions_created_by_fkey;
COMMIT;
SQL
sql < /tmp/course-inserts.sql
sql <<'SQL'
ALTER TABLE public.pdd_course_publications ENABLE TRIGGER USER;
ALTER TABLE public.pdd_course_published_revisions ENABLE TRIGGER USER;
ALTER TABLE public.pdd_course_draft_revisions ENABLE TRIGGER USER;
ALTER TABLE public.pdd_course_drafts ENABLE TRIGGER USER;
ALTER TABLE public.pdd_course_catalog ENABLE TRIGGER USER;
UPDATE public.pdd_course_draft_revisions SET saved_by = NULL WHERE saved_by NOT IN (SELECT id FROM users);
UPDATE public.pdd_course_drafts SET updated_by = NULL WHERE updated_by NOT IN (SELECT id FROM users);
UPDATE public.pdd_course_publications SET published_by = NULL WHERE published_by NOT IN (SELECT id FROM users);
UPDATE public.pdd_course_published_revisions SET created_by = NULL WHERE created_by NOT IN (SELECT id FROM users);
ALTER TABLE public.pdd_course_draft_revisions ADD CONSTRAINT pdd_course_draft_revisions_saved_by_fkey FOREIGN KEY (saved_by) REFERENCES users(id);
ALTER TABLE public.pdd_course_drafts ADD CONSTRAINT pdd_course_drafts_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES users(id);
ALTER TABLE public.pdd_course_publications ADD CONSTRAINT pdd_course_publications_published_by_fkey FOREIGN KEY (published_by) REFERENCES users(id);
ALTER TABLE public.pdd_course_published_revisions ADD CONSTRAINT pdd_course_published_revisions_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);
SELECT setval(pg_get_serial_sequence('public.pdd_course_draft_revisions', 'id'),
             COALESCE((SELECT max(id) FROM public.pdd_course_draft_revisions), 1));
SELECT setval(pg_get_serial_sequence('public.pdd_course_published_revisions', 'id'),
             COALESCE((SELECT max(id) FROM public.pdd_course_published_revisions), 1));
SQL
rm -f /tmp/course-raw.sql /tmp/course-inserts.sql

echo 'Stage 4b: media migration (self-contained storage, no production refs)'
# Контент ссылается на медиа вида https://<project>.supabase.co/storage/v1/object/public/<bucket>/<name>.
# Чтобы тестовое окружение не зависело от production: скачиваем публичные объекты и
# переливаем в локальный Storage, затем переписываем URL в блоках на локальный gateway.
# MEDIA_PUBLIC_BASE — публичный URL тестового стека (https://supabase-test.example.com).
MEDIA_PUBLIC_BASE=${MEDIA_PUBLIC_BASE:-}
MEDIA_UPLOAD_BASE=${MEDIA_UPLOAD_BASE:-http://127.0.0.1:28000}
SRV_ENV=/opt/driving-school-supabase-test/.env
python3 - "$DB" "$MEDIA_PUBLIC_BASE" "$MEDIA_UPLOAD_BASE" "$SRV_ENV" <<'PY'
import json, re, subprocess, sys, tempfile, os, urllib.request

db, public_base, upload_base, srv_env = sys.argv[1:5]

def psql(q):
    # Все запросы через stdin (единый режим, -c не используем:
    # он требует команду следующим аргументом и ломает вложенные вызовы).
    r = subprocess.run(["docker", "exec", "-i", db, "psql", "-X", "-At", "-q",
                        "-v", "ON_ERROR_STOP=1",
                        "-U", "supabase_admin", "-d", "postgres"],
                       input=q, text=True, capture_output=True)
    if r.returncode:
        raise SystemExit("SQL failed: " + r.stderr.strip() + " | " + q[:120])
    return r.stdout

pat = re.compile(r'https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/[^"\\\s]+')
refs = set()
for t in ("pdd_course_drafts", "pdd_course_draft_revisions", "pdd_course_published_revisions"):
    out = psql(f"SELECT DISTINCT blocks::text FROM public.{t};")
    for m in pat.findall(out):
        refs.add(m)

if not refs:
    print("No external media references — nothing to migrate")
    raise SystemExit(0)

if not public_base:
    raise SystemExit("BLOCKED: external media refs exist but MEDIA_PUBLIC_BASE is unset")

srv = None
with open(srv_env) as f:
    for line in f:
        if line.startswith("TEST_SERVICE_ROLE_KEY="):
            srv = line.strip().split("=", 1)[1]
if not srv:
    raise SystemExit("BLOCKED: TEST_SERVICE_ROLE_KEY not found in env file")

migrated = 0
for url in sorted(refs):
    m = re.match(r'https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/([^/]+)/(.+)$', url)
    bucket, name = m.group(1), m.group(2)
    psql("INSERT INTO storage.buckets (id, name, public) VALUES "
         f"('{bucket}', '{bucket}', true) ON CONFLICT (id) DO NOTHING;")
    with tempfile.NamedTemporaryFile(delete=False) as tf:
        tmp = tf.name
    ctype = "application/octet-stream"
    try:
        with urllib.request.urlopen(url) as resp:
            ctype = resp.headers.get_content_type() or ctype
            with open(tmp, "wb") as f:
                f.write(resp.read())
    except Exception as e:
        print(f"WARN: download failed {url}: {e} — left as-is")
        continue
    up = subprocess.run(["curl", "-sS", "-o", "/dev/null", "-w", "%{http_code}", "-X", "POST",
                         f"{upload_base}/storage/v1/object/{bucket}/{name}",
                         "-H", f"apikey: {srv}", "-H", f"Authorization: Bearer {srv}",
                         "-H", "x-upsert: true", "-H", f"Content-Type: {ctype}",
                         "--data-binary", f"@{tmp}"], text=True, capture_output=True)
    os.unlink(tmp)
    if up.stdout not in ("200", "201"):
        raise SystemExit(f"BLOCKED: upload {bucket}/{name} -> {up.stdout} {up.stderr}")
    new_url = f"{public_base}/storage/v1/object/public/{bucket}/{name}"
    for t in ("pdd_course_drafts", "pdd_course_draft_revisions", "pdd_course_published_revisions"):
        psql(f"UPDATE public.{t} SET blocks = replace(blocks::text, '{url}', '{new_url}')::jsonb "
             f"WHERE blocks::text LIKE '%{url}%';")
    migrated += 1
    print(f"Migrated {bucket}/{name} -> local storage")
print(f"Media migration done: {migrated}/{len(refs)}")
PY

echo 'Stage 5: verification'
sql <<'SQL'
SELECT 'catalog: ' || count(*) FROM public.pdd_course_catalog;
SELECT 'drafts: ' || count(*) FROM public.pdd_course_drafts;
SELECT 'draft_revisions: ' || count(*) FROM public.pdd_course_draft_revisions;
SELECT 'published_revisions: ' || count(*) FROM public.pdd_course_published_revisions;
SELECT 'publications: ' || count(*) FROM public.pdd_course_publications;
SELECT 'read_progress untouched: ' || count(*) FROM public.pdd_section_read_progress;
SELECT 'profiles untouched: ' || count(*) FROM public.profiles;
SELECT 'external media refs (must be 0): ' || count(DISTINCT m[1]) FROM (
  SELECT regexp_matches(blocks::text, 'https://[a-z0-9]+\.supabase\.co/', 'g') AS m
  FROM public.pdd_course_published_revisions) s;
SQL
echo '=== COURSE CONTENT IMPORT DONE ==='
