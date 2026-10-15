import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

type HistorySlot = {
  id: string
  start_at: string
  duration_minutes: number
  instructor: { full_name: string | null } | null
}

function creditFor(minutes: number) {
  return minutes === 60 ? 1 : minutes === 90 ? 2 : minutes === 120 ? 3 : 0
}

export function StudentDrivingHistory() {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['student-driving-history'],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) throw new Error('Необходимо войти в систему')
      const { data: rows, error: fetchError } = await supabase
        .from('driving_slots')
        .select('id,start_at,duration_minutes,instructor:profiles!driving_slots_instructor_id_fkey(full_name)')
        .eq('student_id', auth.user.id)
        .eq('status', 'booked')
        .order('start_at', { ascending: false })
      if (fetchError) throw fetchError
      const now = Date.now()
      return (rows ?? []).filter(s => new Date(s.start_at).getTime() + s.duration_minutes * 60000 <= now) as unknown as HistorySlot[]
    },
    refetchOnWindowFocus: true,
  })
  const completed = (data ?? []).reduce((sum, slot) => sum + creditFor(slot.duration_minutes), 0)
  return <section className="space-y-3 rounded-xl border bg-white p-4">
    <h2 className="font-semibold">История проведённых занятий</h2>
    <p className="text-sm text-muted-foreground">Зачтено {completed} из 18 · Осталось {Math.max(0, 18 - completed)}. Учитываются завершённые занятия со всеми инструкторами.</p>
    {isLoading && <p className="text-sm text-muted-foreground">Загрузка истории…</p>}
    {error && <div role="alert" className="text-sm text-red-700">Не удалось загрузить историю. <button className="underline" onClick={() => void refetch()}>Повторить</button></div>}
    {!isLoading && !error && data?.length === 0 && <p className="text-sm text-muted-foreground">Проведённых занятий пока нет.</p>}
    {(data ?? []).map(slot => {
      const start = new Date(slot.start_at)
      const end = new Date(start.getTime() + slot.duration_minutes * 60000)
      return <div key={slot.id} className="rounded-lg border">
        <button className="flex w-full items-center justify-between gap-2 p-3 text-left" onClick={() => setExpandedId(current => current === slot.id ? null : slot.id)}>
          <span className="text-sm font-medium">{start.toLocaleDateString('ru-RU')} · {start.toLocaleTimeString('ru-RU', {hour:'2-digit',minute:'2-digit'})}–{end.toLocaleTimeString('ru-RU', {hour:'2-digit',minute:'2-digit'})}</span>
          <span className="text-xs text-muted-foreground">{creditFor(slot.duration_minutes)} зачёт.</span>
        </button>
        {expandedId === slot.id && <div className="space-y-1 border-t p-3 text-sm">
          <p>Инструктор: {slot.instructor?.full_name || 'Не указан'}</p>
          <p>Продолжительность: {slot.duration_minutes} минут</p>
          <p className="text-muted-foreground">Оценка занятия появится после подключения приватных отзывов.</p>
        </div>}
      </div>
    })}
  </section>
}
