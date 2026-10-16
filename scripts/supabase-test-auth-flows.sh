#!/usr/bin/env bash
# Regression test of the TEST Auth stack against the running containers:
# signup -> profile row, login/refresh/logout, password recovery via Mailpit.
# Creates one random throwaway user per run. Never touches production containers.
set -Eeuo pipefail
umask 077
if (( $# )); then echo "Arguments forbidden" >&2; exit 2; fi
readonly AUTH_URL=http://127.0.0.1:19999
readonly MAILPIT_URL=http://127.0.0.1:18025
readonly DB_CONTAINER=driving-school-supabase-test-db-1
command -v curl >/dev/null || { echo 'curl required' >&2; exit 1; }
docker inspect "$DB_CONTAINER" --format '{{.State.Running}}' 2>/dev/null | grep -q true \
  || { echo "Test DB container $DB_CONTAINER is not running" >&2; exit 1; }
curl -fsS "$AUTH_URL/health" >/dev/null || { echo 'Auth is not healthy' >&2; exit 1; }
curl -fsS "$MAILPIT_URL/api/v1/info" >/dev/null || { echo 'Mailpit is not reachable' >&2; exit 1; }

SUFFIX=$(openssl rand -hex 6)
EMAIL="regress-$SUFFIX@example.invalid"
OLD_PASSWORD=$(openssl rand -base64 24)
NEW_PASSWORD=$(openssl rand -base64 24)

req(){ # method path [json-body]
  local method=$1 path=$2 body=${3:-}
  if [[ -n $body ]]; then
    curl -sS -X "$method" -H 'Content-Type: application/json' --data "$body" -w $'\n%{http_code}' "$AUTH_URL$path"
  else
    curl -sS -X "$method" -H 'Content-Type: application/json' -w $'\n%{http_code}' "$AUTH_URL$path"
  fi
}

echo '=== 1. SIGNUP ==='
SIGNUP=$(req POST /signup "{\"email\":\"$EMAIL\",\"password\":\"$OLD_PASSWORD\",\"data\":{\"first_name\":\"Регресс\",\"last_name\":\"Тестов\",\"middle_name\":\"Автоматов\",\"phone\":\"+79990000001\"}}")
STATUS=${SIGNUP##*$'\n'}
(( STATUS == 200 )) || { echo "FAIL: signup HTTP $STATUS"; exit 1; }
echo "signup HTTP $STATUS"

echo '=== 2. PROFILE ROW ==='
sleep 1
FULL=$(docker exec "$DB_CONTAINER" psql -X -At -U supabase_admin -d postgres \
  -c "SELECT coalesce(full_name,'') || '|' || coalesce(phone,'') || '|' || role FROM public.profiles WHERE email='$EMAIL';")
[[ $FULL == 'Тестов Регресс Автоматов|+79990000001|student' ]] \
  || { echo "FAIL: unexpected profile: $FULL"; exit 1; }
echo "profile OK: $FULL"

echo '=== 3. LOGIN / REFRESH / LOGOUT ==='
TOKENS=$(req POST '/token?grant_type=password' "{\"email\":\"$EMAIL\",\"password\":\"$OLD_PASSWORD\"}")
STATUS=${TOKENS##*$'\n'}
(( STATUS == 200 )) || { echo "FAIL: login HTTP $STATUS"; exit 1; }
BODY=${TOKENS%$'\n'*}
ACCESS=$(printf '%s' "$BODY" | python3 -c 'import sys,json; print(json.load(sys.stdin)["access_token"])')
REFRESH=$(printf '%s' "$BODY" | python3 -c 'import sys,json; print(json.load(sys.stdin)["refresh_token"])')
REFRESHED=$(req POST '/token?grant_type=refresh_token' "{\"refresh_token\":\"$REFRESH\"}")
STATUS=${REFRESHED##*$'\n'}
(( STATUS == 200 )) || { echo "FAIL: refresh HTTP $STATUS"; exit 1; }
NEW_ACCESS=$(printf '%s' "${REFRESHED%$'\n'*}" | python3 -c 'import sys,json; print(json.load(sys.stdin)["access_token"])')
LOGOUT=$(curl -sS -o /dev/null -w '%{http_code}' -X POST -H "Authorization: Bearer $NEW_ACCESS" "$AUTH_URL/logout")
(( LOGOUT == 204 )) || { echo "FAIL: logout HTTP $LOGOUT"; exit 1; }
echo "login/refresh/logout OK"

echo '=== 4. WRONG PASSWORD REJECTED ==='
BAD=$(req POST '/token?grant_type=password' "{\"email\":\"$EMAIL\",\"password\":\"definitely-wrong\"}")
STATUS=${BAD##*$'\n'}
(( STATUS == 400 )) || { echo "FAIL: wrong password accepted (HTTP $STATUS)"; exit 1; }
echo "rejected with HTTP $STATUS"

echo '=== 5. PASSWORD RECOVERY VIA MAILPIT ==='
RECOVER=$(req POST /recover "{\"email\":\"$EMAIL\"}")
STATUS=${RECOVER##*$'\n'}
(( STATUS == 200 )) || { echo "FAIL: recover HTTP $STATUS"; exit 1; }
sleep 1
MSG=$(curl -fsS "$MAILPIT_URL/api/v1/message/latest")
TOKEN_HASH=$(printf '%s' "$MSG" | python3 -c '
import sys, json, re
msg = json.load(sys.stdin)
if msg.get("To", [{}])[0].get("Address") != "'"$EMAIL"'":
    sys.exit("latest mailpit message is not for the test user")
m = re.search(r"[?&]token=([0-9a-f]+)", msg.get("Text", "") or "")
if not m:
    sys.exit("no token in recovery email")
print(m.group(1))')
VERIFY=$(req POST /verify "{\"type\":\"recovery\",\"token_hash\":\"$TOKEN_HASH\"}")
STATUS=${VERIFY##*$'\n'}
(( STATUS == 200 )) || { echo "FAIL: verify HTTP $STATUS"; exit 1; }
RECOVERY_ACCESS=$(printf '%s' "${VERIFY%$'\n'*}" | python3 -c 'import sys,json; print(json.load(sys.stdin)["access_token"])')
UPDATE=$(curl -sS -o /dev/null -w '%{http_code}' -X PUT \
  -H "Authorization: Bearer $RECOVERY_ACCESS" -H 'Content-Type: application/json' \
  --data "{\"password\":\"$NEW_PASSWORD\"}" "$AUTH_URL/user")
(( UPDATE == 200 )) || { echo "FAIL: password update HTTP $UPDATE"; exit 1; }
RELGIN=$(req POST '/token?grant_type=password' "{\"email\":\"$EMAIL\",\"password\":\"$NEW_PASSWORD\"}")
STATUS=${RELGIN##*$'\n'}
(( STATUS == 200 )) || { echo "FAIL: re-login with new password HTTP $STATUS"; exit 1; }
OLD_LOGIN=$(req POST '/token?grant_type=password' "{\"email\":\"$EMAIL\",\"password\":\"$OLD_PASSWORD\"}")
STATUS=${OLD_LOGIN##*$'\n'}
(( STATUS == 400 )) || { echo "FAIL: old password still works"; exit 1; }
echo 'recovery -> verify -> new password -> re-login OK'

echo 'SUCCESS: all auth regression checks passed.'
