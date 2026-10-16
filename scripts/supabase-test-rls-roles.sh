#!/usr/bin/env bash
# Regression test of RLS role separation on the TEST stack.
# Creates 4 throwaway users (admin/instructor/2 students) per run, promotes
# roles like the admin workflow would, then checks reading/writing boundaries
# through PostgREST with real user JWTs. Never touches production containers.
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
    _, st = auth("/signup", {"email": email, "password": pw, "data": {"full_name": "RLS Test"}})
    assert st == "200", f"signup {email}: {st}"
    data, st = auth("/token?grant_type=password", {"email": email, "password": pw})
    assert st == "200", f"login {email}: {st}"
    return data["access_token"], data["user"]["id"]

def jwt_role(token):
    payload = token.split(".")[1]
    payload += "=" * (-len(payload) % 4)
    return json.loads(base64.urlsafe_b64decode(payload))["role"]

suffix = secrets.token_hex(4)
tokens, uids = {}, {}
for name, prefix in [("admin", "rls-admin"), ("instructor", "rls-instr"), ("s1", "rls-s1"), ("s2", "rls-s2")]:
    tokens[name], uids[name] = signup(f"{prefix}-{suffix}@example.invalid")

# Раскладка ролей. Первый админ продвигается обходом триггера
# (session_replication_role=replica, только суперпользователь): триггер
# prevent_unauthorized_role_change не пускает даже service_role,
# т.к. is_admin(null) = false. Дальше роли меняются через admin JWT (REST).
setup_sql = f"""
BEGIN;
SET LOCAL session_replication_role = 'replica';
UPDATE public.profiles SET role='admin' WHERE id='{uids['admin']}';
UPDATE public.profiles SET role='instructor' WHERE id='{uids['instructor']}';
INSERT INTO public.instructor_students (instructor_id, student_id)
VALUES ('{uids['instructor']}','{uids['s1']}') ON CONFLICT DO NOTHING;
COMMIT;
"""
subprocess.run(["docker", "exec", "-i", DB, "psql", "-X", "-v", "ON_ERROR_STOP=1",
                "-U", "supabase_admin", "-d", "postgres"], input=setup_sql, text=True, check=True)

print("=== JWT-РОЛИ ===")
check("JWT role = authenticated (admin)", jwt_role(tokens["admin"]) == "authenticated", jwt_role(tokens["admin"]))
check("JWT role = authenticated (student)", jwt_role(tokens["s1"]) == "authenticated", jwt_role(tokens["s1"]))
check("приложная роль admin в profiles", sql(f"SELECT role FROM public.profiles WHERE id='{uids['admin']}';") == "admin")
check("приложная роль instructor в profiles", sql(f"SELECT role FROM public.profiles WHERE id='{uids['instructor']}';") == "instructor")

print("=== ЧТЕНИЕ ===")
data, st = rest("GET", f"/profiles?id=eq.{uids['s1']}", tokens["s1"])
check("ученик читает свой профиль", st == "200" and len(data) == 1)
data, st = rest("GET", f"/profiles?id=eq.{uids['s2']}", tokens["s1"])
check("ученик НЕ читает чужой профиль", st == "200" and data == [], f"st={st} rows={len(data) if isinstance(data,list) else data}")
# Инструкторы намеренно видны всем authenticated (выбор инструктора учеником,
# миграция 0004_allow_read_instructors) — проверяем закрытость остальных ролей.
data, st = rest("GET", "/profiles?select=id,role&role=neq.instructor", tokens["s1"])
check("ученик видит только свой профиль среди не-инструкторов",
      st == "200" and len(data) == 1 and data[0]["id"] == uids["s1"],
      f"rows={len(data) if isinstance(data,list) else data}")
data, st = rest("GET", f"/profiles?id=eq.{uids['s2']}", tokens["instructor"])
check("инструктор НЕ читает незакреплённого ученика", st == "200" and data == [])
data, st = rest("GET", f"/profiles?id=eq.{uids['s1']}", tokens["instructor"])
check("инструктор читает СВОЕГО ученика", st == "200" and len(data) == 1)
data, st = rest("GET", "/profiles?select=id", tokens["admin"])
check("админ читает все профили", st == "200" and len(data) >= 4, f"rows={len(data) if isinstance(data,list) else data}")

print("=== ИЗМЕНЕНИЯ УЧЕНИКА ===")
data, st = rest("PATCH", f"/profiles?id=eq.{uids['s1']}", tokens["s1"], {"full_name": "Обновлённый"})
check("ученик меняет своё имя", st == "200" and data[0]["full_name"] == "Обновлённый")
data, st = rest("PATCH", f"/profiles?id=eq.{uids['s1']}", tokens["s1"], {"role": "admin"}, "return=representation")
check("ученик НЕ может назначить себе admin", (st.startswith("4") or (st == "200" and isinstance(data, list) and all(row.get("role") != "admin" for row in data))), f"st={st} data={str(data)[:120]}")
check("роль ученика в БД не изменилась", sql(f"SELECT role FROM public.profiles WHERE id='{uids['s1']}';") == "student")
data, st = rest("PATCH", f"/profiles?id=eq.{uids['s2']}", tokens["s1"], {"full_name": "Взлом"}, "return=representation")
check("ученик НЕ меняет чужой профиль", st == "200" and data == [])
check("чужой профиль в БД не изменён", sql(f"SELECT full_name FROM public.profiles WHERE id='{uids['s2']}';") == "RLS Test")

print("=== АДМИН ===")
data, st = rest("POST", "/groups", tokens["admin"], {"name": f"Группа {suffix}"})
check("админ создаёт группу", st == "201", f"st={st}")
data, st = rest("POST", "/groups", tokens["s1"], {"name": "Хакерская"})
check("ученик НЕ создаёт группу", st.startswith("4") or (st == "201" and data == []), f"st={st} data={str(data)[:120]}")
check("запрещённой группы нет в БД", sql("SELECT count(*) FROM public.groups WHERE name='Хакерская';") == "0")
data, st = rest("GET", "/groups?select=id", tokens["s1"])
check("ученик читает список групп", st == "200")
data, st = rest("PATCH", f"/profiles?id=eq.{uids['s2']}", tokens["admin"], {"role": "instructor"}, "return=representation")
check("админ меняет роль ученика", st == "200" and data[0]["role"] == "instructor")
data, st = rest("PATCH", f"/profiles?id=eq.{uids['s2']}", tokens["admin"], {"role": "student"}, "return=representation")
check("админ возвращает роль ученика", st == "200" and data[0]["role"] == "student")

print(f"=== ИТОГ: {len(passed)} passed, {len(failed)} failed ===")
for f in failed: print("  FAILED:", f)
exit(1 if failed else 0)
PY
