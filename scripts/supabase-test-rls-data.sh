#!/usr/bin/env bash
# Extended RLS regression test on the TEST stack: lessons, finances, documents,
# messages, driving slots, instructor reviews. Creates throwaway users and
# per-run fixtures; never touches production containers.
set -Eeuo pipefail
umask 077
if (( $# )); then echo "Arguments forbidden" >&2; exit 2; fi
docker inspect driving-school-supabase-test-db-1 --format '{{.State.Running}}' 2>/dev/null | grep -q true \
  || { echo 'Test stack is not running' >&2; exit 1; }
command -v python3 >/dev/null || { echo 'python3 required' >&2; exit 1; }

python3 <<'PY'
import base64
import json
import secrets
import subprocess

AUTH = "http://127.0.0.1:19999"
REST = "http://127.0.0.1:18080"
DB = "driving-school-supabase-test-db-1"
ENVFILE = "/opt/driving-school-supabase-test/.env"

env = dict(l.strip().split("=", 1) for l in open(ENVFILE) if "=" in l and not l.startswith("#"))
ANON = env["TEST_ANON_KEY"]

passed, failed = [], []
def check(name, cond, detail=""):
    (passed if cond else failed).append(name)
    print(("PASS " if cond else "FAIL ") + name + (f" — {detail}" if detail and not cond else ""))

def auth(path, body):
    r = subprocess.run(["curl", "-sS", "-X", "POST", "-H", "Content-Type: application/json",
                        "--data", json.dumps(body), "-w", "\n%{http_code}", AUTH + path],
                       text=True, capture_output=True)
    out, _, st = r.stdout.rpartition("\n")
    try: return json.loads(out), st
    except ValueError: return out, st

def rest(method, path, token, body=None, prefer="return=representation"):
    args = ["curl", "-sS", "-X", method, "-H", f"apikey: {ANON}",
            "-H", f"Authorization: Bearer {token}", "-H", f"Prefer: {prefer}",
            "-w", "\n%{http_code}"]
    if body is not None:
        args += ["-H", "Content-Type: application/json", "--data", json.dumps(body)]
    args.append(REST + path)
    r = subprocess.run(args, text=True, capture_output=True)
    out, _, st = r.stdout.rpartition("\n")
    try: return json.loads(out), st
    except ValueError: return out, st

def sql(query):
    return subprocess.check_output(["docker", "exec", DB, "psql", "-X", "-At",
                                    "-U", "supabase_admin", "-d", "postgres", "-c", query], text=True).strip()

def signup(email):
    pw = secrets.token_urlsafe(24)
    _, st = auth("/signup", {"email": email, "password": pw, "data": {"full_name": "Data RLS"}})
    assert st == "200", f"signup {email}: {st}"
    data, st = auth("/token?grant_type=password", {"email": email, "password": pw})
    assert st == "200", f"login {email}: {st}"
    return data["access_token"], data["user"]["id"]

suffix = secrets.token_hex(4)
tokens, uids = {}, {}
for name, prefix in [("admin", "d-admin"), ("instructor", "d-instr"), ("s1", "d-s1"), ("s2", "d-s2")]:
    tokens[name], uids[name] = signup(f"{prefix}-{suffix}@example.invalid")

# Фикстуры: роли + данные. Обход триггеров/RLS для чистых фикстур.
fixture_sql = f"""
BEGIN;
SET LOCAL session_replication_role = 'replica';
UPDATE public.profiles SET role='admin' WHERE id='{uids['admin']}';
UPDATE public.profiles SET role='instructor' WHERE id='{uids['instructor']}';
INSERT INTO public.instructor_students (instructor_id, student_id)
VALUES ('{uids['instructor']}','{uids['s1']}') ON CONFLICT DO NOTHING;
-- занятия: s1 теория + завершённая практика, s2 теория
INSERT INTO public.lessons (student_id, instructor_id, type, start_at, duration_minutes, status)
VALUES ('{uids['s1']}','{uids['instructor']}','theory', now()+interval '2 days', 90, 'scheduled'),
       ('{uids['s1']}','{uids['instructor']}','practice', now()-interval '1 day', 120, 'completed'),
       ('{uids['s2']}','{uids['instructor']}','theory', now()+interval '2 days', 90, 'scheduled');
-- финансы
INSERT INTO public.student_finances (student_id, contract_amount, payment_due_date)
VALUES ('{uids['s1']}', 50000, now()+interval '30 days'),
       ('{uids['s2']}', 75000, now()+interval '30 days');
-- документы
INSERT INTO public.student_documents (student_id, passport_series, passport_number, snils_number)
VALUES ('{uids['s1']}', 'DS{suffix.upper()}', '123456', '123-456-789 01'),
       ('{uids['s2']}', 'DS{suffix.upper()}', '654321', '987-654-321 09');
-- сообщение s1 от admin
INSERT INTO public.message_threads (id, subject, created_by, is_group)
VALUES (gen_random_uuid(), 'Документы {suffix}', '{uids['admin']}', false);
INSERT INTO public.messages (thread_id, sender_id, body, message_type)
SELECT t.id, '{uids['admin']}', 'Проверьте документы', 'message' FROM public.message_threads t WHERE t.subject='Документы {suffix}';
INSERT INTO public.message_recipients (message_id, recipient_id)
SELECT m.id, '{uids['s1']}' FROM public.messages m JOIN public.message_threads t ON t.id=m.thread_id WHERE t.subject='Документы {suffix}';
INSERT INTO public.message_thread_participants (thread_id, user_id)
SELECT t.id, '{uids['s1']}' FROM public.message_threads t WHERE t.subject='Документы {suffix}';
-- слоты вождения: открытый + занятый s1
INSERT INTO public.driving_slots (instructor_id, student_id, start_at, duration_minutes, status)
VALUES ('{uids['instructor']}', NULL, now()+interval '2 days', 120, 'open'),
       ('{uids['instructor']}', '{uids['s1']}', now()+interval '3 days', 120, 'booked');
COMMIT;
"""
subprocess.run(["docker", "exec", "-i", DB, "psql", "-X", "-v", "ON_ERROR_STOP=1",
                "-U", "supabase_admin", "-d", "postgres"], input=fixture_sql, text=True, check=True,
               stdout=subprocess.DEVNULL)

lid = lambda who: sql(f"SELECT id FROM public.lessons WHERE student_id='{uids[who]}' ORDER BY start_at LIMIT 1;")
l1, l2 = lid("s1"), lid("s2")
f1 = sql(f"SELECT id FROM public.student_finances WHERE student_id='{uids['s1']}';")
f2 = sql(f"SELECT id FROM public.student_finances WHERE student_id='{uids['s2']}';")
slot_open = sql("SELECT id FROM public.driving_slots WHERE status='open' ORDER BY created_at DESC LIMIT 1;")
slot_s1 = sql(f"SELECT id FROM public.driving_slots WHERE student_id='{uids['s1']}' AND status='booked' ORDER BY created_at DESC LIMIT 1;")
msg_thread = sql(f"SELECT id FROM public.message_threads WHERE subject='Документы {suffix}';")

print("=== ЗАНЯТИЯ (lessons) ===")
data, st = rest("GET", "/lessons?select=id", tokens["s1"])
check("ученик читает СВОИ занятия (2 шт.)", st == "200" and len(data) == 2, f"rows={len(data) if isinstance(data,list) else data}")
data, st = rest("GET", f"/lessons?id=eq.{l2}", tokens["s1"])
check("ученик НЕ видит чужое занятие", st == "200" and data == [])
data, st = rest("GET", f"/lessons?id=eq.{l1}", tokens["instructor"])
check("инструктор читает своё занятие", st == "200" and len(data) == 1)
data, st = rest("PATCH", f"/lessons?id=eq.{l1}", tokens["s1"], {"comment": "взлом"}, "return=minimal")
check("ученик НЕ правит занятие (нет UPDATE-политики)", not (st == "200" and sql(f"SELECT comment FROM public.lessons WHERE id='{l1}';") == "взлом"), f"st={st}")

print("=== ФИНАНСЫ (student_finances) ===")
data, st = rest("GET", "/student_finances?select=id", tokens["s1"])
check("ученик читает СВОИ финансы", st == "200" and len(data) == 1)
data, st = rest("GET", f"/student_finances?id=eq.{f2}", tokens["s1"])
check("ученик НЕ видит чужие финансы", st == "200" and data == [])
before = sql("SELECT count(*) FROM public.student_finances;")
data, st = rest("POST", "/student_finances", tokens["s1"], {"student_id": uids["s1"], "contract_amount": 1})
check("ученик НЕ создаёт финансовую запись", sql("SELECT count(*) FROM public.student_finances;") == before, f"st={st}")

print("=== ДОКУМЕНТЫ (student_documents) ===")
data, st = rest("GET", f"/student_documents?select=student_id&passport_series=eq.DS{suffix.upper()}", tokens["admin"])
check("админ читает документы (2 шт.)", st == "200" and len(data) == 2, f"rows={len(data) if isinstance(data,list) else data}")
data, st = rest("GET", f"/student_documents?student_id=eq.{uids['s1']}", tokens["s1"])
check("ученик НЕ читает документы (политик нет — только админ)", st == "200" and data == [], f"st={st} data={str(data)[:100]}")
data, st = rest("POST", "/student_documents", tokens["s1"], {"student_id": uids["s1"], "passport_number": "000001"})
check("ученик НЕ создаёт документ", sql(f"SELECT count(*) FROM public.student_documents WHERE passport_number='000001';") == "0", f"st={st}")

print("=== СООБЩЕНИЯ (messages) ===")
data, st = rest("GET", "/messages?select=id", tokens["s1"])
check("получатель читает СВОИ сообщения", st == "200" and len(data) == 1, f"rows={len(data) if isinstance(data,list) else data}")
data, st = rest("GET", "/messages?select=id", tokens["s2"])
check("сторонний ученик НЕ видит сообщения", st == "200" and data == [])
data, st = rest("GET", f"/message_threads?id=eq.{msg_thread}", tokens["s1"])
check("получатель видит свой тред", st == "200" and len(data) == 1)
data, st = rest("GET", f"/message_threads?id=eq.{msg_thread}", tokens["s2"])
check("сторонний ученик НЕ видит тред", st == "200" and data == [])
before = sql("SELECT count(*) FROM public.messages;")
data, st = rest("POST", "/messages", tokens["s1"], {"thread_id": msg_thread, "sender_id": uids["s1"], "body": "hack"})
check("ученик НЕ пишет напрямую в messages (только RPC)", sql("SELECT count(*) FROM public.messages;") == before, f"st={st}")

print("=== СЛОТЫ ВОЖДЕНИЯ (driving_slots) ===")
data, st = rest("GET", "/driving_slots?select=id", tokens["s2"])
check("authenticated читает расписание слотов", st == "200" and len(data) >= 2)
data, st = rest("PATCH", f"/driving_slots?id=eq.{slot_open}", tokens["s2"], {"student_id": uids["s2"], "status": "booked"}, "return=representation")
check("ученик бронирует открытый слот", st == "200" and data[0]["student_id"] == uids["s2"], f"st={st}")
slot_s2 = sql(f"SELECT id FROM public.driving_slots WHERE student_id='{uids['s2']}' AND status='booked' ORDER BY created_at DESC LIMIT 1;")
data, st = rest("PATCH", f"/driving_slots?id=eq.{slot_s2}", tokens["s1"], {"student_id": None, "status": "open"}, "return=representation")
check("другой ученик НЕ снимает чужую бронь", sql(f"SELECT status FROM public.driving_slots WHERE id='{slot_s2}';") == "booked", f"st={st}")
data, st = rest("PATCH", f"/driving_slots?id=eq.{slot_s2}", tokens["s2"], {"student_id": None, "status": "open"}, "return=minimal")
check("ученик снимает СВОЮ будущую бронь", st in ("200", "204") and sql(f"SELECT status FROM public.driving_slots WHERE id='{slot_s2}';") == "open", f"st={st}")
data, st = rest("PATCH", f"/driving_slots?id=eq.{slot_s1}", tokens["s1"], {"student_id": None, "status": "open"}, "return=minimal")
check("ученик снимает свою бронь (2-й слот)", st in ("200", "204") and sql(f"SELECT status FROM public.driving_slots WHERE id='{slot_s1}';") == "open", f"st={st}")

print("=== ОТЗЫВЫ (instructor_reviews) ===")
data, st = rest("POST", "/instructor_reviews", tokens["s1"],
                {"instructor_id": uids["instructor"], "student_id": uids["s1"], "rating": 5, "text": "Отлично"})
check("ученик с завершённой практикой оставляет отзыв", st == "201", f"st={st} {str(data)[:120]}")
data, st = rest("POST", "/instructor_reviews", tokens["s2"],
                {"instructor_id": uids["instructor"], "student_id": uids["s2"], "rating": 5, "text": "фейк"})
check("ученик без практики НЕ оставляет отзыв", sql(f"SELECT count(*) FROM public.instructor_reviews WHERE student_id='{uids['s2']}';") == "0", f"st={st}")

print(f"=== ИТОГ: {len(passed)} passed, {len(failed)} failed ===")
for f_ in failed: print("  FAILED:", f_)
exit(1 if failed else 0)
PY
