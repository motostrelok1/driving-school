#!/usr/bin/env bash
# TEST ONLY — 0063 video progress policy/RPC regression. No production use.
set -Eeuo pipefail
umask 077
if (( $# )); then echo "No arguments" >&2; exit 2; fi
DB=driving-school-supabase-test-db-1
docker inspect "$DB" --format '{{.State.Running}}' 2>/dev/null | grep -qx true || { echo "TEST database not running" >&2; exit 1; }
test -f /opt/driving-school-supabase-test/.env || { echo "Missing TEST stack sentinel" >&2; exit 1; }
python3 <<'PY'
import json,secrets,subprocess,pathlib
db='driving-school-supabase-test-db-1'
env=dict(x.strip().split('=',1) for x in pathlib.Path('/opt/driving-school-supabase-test/.env').read_text().splitlines() if '=' in x and not x.startswith('#'))
base='http://127.0.0.1:28000'
anon=env['TEST_ANON_KEY']
def sql(q):
    p=subprocess.run(['docker','exec',db,'psql','-X','-At','-v','ON_ERROR_STOP=1','-U','supabase_admin','-d','postgres','-c',q],capture_output=True,text=True,check=True)
    return p.stdout.strip()
def req(path,body,token=None,method='POST'):
    args=['curl','-sS','--max-time','12','-X',method,'-H','Content-Type: application/json','-H','apikey: '+anon]
    if token: args+=['-H','Authorization: Bearer '+token]
    if body is not None: args+=['--data',json.dumps(body)]
    args+=['-w','\n%{http_code}',base+path]
    out=subprocess.run(args,text=True,capture_output=True,check=True).stdout
    body,_,status=out.rpartition('\n')
    try: body=json.loads(body)
    except ValueError: pass
    return body,int(status)
def student(tag):
    email=f'video-rls-{tag}-{secrets.token_hex(5)}@example.invalid'
    password=secrets.token_urlsafe(24)
    _,code=req('/auth/v1/signup',{'email':email,'password':password,'data':{'first_name':'Video','last_name':'Test'}})
    assert code==200,('signup',code)
    data,code=req('/auth/v1/token?grant_type=password',{'email':email,'password':password})
    assert code==200,('login',code)
    return data['access_token'],data['user']['id']
assert sql("SELECT to_regclass('public.theory_video_progress') IS NOT NULL")=='t','0063 not applied to TEST database'
assert sql("SELECT count(*) FROM pg_proc WHERE proname='get_admin_student_theory_progress'")=='1'
a,ua=student('a');b,ub=student('b')
video='6s8PiXa5EjvdJ5kf6vVVMN'
out,code=req('/rest/v1/theory_video_progress',{'user_id':ua,'video_id':video},a)
assert code in (200,201),('own insert',code,out)
out,code=req('/rest/v1/theory_video_progress?select=user_id,video_id',None,b,'GET')
assert code==200 and not any(x['user_id']==ua for x in out),('cross-user read',code,out)
out,code=req('/rest/v1/theory_video_progress',{'user_id':ua,'video_id':'invalid-video'},b)
assert code>=400,('invalid video',code,out)
out,code=req('/rest/v1/theory_video_progress',{'user_id':ua,'video_id':video},b)
assert code>=400,('cross-user write',code,out)
out,code=req('/rest/v1/rpc/get_admin_student_theory_progress',{'target_student_id':ua},b)
assert code in (401,403,400),('student admin rpc',code,out)
# Elevate only this newly generated throwaway account in the isolated TEST database.
admin,admin_id=student('admin')
sql(f"BEGIN; SET LOCAL session_replication_role='replica'; UPDATE public.profiles SET role='admin' WHERE id='{admin_id}'; COMMIT;")
out,code=req('/rest/v1/rpc/get_admin_student_theory_progress',{'target_student_id':ua},admin)
assert code==200 and isinstance(out,list) and len(out)==1,('admin aggregate',code,out)
aggregate=out[0]
assert aggregate['watched_videos']>=1 and aggregate['total_videos']==5,('admin progress values',aggregate)
out,code=req('/rest/v1/theory_video_progress?select=*',None,None,'GET')
assert code in (200,401,403) and (code!=200 or not out),('anonymous reads',code,out)
print('PASS TEST 0063: own insert, isolated read/write, invalid ID, admin RPC denied for student, aggregate for admin, anonymous read')
PY
