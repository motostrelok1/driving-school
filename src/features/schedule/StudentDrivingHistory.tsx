import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'


type HistorySlot = {
  id: string
  start_at: string
  duration_minutes: number
  instructor: { full_name: string | null } | null
}

export function StudentDrivingHistory() {
  const {data:course,isLoading:courseLoading,error:courseError}=useQuery({queryKey:['my-driving-course'],queryFn:async()=>{
    const {data:auth}=await supabase.auth.getUser()
    if(!auth.user)throw new Error('Необходимо войти в систему')
    const {data,error}=await supabase.from('student_driving_courses').select('category_id,driving_course_categories(name,academic_hours,duration_options)').eq('student_id',auth.user.id).maybeSingle()
    if(error)throw error
    return data?.driving_course_categories as {name:string;academic_hours:number;duration_options:Array<{minutes:number;academic_hours:number;kind:string}>}|null|undefined
  }})
  const academicFor=(minutes:number)=>course?.duration_options.find(x=>x.minutes===minutes)?.academic_hours??0
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
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
  const completed = (data ?? []).reduce((sum, slot) => sum + academicFor(slot.duration_minutes), 0)
  const actualMinutes = (data ?? []).reduce((sum,slot)=>sum+slot.duration_minutes,0)
  const actualHours=Math.floor(actualMinutes/60)
  const actualRemainder=actualMinutes%60
  return <section className="space-y-3 rounded-xl border bg-white p-4">
    <button type="button" className="flex w-full items-center justify-between text-left font-semibold" aria-expanded={historyOpen} onClick={() => setHistoryOpen(value => !value)}><span>История проведённых занятий</span><span aria-hidden="true">{historyOpen ? "⌃" : "⌄"}</span></button>
    {historyOpen && <>
    {courseLoading&&<p className="text-sm text-muted-foreground">Загрузка программы…</p>}
    {courseError&&<p role="alert" className="text-sm text-red-700">Не удалось загрузить программу: {courseError.message}</p>}
    {course ? <div className="grid gap-3 sm:grid-cols-3 text-sm">
      <div className="rounded-lg bg-slate-50 p-3"><strong className="block">Академические часы</strong><span>{completed} из {course.academic_hours}</span></div>
      <div className="rounded-lg bg-slate-50 p-3"><strong className="block">Осталось</strong><span>{Math.max(0,course.academic_hours-completed)} акад. ч</span></div>
      <div className="rounded-lg bg-slate-50 p-3"><strong className="block">Фактически откатано</strong><span>{actualHours} ч {actualRemainder} мин · {(data??[]).length} занятий</span></div>
    </div> : <p className="text-sm text-muted-foreground">Программа обучения ещё не назначена администратором. Завершённые занятия и фактическое время отображаются ниже; академический зачёт будет доступен после назначения программы. Фактически откатано: {actualHours} ч {actualRemainder} мин.</p>}
    <p className="text-sm text-muted-foreground">Учитываются завершённые занятия со всеми инструкторами, включая пробные/подарочные (они дают 0 академических часов).</p>
    {isLoading && <p className="text-sm text-muted-foreground">Загрузка истории…</p>}
    {error && <div role="alert" className="text-sm text-red-700">Не удалось загрузить историю. <button className="underline" onClick={() => void refetch()}>Повторить</button></div>}
    {!isLoading && !error && data?.length === 0 && <p className="text-sm text-muted-foreground">Проведённых занятий пока нет.</p>}
    {(data ?? []).map(slot => {
      const start = new Date(slot.start_at)
      const end = new Date(start.getTime() + slot.duration_minutes * 60000)
      return <div key={slot.id} className="rounded-lg border">
        <button className="flex w-full items-center justify-between gap-2 p-3 text-left" onClick={() => setExpandedId(current => current === slot.id ? null : slot.id)}>
          <span className="text-sm font-medium">{start.toLocaleDateString('ru-RU')} · {start.toLocaleTimeString('ru-RU', {hour:'2-digit',minute:'2-digit'})}–{end.toLocaleTimeString('ru-RU', {hour:'2-digit',minute:'2-digit'})}</span>
          <span className="text-xs text-muted-foreground">{course ? `${academicFor(slot.duration_minutes)} акад. ч` : `${slot.duration_minutes} мин`}.</span>
        </button>
        {expandedId === slot.id && <div className="space-y-1 border-t p-3 text-sm">
          <p>Инструктор: {slot.instructor?.full_name || 'Не указан'}</p>
          <p>Продолжительность: {slot.duration_minutes} минут</p>
          <p className="text-muted-foreground">Оценка занятия появится после подключения приватных отзывов.</p>
        </div>}
      </div>
    })}
    </>}
    <div className="border-t pt-3 text-sm font-medium">{course ? `Откатано по программе: ${completed} из ${course.academic_hours} акад. часов` : `Фактически откатано: ${actualHours} ч ${actualRemainder} мин`}</div>
  </section>
}
