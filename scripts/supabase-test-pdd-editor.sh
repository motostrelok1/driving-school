#!/usr/bin/env bash
# Редактор контента PDD-курса на тестовом стеке (этап 5.17):
# черновик -> автоматические ревизии -> публикация -> чтение учеником ->
# откат к ревизии -> прогресс чтения. Storage-бакет pdd-course-media
# покрыт отдельным storage-тестом (19/19).
set -Eeuo pipefail
umask 077
if (( $# )); then echo "Arguments forbidden" >&2; exit 2; fi
command -v python3 >/dev/null || { echo 'python3 required' >&2; exit 1; }

python3 <<'PY'
import base64
import json
import secrets
import subprocess

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
    args = ["curl", "-sS", "-X", method, "-w", "\n%{http_code}", "-H", f"apikey: {ANON}"]
    if token:
        args += ["-H", f"Authorization: Bearer {token}"]
    for h in (extra or []):
        args += ["-H", h]
    if body is not None:
        args += ["-H", "Content-Type: application/json", "--data", json.dumps(body, ensure_ascii=False)]
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
    email = f"pdd-{tag}-{secrets.token_hex(4)}@example.invalid"
    pw = secrets.token_urlsafe(24)
    _, st = http("POST", f"{GWAUTH}/signup", body={"email": email, "password": pw,
                 "data": {"first_name": "PDD", "last_name": tag}})
    assert st == "200", f"signup {tag}: {st}"
    data, st = http("POST", f"{GWAUTH}/token?grant_type=password",
                    body={"email": email, "password": pw})
    assert st == "200", f"login {tag}: {st}"
    return data["access_token"]

def uid(token):
    return json.loads(base64.urlsafe_b64decode(token.split(".")[1] + "=="))["sub"]

def sql(q):
    r = subprocess.run(["docker", "exec", DB, "psql", "-X", "-At", "-U", "supabase_admin",
                        "-d", "postgres", "-c", q], text=True, capture_output=True)
    if r.returncode:
        raise RuntimeError("SQL failed: " + r.stderr.strip() + " | Query: " + q[:120])
    return r.stdout.strip()

print("=== SETUP ===")
admin = signup("admin")
student = signup("student")
admin_id, student_id = uid(admin), uid(student)
sql(f"BEGIN; SET LOCAL session_replication_role='replica'; UPDATE public.profiles SET role='admin' WHERE id='{admin_id}'; COMMIT;")
section = "s1"
# Изоляция от предыдущих прогонов (порядок с учётом FK; REST-delete политик у этих таблиц нет).
sql(f"DELETE FROM public.pdd_section_read_progress WHERE section_id='{section}';"
    f"DELETE FROM public.pdd_course_publications WHERE section_id='{section}';"
    f"DELETE FROM public.pdd_course_published_revisions WHERE section_id='{section}';"
    f"DELETE FROM public.pdd_course_draft_revisions WHERE section_id='{section}';"
    f"DELETE FROM public.pdd_course_drafts WHERE section_id='{section}';"
    f"DELETE FROM public.pdd_course_catalog WHERE section_id='{section}';")

print("=== ЧЕРНОВИК И РЕВИЗИИ ===")
blocks_v1 = [{"type": "h2", "text": "Общие положения"}, {"type": "p", "text": "Первая версия параграфа."}]
data, st = http("POST", f"{GWREST}/pdd_course_drafts", token=admin,
                body={"section_id": section, "blocks": blocks_v1, "updated_by": admin_id},
                extra=["Prefer:", "return=representation"])
check("админ сохраняет черновик", st in ("200", "201"), f"st={st} {data}")
data, st = http("POST", f"{GWREST}/pdd_course_drafts", token=student,
                body={"section_id": section, "blocks": blocks_v1})
check("ученик не пишет черновики", st.startswith("4"), f"st={st}")
check("ревизия v1 записана триггером",
      sql(f"SELECT count(*) FROM public.pdd_course_draft_revisions WHERE section_id='{section}' AND saved_by='{admin_id}';") == "1")
blocks_v2 = blocks_v1 + [{"type": "quote", "text": "Вторая версия."}]
data, st = http("GET", f"{GWREST}/pdd_course_drafts?section_id=eq.{section}&select=blocks", token=student)
check("ученик черновики не читает", st == "200" and data == [], f"st={st} {data}")

print("=== КАТАЛОГ И ПУБЛИКАЦИЯ ===")
data, st = http("POST", f"{GWREST}/pdd_course_catalog", token=admin,
                body={"section_id": section, "title": "Билет 1", "sort_order": 1})
check("админ добавляет раздел в каталог", st in ("200", "201", "409"), f"st={st} {data}")

# Публикация v1
data, st = rpc(admin, "publish_pdd_course_section", {"p_section_id": section})
check("публикация v1", st == "200" and isinstance(data, int), f"st={st} {data}")
pub_v1 = sql(f"SELECT revision_id FROM public.pdd_course_publications WHERE section_id='{section}';")
# Черновик v2 (после снапшота v1) и публикация v2
data, st = http("PATCH", f"{GWREST}/pdd_course_drafts?section_id=eq.{section}", token=admin,
                body={"blocks": blocks_v2, "updated_by": admin_id}, extra=["Prefer:", "return=representation"])
check("админ обновляет черновик до v2", st in ("200", "204"), f"st={st} {data}")
check("сохранений черновика два",
      sql(f"SELECT count(*) FROM public.pdd_course_draft_revisions WHERE section_id='{section}' AND change_kind='save';") == "2")
data, st = rpc(admin, "publish_pdd_course_section", {"p_section_id": section})
check("публикация v2", st == "200" and isinstance(data, int), f"st={st} {data}")
data, st = rpc(student, "publish_pdd_course_section", {"p_section_id": section})
check("ученик не публикует", st.startswith("4"), f"st={st}")
check("снапшотов опубликовано два",
      sql(f"SELECT count(*) FROM public.pdd_course_published_revisions WHERE section_id='{section}';") == "2")

print("=== ЧТЕНИЕ УЧЕНИКОМ ===")
data, st = rpc(student, "get_student_pdd_course", {})
payload = json.dumps(data, ensure_ascii=False) if not isinstance(data, str) else data
ok_course = st == "200" and "Вторая версия" in payload
check("ученик читает опубликованный курс (v2)", ok_course, f"st={st} {str(data)[:160]}")

print("=== ОТКАТ ===")
data, st = rpc(admin, "rollback_pdd_course_section", {"p_section_id": section, "p_revision_id": int(pub_v1)})
check("откат к опубликованному снапшоту v1", st == "200" and isinstance(data, int), f"st={st} {data}")
check("снапшот отката добавлен",
      sql(f"SELECT count(*) FROM public.pdd_course_published_revisions WHERE section_id='{section}';") == "3")
data, st = rpc(student, "get_student_pdd_course", {})
payload = json.dumps(data, ensure_ascii=False) if not isinstance(data, str) else data
ok_course = st == "200" and "Первая версия параграфа" in payload and "Вторая версия" not in payload
check("курс отражает откат", ok_course, f"st={st} {str(data)[:200]}")

print("=== ПРОГРЕСС ЧТЕНИЯ ===")
data, st = http("POST", f"{GWREST}/pdd_section_read_progress", token=student,
                body={"section_id": section, "user_id": student_id})
check("ученик отмечает прочитанное", st in ("200", "201"), f"st={st} {data}")
check("прогресс записан в БД",
      sql(f"SELECT count(*) FROM public.pdd_section_read_progress WHERE section_id='{section}' AND user_id='{student_id}';") == "1")
data, st = http("GET", f"{GWREST}/pdd_section_read_progress?section_id=eq.{section}&select=user_id", token=admin)
check("админ через REST прогресс не видит (RLS own-only)", st == "200" and data == [], f"st={st} {data}")
data, st = http("GET", f"{GWREST}/pdd_section_read_progress?section_id=eq.{section}", token=student)
check("ученик читает свой прогресс", st == "200", f"st={st}")
other_student = signup("other")
data, st = http("GET", f"{GWREST}/pdd_section_read_progress?section_id=eq.{section}", token=other_student)
check("чужой прогресс не читается", st == "200" and data == [], f"st={st} {data}")

print()
print(f"ИТОГ: {len(passed)} PASS, {len(failed)} FAIL")
if failed:
    print("Провалы:", *failed, sep="\n  - ")
    raise SystemExit(1)
PY
