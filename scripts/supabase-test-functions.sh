#!/usr/bin/env bash
# Edge Functions regression test on the TEST stack: авторизация каждой функции,
# ролевая проверка admin, секретные эндпоинты. OneSignal — заглушки,
# реальных пушей не отправляется.
set -Eeuo pipefail
umask 077
if (( $# )); then echo "Arguments forbidden" >&2; exit 2; fi
docker inspect driving-school-supabase-test-functions-1 --format '{{.State.Running}}' 2>/dev/null | grep -q true \
  || { echo 'Functions container is not running' >&2; exit 1; }
command -v python3 >/dev/null || { echo 'python3 required' >&2; exit 1; }

python3 <<'PY'
import json
import secrets
import subprocess

GW = "http://127.0.0.1:28000/functions/v1"
ENVFILE = "/opt/driving-school-supabase-test/.env"
env = dict(l.strip().split("=", 1) for l in open(ENVFILE) if "=" in l and not l.startswith("#"))
ANON = env["TEST_ANON_KEY"]
REMINDER_SECRET = env["TEST_DRIVING_REMINDER_SECRET"]
EVENT_SECRET = env["TEST_ONESIGNAL_EVENT_STREAM_SECRET"]
DB = "driving-school-supabase-test-db-1"

passed, failed = [], []
def check(name, cond, detail=""):
    (passed if cond else failed).append(name)
    print(("PASS " if cond else "FAIL ") + name + (f" — {detail}" if detail and not cond else ""))

def call(fn, token=None, apikey=True, body="{}", headers=None, method="POST"):
    args = ["curl", "-sS", "-X", method, "-w", "\n%{http_code}"]
    if apikey:
        args += ["-H", f"apikey: {ANON}"]
    if token:
        args += ["-H", f"Authorization: Bearer {token}"]
    for h in (headers or []):
        args += ["-H", h]
    args += ["-H", "Content-Type: application/json", "--data", body, f"{GW}/{fn}"]
    out = subprocess.run(args, text=True, capture_output=True).stdout
    b, _, st = out.rpartition("\n")
    try:
        return json.loads(b), st
    except ValueError:
        return b, st

def signup(tag):
    email = f"fn-{tag}-{secrets.token_hex(4)}@example.invalid"
    pw = secrets.token_urlsafe(24)
    r = subprocess.run(["curl", "-sS", "-X", "POST", "-H", "Content-Type: application/json",
                        "-H", f"apikey: {ANON}", "--data", json.dumps({"email": email, "password": pw, "data": {"first_name": "FN", "last_name": tag}}),
                        "-w", "\n%{http_code}", "http://127.0.0.1:28000/auth/v1/signup"], text=True, capture_output=True)
    out, _, st = r.stdout.rpartition("\n")
    assert st == "200", f"signup {tag}: {st} {out}"
    r = subprocess.run(["curl", "-sS", "-X", "POST", "-H", "Content-Type: application/json",
                        "-H", f"apikey: {ANON}", "--data", json.dumps({"email": email, "password": pw}),
                        "-w", "\n%{http_code}", "http://127.0.0.1:28000/auth/v1/token?grant_type=password"], text=True, capture_output=True)
    return json.loads(r.stdout.rpartition("\n")[0])["access_token"]

def sql(q):
    return subprocess.run(["docker", "exec", DB, "psql", "-X", "-At", "-U", "supabase_admin", "-d", "postgres", "-c", q],
                          text=True, capture_output=True).stdout.strip()

admin = signup("admin")
student = signup("student")
admin_id = json.loads(__import__("base64").urlsafe_b64decode(admin.split(".")[1] + "=="))["sub"]
# Первый админ — только в обход триггера prevent_unauthorized_role_change
sql(f"BEGIN; SET LOCAL session_replication_role='replica'; UPDATE public.profiles SET role='admin' WHERE id='{admin_id}'; COMMIT;")
assert sql(f"SELECT role FROM public.profiles WHERE id='{admin_id}';") == "admin"

print("=== БАЗОВЫЙ ДОСТУП ===")
_, st = call("hello")
check("hello с anon apikey работает", st == "200", f"st={st}")
_, st = call("hello", apikey=False)
check("hello без apikey отклонён", st.startswith("4"), f"st={st}")

print("=== JWT-АВТОРИЗАЦИЯ ФУНКЦИЙ ===")
_, st = call("send-theory-assignment")
check("send-theory-assignment без JWT -> 401", st == "401", f"st={st}")
data, st = call("send-theory-assignment", token=student, body=json.dumps({"assessmentId": secrets.token_hex(16)}))
check("send-theory-assignment учеником -> 403", st == "403", f"st={st} {data}")
data, st = call("send-theory-assignment", token=admin, body=json.dumps({"assessmentId": "00000000-0000-0000-0000-000000000000"}))
check("send-theory-assignment админом проходит роль (400 несуществующего назначения)", st == "400", f"st={st} {data}")

_, st = call("send-push-notification")
check("send-push-notification без JWT -> 401", st == "401", f"st={st}")
_, st = call("send-driving-events")
check("send-driving-events без JWT -> 401", f"st={st}" if False else st == "401", f"st={st}")
_, st = call("send-instructor-chat-task")
check("send-instructor-chat-task без JWT -> 401", st == "401", f"st={st}")

print("=== СЕКРЕТНЫЕ ЭНДПОИНТЫ ===")
_, st = call("send-driving-reminders")
check("send-driving-reminders без секрета -> 401", st == "401", f"st={st}")
data, st = call("send-driving-reminders", headers=[f"X-Reminder-Secret: {REMINDER_SECRET}"])
check("send-driving-reminders с секретом выполняет логику", st == "200", f"st={st} {str(data)[:120]}")
_, st = call("onesignal-event-stream", headers=[f"X-Webhook-Secret: wrong"])
check("onesignal-event-stream с неверным секретом -> 401", st == "401", f"st={st}")
_, st = call("onesignal-event-stream", headers=[f"X-Webhook-Secret: {EVENT_SECRET}"], body=json.dumps({"event_kind": "test", "event_id": str(__import__("uuid").uuid4()), "message_id": str(__import__("uuid").uuid4())}))
check("onesignal-event-stream с секретом и полями принят", st in ("200", "202"), f"st={st}")

print(f"=== ИТОГ: {len(passed)} passed, {len(failed)} failed ===")
for f_ in failed: print("  FAILED:", f_)
exit(1 if failed else 0)
PY
