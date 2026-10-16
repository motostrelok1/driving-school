#!/usr/bin/env bash
# Realtime regression test on the TEST stack: WebSocket через gateway,
# доставка postgres_changes и RLS-изоляция событий между пользователями.
# Требует node >= 22 (global WebSocket). Throwaway-пользователи за прогон.
set -Eeuo pipefail
umask 077
if (( $# )); then echo "Arguments forbidden" >&2; exit 2; fi
docker inspect driving-school-supabase-test-realtime-1 --format '{{.State.Running}}' 2>/dev/null | grep -q true \
  || { echo 'Realtime container is not running' >&2; exit 1; }
command -v node >/dev/null || { echo 'node >= 22 required' >&2; exit 1; }

node --input-type=module <<'JS'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const GW = 'http://127.0.0.1:28000'
const env = Object.fromEntries(
  readFileSync('/opt/driving-school-supabase-test/.env', 'utf8')
    .split('\n').filter(l => l.includes('=')).map(l => l.split('=', 2).map(s => s.trim()))
)
const ANON = env.TEST_ANON_KEY
const DB = 'driving-school-supabase-test-db-1'
const rnd = Math.random().toString(16).slice(2, 10)

let passed = 0, failed = 0
const check = (name, cond, detail = '') => {
  cond ? passed++ : failed++
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : (detail ? ' — ' + detail : '')))
}

async function post(path, body, token) {
  const headers = { 'Content-Type': 'application/json', apikey: ANON }
  if (token) headers.Authorization = `Bearer ${token}`
  const r = await fetch(GW + '/auth/v1' + path, { method: 'POST', headers, body: JSON.stringify(body) })
  return { status: r.status, data: await r.json() }
}
async function signup(tag) {
  const email = `rt-${tag}-${rnd}@example.invalid`
  const password = Math.random().toString(36).slice(2) + 'x1'
  const s = await post('/signup', { email, password, data: { first_name: 'RT', last_name: tag } })
  if (s.status !== 200) throw new Error('signup ' + tag + ': ' + JSON.stringify(s.data))
  const t = await post('/token?grant_type=password', { email, password })
  if (t.status !== 200) throw new Error('token ' + tag)
  const jwt = t.data.access_token
  const uid = JSON.parse(Buffer.from(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()).sub
  return { jwt, uid }
}
const sql = (q) => execFileSync('docker', ['exec', DB, 'psql', '-X', '-At', '-U', 'supabase_admin', '-d', 'postgres', '-c', q], { encoding: 'utf8' }).trim()

function subscribeChannel(jwt) {
  const ws = new WebSocket(`ws://127.0.0.1:28000/realtime/v1/websocket?apikey=${ANON}&vsn=1.0.0`)
  const ch = { ws, joined: new Promise(() => {}), events: [], joinResolve: null, joinReject: null }
  ch.joined = new Promise((res, rej) => { ch.joinResolve = res; ch.joinReject = rej })
  const timer = setTimeout(() => ch.joinReject(new Error('join timeout')), 15000)
  ws.onopen = () => ws.send(JSON.stringify({
    topic: 'realtime:public:profiles',
    event: 'phx_join',
    payload: { config: { postgres_changes: [{ event: '*', schema: 'public', table: 'profiles' }] }, access_token: jwt },
    ref: '1',
  }))
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data)
    if (msg.event === 'phx_reply' && msg.payload?.status === 'ok') { clearTimeout(timer); ch.joinResolve(msg.payload.response) }
    else if (msg.event === 'postgres_changes') ch.events.push(msg.payload.data)
    else if (msg.event === 'system' && msg.payload?.status === 'error') ch.events.push({ systemError: msg.payload })
  }
  ws.onerror = (e) => ch.joinReject(new Error('ws error: ' + (e.message || e)))
  return ch
}
const wait = (ms) => new Promise(r => setTimeout(r, ms))

// === Сценарий 1: доставка postgres_changes своей строки ===
const A = await signup('a')
const chA = subscribeChannel(A.jwt)
await chA.joined
check('подписка postgres_changes зарегистрирована', true)

sql(`UPDATE public.profiles SET phone='+70000000001' WHERE id='${A.uid}';`)
let ok = false
for (let i = 0; i < 40 && !ok; i++) {
  await wait(500)
  ok = chA.events.some(d => d?.type === 'UPDATE' && d?.record?.id === A.uid && d.record.phone === '+70000000001')
}
check('UPDATE своей строки доставлен с полными данными', ok, JSON.stringify(chA.events).slice(0, 200))

// === Сценарий 2: RLS-изоляция — чужая строка не приходит ===
const B = await signup('b')
chA.events = []
sql(`UPDATE public.profiles SET phone='+79999999999' WHERE id='${B.uid}';`)
await wait(6000)
const leak = chA.events.filter(d => d?.record?.id === B.uid || d?.old_record?.id === B.uid)
check('RLS: событие по чужой строке НЕ доставлено', leak.length === 0, JSON.stringify(leak).slice(0, 200))

chA.ws.close()
console.log(`=== ИТОГ: ${passed} passed, ${failed} failed ===`)
process.exit(failed ? 1 : 0)
JS
