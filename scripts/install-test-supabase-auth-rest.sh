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
# No external SMTP/push/cron integration is configured in this test stack.
echo 'Starting localhost-only Auth and REST'
dc up -d auth rest
echo '=== SERVICE STATUS ==='
dc ps
echo 'Auth: http://127.0.0.1:19999/health ; REST: http://127.0.0.1:18080/'
echo 'Test keys are stored locally in root-only .env; NEVER paste them into chat.'
echo 'No public web gateway, Storage API or PWA installed. Do not point production here.'
