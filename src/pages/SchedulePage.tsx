import { useEffect, useState } from 'react'
import { LessonList } from '@/features/schedule/LessonList'
import { useMyLessons, useUpdateLessonStatus } from '@/features/schedule/useLessons'
import { supabase } from '@/lib/supabase'

const localDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const hours = Array.from({ length: 19 }, (_, i) => i + 6)

type Slot = { id: string; start_at: string; duration_minutes: number; status: string; student_id: string | null }

export function SchedulePage() {
  const { data: lessons, isLoading } = useMyLessons()
  const updateStatus = useUpdateLessonStatus()
  const [canManage, setCanManage] = useState(false)
  const [slots, setSlots] = useState<Slot[]>([])
  const [date, setDate] = useState(() => localDate(new Date()))
  const [time, setTime] = useState('09:00')
  const [duration, setDuration] = useState(60)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const today = localDate(new Date())
  const todaysSlots = slots.filter(slot => localDate(new Date(slot.start_at)) === today)

  async function refresh() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: permissions, error: permissionError } = await supabase.from('instructor_schedule_permissions')
      .select('can_manage').eq('instructor_id', user.id).maybeSingle()
    if (permissionError) { setError(permissionError.message); return }
    setCanManage(permissions?.can_manage === true)
    const { data: ownSlots, error: slotsError } = await supabase.from('driving_slots')
      .select('id,start_at,duration_minutes,status,student_id').eq('instructor_id', user.id)
      .gte('start_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()).order('start_at')
    if (slotsError) setError(slotsError.message)
    else setSlots(ownSlots ?? [])
  }
  useEffect(() => { void refresh() }, [])
  async function createSlot() {
    if (!date || !time || saving) return
    setSaving(true); setError('')
    const { error: createError } = await supabase.rpc('create_my_driving_slot', {
      target_start_at: new Date(date + 'T' + time + ':00').toISOString(),
      target_duration_minutes: duration,
      target_comment: null,
    })
    setSaving(false)
    if (createError) setError(createError.message)
    else await refresh()
  }
  async function removeSlot(id: string) {
    if (saving || !window.confirm('Удалить свободное время?')) return
    setSaving(true); setError('')
    const { data, error: deleteError } = await supabase.rpc('delete_my_driving_slot', { target_slot_id: id })
    setSaving(false)
    if (deleteError) setError(deleteError.message)
    else if (!data) setError('Интервал уже забронирован или недоступен для удаления')
    else await refresh()
  }

  if (isLoading) return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
  return <div className="space-y-6">
    <h1 className="text-2xl font-bold text-primary">Моё расписание</h1>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <section className="rounded-xl border bg-white p-4 space-y-3">
      <h2 className="font-semibold">Свободные интервалы</h2>
      <p className="text-sm text-muted-foreground">{canManage ? 'Администратор разрешил управлять свободными интервалами.' : 'Редактирование доступно только после разрешения администратора.'}</p>
      {canManage && <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm">Дата <input type="date" className="block rounded border p-2" value={date} onChange={e => setDate(e.target.value)}/></label>
        <label className="text-sm">Время <input type="time" className="block rounded border p-2" value={time} onChange={e => setTime(e.target.value)}/></label>
        <label className="text-sm">Длительность <select className="block rounded border p-2" value={duration} onChange={e => setDuration(Number(e.target.value))}><option value={60}>60 минут</option><option value={90}>90 минут</option><option value={120}>120 минут</option></select></label>
        <button className="rounded bg-primary px-4 py-2 text-white disabled:opacity-50" disabled={!date || saving} onClick={() => void createSlot()}>Добавить</button>
      </div>}
      {slots.length === 0 ? <p className="text-sm text-muted-foreground">Будущих интервалов нет.</p> : <div className="space-y-2">{slots.map(slot => <div key={slot.id} className="flex items-center gap-3 rounded border p-3 text-sm">
        <span className="flex-1">{new Date(slot.start_at).toLocaleString('ru-RU')} · {slot.duration_minutes} мин · {slot.status === 'open' ? 'Свободно' : 'Занято'}</span>
        {canManage && slot.status === 'open' && !slot.student_id && <button className="text-red-700" disabled={saving} onClick={() => void removeSlot(slot.id)}>Удалить</button>}
      </div>)}</div>}
    </section>
    <section className="rounded-xl border bg-white p-4 space-y-3">
      <h2 className="font-semibold">Расписание на сегодня — {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</h2>
      <p className="text-sm text-muted-foreground">Синие интервалы — свободное время, серые — занятое. Сетка показывает часы с 06:00 до 24:00.</p>
      <div className="max-h-[650px] overflow-auto rounded-lg border">
        <div className="relative min-w-[320px]" style={{ height: 18 * 56 }}>
          {hours.map(hour => <div key={hour} className="absolute flex w-full border-t border-slate-200 text-xs text-muted-foreground" style={{ top: (hour - 6) * 56 }}>
            <span className="w-16 shrink-0 bg-slate-50 px-2 py-1">{String(hour).padStart(2, '0')}:00</span>
            <span className="flex-1 border-l border-slate-200" />
          </div>)}
          {todaysSlots.map(slot => {
            const start = new Date(slot.start_at)
            const minute = start.getHours() * 60 + start.getMinutes()
            const top = Math.max(0, (minute - 360) * 56 / 60)
            const height = Math.min(18 * 56 - top, slot.duration_minutes * 56 / 60)
            if (height <= 0) return null
            const free = slot.status === 'open' && !slot.student_id
            return <div key={slot.id} className={`absolute left-16 right-2 overflow-hidden rounded border px-3 py-1 text-sm ${free ? 'border-blue-300 bg-blue-100 text-blue-800' : 'border-slate-300 bg-slate-200 text-slate-800'}`}
              style={{ top, height: Math.max(18, height - 2) }}>
              <span className="font-medium">{start.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}–{new Date(start.getTime() + slot.duration_minutes * 60000).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
              <span className="ml-2">{free ? 'Свободно' : 'Занято'}</span>
            </div>
          })}
        </div>
      </div>
      {todaysSlots.length === 0 && <p className="text-sm text-muted-foreground">На сегодня интервалов нет.</p>}
    </section>
    <LessonList lessons={lessons ?? []} title="Ближайшие занятия" showActions onStatusChange={(id, status) => updateStatus.mutate(id, status)} />
  </div>
}
