#!/usr/bin/env bash
# Полный цикл теории на тестовом стеке после догонки схемы:
# банк вопросов -> назначение админом -> send-theory-assignment ->
# запись уведомления в messages/message_recipients. OneSignal — заглушки.
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
import uuid
from datetime import datetime, timedelta, timezone

GWFN = "http://127.0.0.1:28000/functions/v1"
GWREST = "http://127.0.0.1:28000/rest/v1"
GWAUTH = "http://127.0.0.1:28000/auth/v1"
ENVFILE = "/opt/driving-school-supabase-test/.env"
env = dict(l.strip().split("=", 1) for l in open(ENVFILE) if "=" in l and not l.startswith("#"))
ANON = env["TEST_ANON_KEY"]
DB = "driving-school-supabase-test-db-1"

passed, failed = [], []
def check(name, cond, detail=""):
    (passed if cond else failed).append(name)
    print(("PASS " if cond else "FAIL ") + name + (f" — {detail}" if detail and not cond else ""))

def curl_json(url, token=None, body=None, apikey=True):
    args = ["curl", "-sS", "-X", "POST", "-w", "\n%{http_code}"]
    if apikey:
        args += ["-H", f"apikey: {ANON}"]
    if token:
        args += ["-H", f"Authorization: Bearer {token}"]
    args += ["-H", "Content-Type: application/json"]
    if body is not None:
        args += ["--data", json.dumps(body)]
    args.append(url)
    out = subprocess.run(args, text=True, capture_output=True).stdout
    b, _, st = out.rpartition("\n")
    try:
        return json.loads(b), st
    except ValueError:
        return b, st

def rpc(token, fn, args):
    return curl_json(f"{GWREST}/rpc/{fn}", token=token, body=args)

def signup(tag):
    email = f"th-{tag}-{secrets.token_hex(4)}@example.invalid"
    pw = secrets.token_urlsafe(24)
    _, st = curl_json(f"{GWAUTH}/signup", body={"email": email, "password": pw,
                        "data": {"first_name": "TH", "last_name": tag}})
    assert st == "200", f"signup {tag}: {st}"
    data, st = curl_json(f"{GWAUTH}/token?grant_type=password",
                         body={"email": email, "password": pw})
    assert st == "200", f"login {tag}: {st}"
    return data["access_token"]

def uid(token):
    import base64
    return json.loads(base64.urlsafe_b64decode(token.split(".")[1] + "=="))["sub"]

def sql(q):
    return subprocess.run(["docker", "exec", DB, "psql", "-X", "-At", "-U", "supabase_admin",
                           "-d", "postgres", "-c", q], text=True, capture_output=True).stdout.strip()

admin = signup("admin")
student = signup("student")
admin_id = uid(admin)
student_id = uid(student)
sql(f"BEGIN; SET LOCAL session_replication_role='replica'; UPDATE public.profiles SET role='admin' WHERE id='{admin_id}'; COMMIT;")
check("админ продвинут", sql(f"SELECT role FROM public.profiles WHERE id='{admin_id}';") == "admin")
check("ученик с ролью student", sql(f"SELECT role FROM public.profiles WHERE id='{student_id}';") == "student")

print("=== БАНК ВОПРОСОВ (0035) ===")
questions = [{
    "ticketNumber": 1, "number": i, "text": f"Вопрос {i}?", "image": "",
    "answers": [{"number": n, "text": f"Ответ {n}"} for n in (1, 2, 3)],
    "correctAnswer": 1,
} for i in (1, 2)]
data, st = rpc(admin, "admin_import_theory_questions", {"p_questions": questions})
check("импорт банка админом", st == "200" and data.get("total") == 2, f"st={st} {data}")
data, st = rpc(student, "admin_import_theory_questions", {"p_questions": questions})
check("импорт банка учеником запрещён", st.startswith("4") or st.startswith("5"), f"st={st}")
check("банк содержит вопросы", sql("SELECT count(*) FROM public.theory_question_bank;") == "2")

print("=== НАЗНАЧЕНИЕ (0034) ===")
now = datetime.now(timezone.utc)
assessment_id = str(uuid.uuid4())
args = {
    "p_id": assessment_id, "p_student_id": student_id, "p_kind": "internal_exam",
    "p_topic_ids": [], "p_question_count": 20, "p_time_limit_minutes": 20,
    "p_max_errors": 2,
    "p_opens_at": (now - timedelta(minutes=1)).isoformat(),
    "p_deadline_at": (now + timedelta(days=2)).isoformat(),
}
data, st = rpc(admin, "admin_assign_theory_assessment", args)
check("назначение админом", st == "200" and data.get("id") == assessment_id, f"st={st} {data}")
data, st = rpc(student, "admin_assign_theory_assessment", args)
check("назначение учеником запрещено", st.startswith("4"), f"st={st}")
check("уведомление ещё не отправлено",
      sql(f"SELECT notification_sent_at IS NULL FROM public.theory_assessments WHERE id='{assessment_id}';") == "t")

print("=== SEND-THEORY-ASSIGNMENT (edge) ===")
# Безопасный тестовый режим: OneSignal-ключи — заглушки, реальные пуши исключены.
# Ожидаемый контракт: история сохраняется, delivery_status='error', повтор возможен.
data, st = curl_json(f"{GWFN}/send-theory-assignment", token=student,
                     body={"assessmentId": assessment_id})
check("ученик получает 403", st == "403", f"st={st} {data}")
data, st = curl_json(f"{GWFN}/send-theory-assignment", token=admin,
                     body={"assessmentId": assessment_id})
check("безопасный режим: история сохранена, push отклонён заглушкой",
      st == "500" and "Push не отправлен" in data.get("error", ""), f"st={st} {data}")
data, st = curl_json(f"{GWFN}/send-theory-assignment", token=admin,
                     body={"assessmentId": assessment_id})
check("повторная отправка возможна (claim освобождён)",
      st == "500" and "Push не отправлен" in data.get("error", ""), f"st={st} {data}")

print("=== ПОБОЧНЫЕ ЭФФЕКТЫ В БД ===")
check("notification_sent_at НЕ проставлен (push не дошёл)",
      sql(f"SELECT notification_sent_at IS NULL FROM public.theory_assessments WHERE id='{assessment_id}';") == "t")
check("claim освобождён после неудачи",
      sql(f"SELECT notification_claimed_at IS NULL FROM public.theory_assessments WHERE id='{assessment_id}';") == "t")
check("тред уведомления создан",
      sql(f"SELECT count(*) FROM public.message_threads WHERE id='{assessment_id}';") == "1")
check("сообщение уведомления создано",
      sql(f"SELECT count(*) FROM public.messages WHERE id='{assessment_id}' AND message_type='notification';") == "1")
check("получатель — ученик",
      sql(f"SELECT count(*) FROM public.message_recipients WHERE message_id='{assessment_id}' AND recipient_id='{student_id}';") == "1")
body = sql(f"SELECT body FROM public.messages WHERE id='{assessment_id}';")
check("текст уведомления про внутренний экзамен", "Внутренний экзамен" in body and "20 вопросов" in body, body[:120])

print()
print(f"ИТОГ: {len(passed)} PASS, {len(failed)} FAIL")
if failed:
    print("Провалы:", *failed, sep="\n  - ")
    raise SystemExit(1)
PY
