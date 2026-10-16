#!/usr/bin/env bash
# One-shot isolated Auth/REST test stack setup. NEVER touches supabase-db.
set -Eeuo pipefail
umask 077
(( $# == 0 )) || { echo 'No arguments accepted' >&2; exit 2; }
readonly ROOT=/opt/driving-school-supabase-test
readonly LAB=clean-supabase-schema-lab-v1
readonly PROJECT=driving-school-supabase-test
readonly COMPOSE="$ROOT/compose.yml"
readonly ENVFILE="$ROOT/.env"
fail(){ echo "BLOCKED: $*" >&2; exit 1; }
test "$(id -u)" = 0 || fail 'Must run as root'
test -f "$COMPOSE" || fail 'Install reviewed compose.yml first'
test "$(stat -c %a "$COMPOSE")" != 777 || fail 'Insecure compose file permissions'
test -f "$ROOT/storage-buckets.sql" || fail 'Install reviewed storage-buckets.sql first'
test -r /opt/backups/supabase/cloud-backup.dump || fail 'Archive missing'
test "$(docker inspect "$LAB" --format '{{.HostConfig.NetworkMode}}')" = none || fail 'Lab network changed'
test "$(docker exec "$LAB" psql -X -U supabase_admin -d postgres -Atc 'select count(*) from auth.users')" = 0 || fail 'Lab has users'
if test -e "$ENVFILE" || docker volume inspect ${PROJECT}_test_postgres_data >/dev/null 2>&1; then
 fail 'Test project already initialized. Refusing overwrite.'
fi
mkdir -p "$ROOT"
python3 - "$ENVFILE" <<'PY'
import sys,secrets,base64,json,hmac,hashlib,datetime,pathlib
secret=secrets.token_urlsafe(48)
password=secrets.token_hex(24)
def enc(obj):
 return base64.urlsafe_b64encode(json.dumps(obj,separators=(',',':')).encode()).rstrip(b'=').decode()
header=enc({'alg':'HS256','typ':'JWT'})
def token(role):
 now=int(datetime.datetime.now(datetime.timezone.utc).timestamp())
 payload=enc({'role':role,'iss':'supabase-test','iat':now,'exp':now+60*60*24*365})
 body=f'{header}.{payload}'
 sig=base64.urlsafe_b64encode(hmac.new(secret.encode(),body.encode(),hashlib.sha256).digest()).rstrip(b'=').decode()
 return body+'.'+sig
p=pathlib.Path(sys.argv[1])
p.write_text(f'TEST_POSTGRES_PASSWORD={password}\nTEST_JWT_SECRET={secret}\nTEST_ANON_KEY={token("anon")}\nTEST_SERVICE_ROLE_KEY={token("service_role")}\n')
p.chmod(0o600)
PY
dc(){ env -i PATH="$PATH" HOME="$HOME" docker compose --project-name "$PROJECT" --env-file "$ENVFILE" -f "$COMPOSE" "$@"; }
# Validate the rendered configuration privately; never print it (contains secrets).
dc config --quiet || fail 'Docker Compose configuration invalid'
echo 'Bootstrapping private test database, no host database ports'
dc up -d db
DBCONTAINER=$(dc ps -q db)
test -n "$DBCONTAINER" || fail 'Database did not start'
boot=0
for _ in $(seq 1 120); do
 if docker logs "$DBCONTAINER" 2>&1 | grep -q 'PostgreSQL init process complete'; then boot=1; break; fi
 test "$(docker inspect "$DBCONTAINER" --format '{{.State.Running}}')" = true || fail 'DB stopped'
 sleep 3
done
(( boot == 1 )) || fail 'Bootstrap timeout'
sql(){ docker exec "$DBCONTAINER" psql -X -v ON_ERROR_STOP=1 -U supabase_admin -d postgres -Atc "$1"; }
test "$(sql 'select count(*) from auth.users')" = 0 || fail 'Unexpected users in empty test DB'
# Supabase bootstrap does not automatically set the generated password on
# authenticator, supabase_auth_admin and supabase_storage_admin; without this
# GoTrue/PostgREST/Storage fail to connect.
# Never print this value; it is hex generated in our private env file.
TEST_DB_PASSWORD=$(sed -n 's/^TEST_POSTGRES_PASSWORD=//p' "$ENVFILE")
[[ "$TEST_DB_PASSWORD" =~ ^[0-9a-f]{48}$ ]] || fail 'Invalid test DB password format'
printf "ALTER ROLE authenticator WITH PASSWORD '%s';\\nALTER ROLE supabase_auth_admin WITH PASSWORD '%s';\\nALTER ROLE supabase_storage_admin WITH PASSWORD '%s';\\n" \
  "$TEST_DB_PASSWORD" "$TEST_DB_PASSWORD" "$TEST_DB_PASSWORD" | \
  docker exec -i "$DBCONTAINER" psql -X -v ON_ERROR_STOP=1 -U supabase_admin -d postgres >/dev/null
unset TEST_DB_PASSWORD
echo 'Loading public DDL ONLY from local backup'
docker exec "$DBCONTAINER" sh -eu -c '
 pg_restore -l /backup/cloud-backup.dump | sed -E "/^[0-9]+; [0-9]+ [0-9]+ SCHEMA - public /d" > /tmp/public-schema.toc
'
for section in pre-data post-data; do
 docker exec "$DBCONTAINER" pg_restore --single-transaction --exit-on-error --no-owner --no-acl \
  --schema=public --section="$section" --use-list=/tmp/public-schema.toc \
  -U supabase_admin -d postgres /backup/cloud-backup.dump
done
test "$(sql "select count(*) from pg_tables where schemaname='public'")" = 30 || fail 'Table count mismatch'
test "$(sql "select count(*) from pg_policies where schemaname='public'")" = 60 || fail 'Policy count mismatch'
test "$(sql 'select count(*) from auth.users')" = 0 || fail 'Unexpected imported users'
echo 'Installing profile auto-creation trigger (not present in public-only DDL restore)'
docker exec -i "$DBCONTAINER" psql -X -v ON_ERROR_STOP=1 -U supabase_admin -d postgres <<'SQL'
-- Функция собирает ФИО из метаданных регистрации и сохраняет телефон.
-- Роль жёстко 'student': повысить роль через метаданные signup нельзя.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, role, full_name, phone, email)
  VALUES (
    NEW.id,
    'student',
    COALESCE(
      NULLIF(trim(concat_ws(' ',
        NEW.raw_user_meta_data->>'last_name',
        NEW.raw_user_meta_data->>'first_name',
        COALESCE(NEW.raw_user_meta_data->>'middle_name', NEW.raw_user_meta_data->>'patronymic')
      )), ''),
      NEW.raw_user_meta_data->>'full_name',
      ''
    ),
    NEW.raw_user_meta_data->>'phone',
    NEW.email
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    phone = EXCLUDED.phone,
    email = EXCLUDED.email,
    updated_at = now();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Догнать пользователей, созданных до появления триггера
INSERT INTO public.profiles (id, role, full_name, phone, email)
SELECT
  u.id,
  'student',
  COALESCE(
    NULLIF(trim(concat_ws(' ',
      u.raw_user_meta_data->>'last_name',
      u.raw_user_meta_data->>'first_name',
      COALESCE(u.raw_user_meta_data->>'middle_name', u.raw_user_meta_data->>'patronymic')
    )), ''),
    u.raw_user_meta_data->>'full_name',
    ''
  ),
  u.raw_user_meta_data->>'phone',
  u.email
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id);
SQL
test "$(sql "select count(*) from pg_trigger where tgrelid='auth.users'::regclass and not tgisinternal")" = 1 || fail 'Profile trigger missing'
# Outbound mail is impossible: SMTP points at internal mailpit, network is internal-only.
echo 'Starting localhost-only Auth, REST, Mailpit and port proxies'
dc up -d
# A running container alone is not evidence that the API works.
for service in auth rest storage gateway; do
  container=$(dc ps -q "$service")
  test -n "$container" || fail "Missing container for $service"
  test "$(docker inspect "$container" --format '{{.State.Running}}')" = true || fail "$service exited"
done
# Storage migrates its schema on first start; buckets SQL must run after that.
storage_ready=0
for _ in $(seq 1 60); do
  if curl -sf -o /dev/null http://127.0.0.1:28000/storage/v1/status; then storage_ready=1; break; fi
  sleep 2
done
(( storage_ready == 1 )) || fail 'Storage API did not become ready'
echo 'Creating storage buckets and policies'
docker exec -i "$DBCONTAINER" psql -X -v ON_ERROR_STOP=1 -U supabase_admin -d postgres \
  < "$ROOT/storage-buckets.sql" >/dev/null
test "$(sql "select count(*) from storage.buckets")" = 3 || fail 'Bucket count mismatch'
test "$(sql "select count(*) from pg_policies where schemaname='storage'")" = 8 || fail 'Storage policy count mismatch'
echo '=== SERVICE STATUS ==='
dc ps
echo 'Gateway: http://127.0.0.1:28000/ (auth/v1, rest/v1, storage/v1)'
echo 'Mailpit UI: http://127.0.0.1:18025/'
echo 'Test keys are stored locally in root-only .env; NEVER paste them into chat.'
echo 'No public HTTPS gateway or PWA installed. Do not point production here.'
