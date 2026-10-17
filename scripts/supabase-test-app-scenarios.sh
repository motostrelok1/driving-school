#!/usr/bin/env bash
# Сценарное тестирование приложения на тестовом стеке (этап 4.16):
# группы, расписание и бронирование, чаты с инструктором, задачи инструктора,
# смена инструктора с отзывом доступа к чату. OneSignal — заглушки.
set -Eeuo pipefail
umask 077
if (( $# )); then echo "Arguments forbidden" >&2; exit 2; fi
docker inspect driving-school-supabase-test-functions-1 --format '{{.State.Running}}' 2>/dev/null | grep -q true \
  || { echo 'Functions container is not running' >&2; exit 1; }
command -v python3 >/dev/null || { echo 'python3 required' >&2; exit 1; }

python3 <<'PY'
import base64
import json
import secrets
import subprocess
from datetime import datetime, timedelta, timezone

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

def http(method, url, token=None, body=None, extra=None):
    args = ["curl", "-sS", "-X", method, "-w", "\n%{http_code}"]
    args += ["-H", f"apikey: {ANON}"]
    if token:
        args += ["-H", f"Authorization: Bearer {token}"]
    for h in (extra or []):
        args += ["-H", h]
    if body is not None:
        args += ["-H", "Content-Type: application/json", "--data", json.dumps(body)]
    args.append(url)
    out = subprocess.run(args, text=True, capture_output=True).stdout
    b, _, st = out.rpartition("\n")
    try:
        return json.loads(b), st
    except ValueError:
        return b, st

def rpc(token, fn, args):
    return http("POST", f"{GWREST}/rpc/{fn}", token=token, body=args)

def signup(tag):
    email = f"app-{tag}-{secrets.token_hex(4)}@example.invalid"
    pw = secrets.token_urlsafe(24)
    _, st = http("POST", f"{GWAUTH}/signup", body={"email": email, "password": pw,
                 "data": {"first_name": "APP", "last_name": tag}})
    assert st == "200", f"signup {tag}: {st}"
    data, st = http("POST", f"{GWAUTH}/token?grant_type=password",
                    body={"email": email, "password": pw})
    assert st == "200", f"login {tag}: {st}"
    return data["access_token"]

def uid(token):
    return json.loads(base64.urlsafe_b64decode(token.split(".")[1] + "=="))["sub"]

def sql(q):
    return subprocess.run(["docker", "exec", DB, "psql", "-X", "-At", "-U", "supabase_admin",
                           "-d", "postgres", "-c", q], text=True, capture_output=True).stdout.strip()

def set_role(user_id, role):
    sql(f"BEGIN; SET LOCAL session_replication_role='replica'; UPDATE public.profiles SET role='{role}' WHERE id='{user_id}'; COMMIT;")

print("=== SETUP: пользователи и роли ===")
admin = signup("admin")
instr_a = signup("instructor-a")
instr_b = signup("instructor-b")
student = signup("student")
admin_id, instr_a_id, instr_b_id, student_id = uid(admin), uid(instr_a), uid(instr_b), uid(student)
set_role(admin_id, "admin")
set_role(instr_a_id, "instructor")
set_role(instr_b_id, "instructor")
sql(f"UPDATE public.profiles SET driving_enabled=true WHERE id='{student_id}';")
check("роли назначены", sql(
    f"SELECT string_agg(role, ',' ORDER BY role) FROM public.profiles WHERE id IN ('{admin_id}','{instr_a_id}','{instr_b_id}','{student_id}');"
) == "admin,instructor,instructor,student")

print("=== НАСТРОЙКИ ОБУЧЕНИЯ ВОЖДЕНИЮ ===")
# Singleton-строка создаётся при онбординге школы; RPC set_driving_training_settings только UPDATE.
sql("INSERT INTO public.driving_training_settings (id) VALUES (true) ON CONFLICT DO NOTHING;")
opts = [{"minutes": 60, "credits": 2}, {"minutes": 90, "credits": 3}, {"minutes": 120, "credits": 4}]
data, st = rpc(admin, "set_driving_training_settings", {"target_hours": 56, "target_credits": 28, "target_options": opts})
check("админ задаёт настройки вождения", st in ("200", "204"), f"st={st} {data}")
data, st = rpc(student, "set_driving_training_settings", {"target_hours": 56, "target_credits": 28, "target_options": opts})
check("ученик не может менять настройки", st.startswith("4"), f"st={st}")
data, st = rpc(admin, "set_driving_training_settings", {"target_hours": 56, "target_credits": 28,
               "target_options": [{"minutes": 50, "credits": 2}]})
check("невалидная длительность отклонена", st.startswith("4"), f"st={st}")

print("=== ГРУППЫ ===")
gname = "Группа-" + secrets.token_hex(3)
data, st = http("POST", f"{GWREST}/groups", token=admin,
                body={"name": gname, "category": "B", "start_date": "2026-10-20"},
                extra=["Prefer:", "return=representation"])
check("админ создаёт группу", st in ("200", "201"), f"st={st} {data}")
group_id = data[0]["id"] if isinstance(data, list) and data else sql(
    f"SELECT id FROM public.groups WHERE name='{gname}';")
_, st = http("PATCH", f"{GWREST}/profiles?id=eq.{student_id}", token=admin, body={"group_id": group_id})
check("админ включает ученика в группу", st in ("200", "204"), f"st={st}")
data, st = http("GET", f"{GWREST}/profiles?id=eq.{student_id}&select=group_id", token=student)
check("ученик видит свою группу", st == "200" and data[0]["group_id"] == group_id, f"st={st} {data}")
data, st = http("GET", f"{GWREST}/groups?id=eq.{group_id}", token=student)
check("ученик читает данные группы", st == "200" and data[0]["name"] == gname, f"st={st}")
data, st = rpc(admin, "delete_empty_group", {"target_group_id": group_id})
check("удаление непустой группы отклонено", st.startswith("4"), f"st={st}")
_, st = http("PATCH", f"{GWREST}/profiles?id=eq.{student_id}", token=admin, body={"group_id": None})
data, st = rpc(admin, "delete_empty_group", {"target_group_id": group_id})
check("админ удаляет пустую группу", st in ("200", "204"), f"st={st}")
check("группа удалена", sql(f"SELECT count(*) FROM public.groups WHERE id='{group_id}';") == "0")

print("=== РАСПИСАНИЕ И БРОНИРОВАНИЕ ===")
future = (datetime.now(timezone.utc) + timedelta(days=2)).strftime("%Y-%m-%dT10:00:00+00:00")
data, st = rpc(instr_a, "create_my_driving_slot", {"target_start_at": future, "target_duration_minutes": 90, "target_comment": ""})
check("слот без разрешения запрещён", st.startswith("4"), f"st={st} {data}")
_, st = rpc(admin, "set_instructor_schedule_permission", {"target_instructor_id": instr_a_id, "allow_manage": True})
check("админ даёт разрешение на расписание", st in ("200", "204"), f"st={st}")
data, st = rpc(instr_a, "create_my_driving_slot", {"target_start_at": future, "target_duration_minutes": 45, "target_comment": ""})
check("длительность вне списка отклонена", st.startswith("4"), f"st={st} {data}")
data, st = rpc(instr_a, "create_my_driving_slot", {"target_start_at": future, "target_duration_minutes": 90, "target_comment": "Тестовый слот"})
check("инструктор создаёт слот", st == "200" and data, f"st={st} {data}")
slot_id = data
data, st = http("GET", f"{GWREST}/driving_slots?id=eq.{slot_id}&select=status,student_id", token=student)
check("слот открыт и свободен", st == "200" and data[0]["status"] == "open" and data[0]["student_id"] is None, f"st={st} {data}")
_, st = http("PATCH", f"{GWREST}/driving_slots?id=eq.{slot_id}", token=student,
             body={"student_id": student_id, "status": "booked"})
check("ученик бронирует слот", st in ("200", "204"), f"st={st}")
data, st = http("GET", f"{GWREST}/driving_slots?id=eq.{slot_id}&select=status,student_id", token=instr_a)
check("инструктор видит бронь", st == "200" and data[0]["status"] == "booked" and data[0]["student_id"] == student_id, f"st={st}")
data, st = rpc(student, "get_my_driving_progress", {})
check("прогресс ученика читается", st == "200" and isinstance(data, list)
      and "credited_lessons" in data[0], f"st={st} {data}")

print("=== ЧАТ С ИНСТРУКТОРОМ (админское открытие) ===")
data, st = http("POST", f"{GWREST}/instructor_students", token=admin,
                body={"instructor_id": instr_a_id, "student_id": student_id})
check("админ закрепляет инструктора A", st in ("200", "201"), f"st={st} {data}")
task_a = sql(f"SELECT id FROM public.instructor_chat_tasks WHERE student_id='{student_id}' AND instructor_id='{instr_a_id}' AND status='pending';")
check("задача инструктора A создана триггером", len(task_a) == 36, task_a)
data, st = rpc(student, "create_admin_student_instructor_chat", {"target_student_id": student_id, "target_instructor_id": instr_a_id})
check("ученик не может открыть админский чат", st.startswith("4"), f"st={st}")
data, st = rpc(admin, "create_admin_student_instructor_chat", {"target_student_id": student_id, "target_instructor_id": instr_a_id})
check("админ открывает чат", st == "200" and data, f"st={st} {data}")
thread_id = data
data, st = rpc(admin, "complete_instructor_chat_task", {"target_task_id": task_a, "target_thread_id": thread_id})
check("админ завершает задачу", st in ("200", "204"), f"st={st} {data}")
check("задача completed", sql(f"SELECT status FROM public.instructor_chat_tasks WHERE id='{task_a}';") == "completed")

print("=== ПЕРЕПИСКА ===")
data, st = rpc(student, "send_reply", {"target_thread_id": thread_id, "reply_body": "Здравствуйте! Когда первая практика?"})
check("ученик пишет в чат", st in ("200", "204"), f"st={st} {data}")
data, st = rpc(instr_a, "send_reply", {"target_thread_id": thread_id, "reply_body": "Здравствуйте! В четверг в 10:00."})
check("инструктор отвечает", st in ("200", "204"), f"st={st} {data}")
data, st = rpc(student, "get_my_conversation_with_senders", {"target_thread_id": thread_id})
ok_conv = st == "200" and isinstance(data, list) and any("четверг" in (m.get("body") or "") for m in data)
check("ученик читает переписку с отправителями", ok_conv, f"st={st}")
data, st = rpc(instr_a, "get_my_conversation_with_senders", {"target_thread_id": thread_id})
ok_conv = st == "200" and isinstance(data, list) and any("практика" in (m.get("body") or "") for m in data)
check("инструктор читает переписку", ok_conv, f"st={st}")
data, st = rpc(instr_b, "get_my_conversation_with_senders", {"target_thread_id": thread_id})
check("сторонний инструктор чат не читает", st.startswith("4") or (st == "200" and data in ([], None)), f"st={st} {data}")

print("=== СМЕНА ИНСТРУКТОРА ===")
data, st = rpc(student, "student_begin_instructor_change", {})
check("начало смены отменяет будущую бронь", st == "200" and len(data.get("cancelled_slots", [])) == 1, f"st={st} {data}")
data, st = http("GET", f"{GWREST}/driving_slots?id=eq.{slot_id}&select=status,student_id", token=student)
check("слот снова открыт", st == "200" and data[0]["status"] == "open" and data[0]["student_id"] is None, f"st={st}")
data, st = rpc(student, "student_choose_instructor", {"target_instructor_id": instr_b_id})
check("ученик выбирает инструктора B", st == "200" and data.get("instructor_id") == instr_b_id, f"st={st} {data}")
check("закрепление за B", sql(
    f"SELECT instructor_id FROM public.instructor_students WHERE student_id='{student_id}';") == instr_b_id)
task_b = sql(f"SELECT id FROM public.instructor_chat_tasks WHERE student_id='{student_id}' AND instructor_id='{instr_b_id}' AND status='pending';")
check("задача инструктора B создана", len(task_b) == 36, task_b)
check("A удалён из участников чата", sql(
    f"SELECT count(*) FROM public.message_thread_participants WHERE thread_id='{thread_id}' AND user_id='{instr_a_id}';") == "0")
check("старый чат архивирован", sql(
    f"SELECT closed_at IS NOT NULL FROM public.message_threads WHERE id='{thread_id}';") == "t")
data, st = rpc(instr_a, "send_reply", {"target_thread_id": thread_id, "reply_body": "ещё сообщение"})
check("бывший инструктор не пишет в архив", st.startswith("4"), f"st={st} {data}")
data, st = rpc(student, "get_my_conversation_with_senders", {"target_thread_id": thread_id})
check("ученик читает архивный чат", st == "200", f"st={st}")

print("=== КАРТОЧКА УЧЕНИКА (админ) ===")
data, st = http("GET", f"{GWREST}/profiles?id=eq.{student_id}&select=id,role,full_name,group_id", token=admin)
check("админ читает карточку ученика", st == "200" and data[0]["role"] == "student", f"st={st}")
data, st = http("GET", f"{GWREST}/instructor_students?student_id=eq.{student_id}&select=instructor_id", token=admin)
check("админ видит инструктора ученика", st == "200" and data[0]["instructor_id"] == instr_b_id, f"st={st}")
data, st = http("GET", f"{GWREST}/theory_assessments?student_id=eq.{student_id}&select=id,kind", token=admin)
check("админ читает назначения теории", st == "200" and isinstance(data, list), f"st={st}")

print()
print(f"ИТОГ: {len(passed)} PASS, {len(failed)} FAIL")
if failed:
    print("Провалы:", *failed, sep="\n  - ")
    raise SystemExit(1)
PY
