#!/usr/bin/env bash
# Storage access regression test on the TEST stack through the API gateway:
# buckets, upload, public/private reads, deletes, CORS preflight.
# 
# per-run throwaway users; never touches production containers.
set -Eeuo pipefail
umask 077
if (( $# )); then echo "Arguments forbidden" >&2; exit 2; fi
docker inspect driving-school-supabase-test-db-1 --format '{{.State.Running}}' 2>/dev/null | grep -q true \
  || { echo 'Test stack is not running' >&2; exit 1; }
command -v python3 >/dev/null || { echo 'python3 required' >&2; exit 1; }

python3 <<'PY'
import json
import secrets
import subprocess

GW = "http://127.0.0.1:28000"
ENVFILE = "/opt/driving-school-supabase-test/.env"
env = dict(l.strip().split("=", 1) for l in open(ENVFILE) if "=" in l and not l.startswith("#"))
ANON = env["TEST_ANON_KEY"]
DB = "driving-school-supabase-test-db-1"

PNG = bytes.fromhex(
    "89504e470d0a1a0a0000000d494844520000000100000001080600000"
    "01f15c4890000000d4944415478da63fcffff3f030005fe02fea735814"
    "d0000000049454e44ae426082"
)

passed, failed = [], []
def check(name, cond, detail=""):
    (passed if cond else failed).append(name)
    print(("PASS " if cond else "FAIL ") + name + (f" — {detail}" if detail and not cond else ""))

def auth(path, body):
    r = subprocess.run(["curl", "-sS", "-X", "POST", "-H", "Content-Type: application/json",
                        "--data", json.dumps(body), "-w", "\n%{http_code}", GW + "/auth/v1" + path],
                       text=True, capture_output=True)
    out, _, st = r.stdout.rpartition("\n")
    try: return json.loads(out), st
    except ValueError: return out, st

def storage(method, path, token=None, data=None, extra=None):
    args = ["curl", "-sS", "-X", method, "-H", f"apikey: {ANON}", "-w", "\n%{http_code}"]
    if token:
        args += ["-H", f"Authorization: Bearer {token}"]
    if data is not None:
        args += ["-H", "Content-Type: image/png", "--data-binary", "@-"]
    if extra:
        args += extra
    args.append(GW + "/storage/v1" + path)
    r = subprocess.run(args, input=data, text=False, capture_output=True)
    out = r.stdout.decode(errors="replace")
    body, _, st = out.rpartition("\n")
    return body, st

def signup(email):
    pw = secrets.token_urlsafe(24)
    _, st = auth("/signup", {"email": email, "password": pw})
    assert st == "200", f"signup {email}: {st}"
    data, st = auth("/token?grant_type=password", {"email": email, "password": pw})
    assert st == "200"
    return data["access_token"]

suffix = secrets.token_hex(4)
tokA = signup(f"st-a-{suffix}@example.invalid")
tokB = signup(f"st-b-{suffix}@example.invalid")
pub_obj = f"avatars/{suffix}/photo.png"
priv_obj = f"student-documents/{suffix}/passport.png"

print("=== ЗАГРУЗКА ===")
_, st = storage("POST", f"/object/{pub_obj}", tokA, PNG)
check("ученик A загружает в публичный бакет", st in ("200", "201"), f"st={st}")
_, st = storage("POST", f"/object/{priv_obj}", tokA, PNG)
check("ученик A загружает в приватный бакет", st in ("200", "201"), f"st={st}")
_, st = storage("POST", f"/object/avatars/{suffix}/anon.png", None, PNG)
check("аноним НЕ загружает", st.startswith("4"), f"st={st}")

print("=== ЧТЕНИЕ ===")
body, st = storage("GET", f"/object/public/{pub_obj}")
check("аноним читает публичный объект", st == "200" and len(body) > 0, f"st={st}")
_, st = storage("GET", f"/object/public/{pub_obj}", tokB)
check("ученик B читает публичный объект", st == "200", f"st={st}")
_, st = storage("GET", f"/object/authenticated/{priv_obj}", tokA)
check("владелец читает свой приватный объект", st == "200", f"st={st}")
_, st = storage("GET", f"/object/authenticated/{priv_obj}", tokB)
check("ученик B НЕ читает чужой приватный объект", st.startswith("4"), f"st={st}")
_, st = storage("GET", f"/object/authenticated/{priv_obj}")
check("аноним НЕ читает приватный объект", st.startswith("4"), f"st={st}")

print("=== УДАЛЕНИЕ ===")
_, st = storage("DELETE", f"/object/{priv_obj}", tokB)
check("ученик B НЕ удаляет чужой объект", sql := subprocess.run(["docker","exec",DB,"psql","-X","-At","-U","supabase_admin","-d","postgres","-c",f"SELECT count(*) FROM storage.objects WHERE name='{suffix}/passport.png';"],text=True,capture_output=True).stdout.strip() == "1", f"st={st}")
_, st = storage("DELETE", f"/object/{priv_obj}", tokA)
check("владелец удаляет свой приватный объект", st in ("200", "204"), f"st={st}")
_, st = storage("DELETE", f"/object/{pub_obj}", tokB)
check("ученик B НЕ удаляет чужой публичный объект", subprocess.run(["docker","exec",DB,"psql","-X","-At","-U","supabase_admin","-d","postgres","-c",f"SELECT count(*) FROM storage.objects WHERE name='{suffix}/photo.png';"],text=True,capture_output=True).stdout.strip() == "1", f"st={st}")

print("=== CORS / ЗАГОЛОВКИ ===")
r = subprocess.run(["curl", "-sS", "-D", "-", "-o", "/dev/null", "-X", "OPTIONS",
                    "-H", "Origin: https://pwa-test.example",
                    "-H", "Access-Control-Request-Method: POST",
                    "-H", "Access-Control-Request-Headers: authorization,content-type,apikey",
                    GW + "/storage/v1/object/" + pub_obj], text=True, capture_output=True)
h = r.stdout.lower()
check("preflight отвечает access-control-allow-origin", "access-control-allow-origin" in h, r.stdout[:200])
check("preflight разрешает authorization/apikey", "authorization" in h and "apikey" in h, r.stdout[:300])

print(f"=== ИТОГ: {len(passed)} passed, {len(failed)} failed ===")
for f_ in failed: print("  FAILED:", f_)
exit(1 if failed else 0)
PY
