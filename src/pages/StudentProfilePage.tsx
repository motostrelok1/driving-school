import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Car, ChevronDown, Info, UserRound } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { useAuth } from '@/hooks/useAuth'
import { useDrivingSlots } from '@/features/schedule/useLessons'
import { usePublishedPdd, usePddReadProgress } from '@/pages/StudentPublishedPddPage'
import { supabase } from '@/lib/supabase'
import { useMyInstructors } from '@/features/instructors/useInstructorStudents'

const TOTAL_COURSE_VIDEOS = 5

function getStoredStringList(key: string) {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '[]') as string[]
  } catch {
    return []
  }
}

export function StudentProfilePage() {
  const { profile, user } = useAuth()
  const { data: drivingSlots } = useDrivingSlots()
  const { sections: publishedSections, loading: pddLoading } = usePublishedPdd()
  const { readIds: readTopicIds, loading: readLoading } = usePddReadProgress()
  const [course, setCourse] = useState<{ name: string; hours: number; options: { minutes: number; academic_hours: number }[] } | null>(null)
  const [courseLoading, setCourseLoading] = useState(true)
  const [isContactsOpen, setIsContactsOpen] = useState(false)
  const { data: instructors } = useMyInstructors()
  const [isInstructorsOpen, setIsInstructorsOpen] = useState(false)
  const [watchedVideoIds, setWatchedVideoIds] = useState<string[]>(() =>
    getStoredStringList('watched-theory-videos')
  )

  const totalTheoryItems = TOTAL_COURSE_VIDEOS + publishedSections.length
  const readPddCount = publishedSections.filter(section => readTopicIds.includes(section.id)).length
  const theoryItemsDone = Math.min(watchedVideoIds.length, TOTAL_COURSE_VIDEOS) + readPddCount
  const theoryItemsLeft = Math.max(totalTheoryItems - theoryItemsDone, 0)
  const theoryProgress = totalTheoryItems ? Math.round(theoryItemsDone / totalTheoryItems * 100) : 0
  const theoryLoading = pddLoading || readLoading

  useEffect(() => {
    const sync = () => setWatchedVideoIds(getStoredStringList('watched-theory-videos'))
    window.addEventListener('focus', sync)
    window.addEventListener('storage', sync)
    return () => { window.removeEventListener('focus', sync); window.removeEventListener('storage', sync) }
  }, [])

  useEffect(() => {
    if (!user?.id) { setCourseLoading(false); return }
    let active = true
    void (async () => {
      const { data: assignment } = await supabase.from('student_driving_courses')
        .select('category_id').eq('student_id', user.id).maybeSingle()
      if (assignment?.category_id) {
        const { data } = await supabase.from('driving_course_categories')
          .select('name,academic_hours,duration_options').eq('id', assignment.category_id).maybeSingle()
        if (active && data) setCourse({
          name: data.name, hours: data.academic_hours,
          options: Array.isArray(data.duration_options) ? data.duration_options as { minutes: number; academic_hours: number }[] : [],
        })
      }
      if (active) setCourseLoading(false)
    })()
    return () => { active = false }
  }, [user?.id])

  const ownSlots = (drivingSlots ?? []).filter(slot => slot.student_id === user?.id && slot.status === 'booked')
  const now = Date.now()
  const finishedSlots = ownSlots.filter(slot => new Date(slot.start_at).getTime() + slot.duration_minutes * 60000 <= now)
  const upcomingSlots = ownSlots.filter(slot => new Date(slot.start_at).getTime() + slot.duration_minutes * 60000 > now)
  const hoursFor = (items: typeof ownSlots) => items.reduce((sum, slot) => sum + (
    course ? (course.options.find(option => option.minutes === slot.duration_minutes)?.academic_hours ?? slot.duration_minutes / 60)
      : slot.duration_minutes / 60
  ), 0)
  const bookedHours = hoursFor(upcomingSlots)
  const [completedHours, setCompletedHours] = useState<number | null>(null)
  useEffect(() => {
    if (!user?.id) return
    let active = true
    void (async () => {
      const { data, error } = await supabase.from('driving_slots')
        .select('start_at,duration_minutes').eq('student_id', user.id).eq('status', 'booked')
        .lt('start_at', new Date().toISOString())
      if (active && !error) {
        const finished = (data ?? []).filter(slot => new Date(slot.start_at).getTime() + slot.duration_minutes * 60000 <= Date.now())
        setCompletedHours(hoursFor(finished as typeof ownSlots))
      }
    })()
    return () => { active = false }
  }, [user?.id, course])
  const drivenHours = completedHours ?? hoursFor(finishedSlots)
  const remainingHours = course ? Math.max(0, course.hours - drivenHours) : null

  return (
    <div className="space-y-6">
      <Card>
        <CardContent>
          <button type="button" className="flex w-full items-center justify-between gap-3 text-left"
            aria-expanded={isContactsOpen} onClick={() => setIsContactsOpen(value => !value)}>
            <span className="font-semibold text-primary">{profile?.full_name || 'Профиль'}</span>
            <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${isContactsOpen ? 'rotate-180' : ''}`} />
          </button>
          {isContactsOpen && <div className="mt-4 space-y-3 border-t pt-3">
            <div><p className="text-sm text-muted-foreground">Email</p>
              <p className="break-all font-medium text-primary">{profile?.email || user?.email || 'Не указан'}</p></div>
            <div><p className="text-sm text-muted-foreground">Телефон</p>
              <p className="font-medium text-primary">{profile?.phone || 'Не указан'}</p></div>
          </div>}
        </CardContent>
      </Card>

      <Link
        to="/student/theory"
        className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2"
      >
        <Card className="transition hover:border-secondary/50 hover:shadow-md">
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-700">
                <BookOpen className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-primary">Теория</p>
                  <span className="text-sm font-semibold text-primary">
                    {theoryLoading ? '…' : `${theoryProgress}%`}
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-secondary"
                    style={{ width: `${theoryProgress}%` }}
                  />
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {theoryLoading ? 'Загрузка прогресса…' : `Пройдено ${theoryItemsDone} из ${totalTheoryItems}. Осталось пройти: ${theoryItemsLeft}`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>

      {profile?.driving_enabled ? (
      <Link
        to="/student/practice"
        className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2"
      >
        <Card className="transition hover:border-secondary/50 hover:shadow-md">
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-700">
                <Car className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-primary">Вождение</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {courseLoading ? 'Загрузка программы…' : course ? `Программа ${course.name}: ${course.hours} ак. ч.` : 'Программа вождения не назначена'}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">Откатано: {drivenHours.toFixed(1)} ч.</p>
                <p className="mt-1 text-sm text-muted-foreground">Записано: {bookedHours.toFixed(1)} ч.</p>
                <p className="mt-1 text-sm text-muted-foreground">Осталось: {remainingHours === null ? '—' : `${remainingHours.toFixed(1)} ч.`}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
      ) : null}

      <Card>
        <CardContent>
          <div className="flex items-start gap-4">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${profile?.driving_enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
              <Info className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-primary">Информация по вождению</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {profile?.driving_enabled
                  ? 'Доступ к разделу «Вождение» открыт.'
                  : 'Доступ к разделу «Вождение» приостановлен администратором.'}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {profile?.driving_enabled
                  ? (instructors && instructors.length > 0
                      ? `Назначен инструктор: ${instructors[0].full_name || 'Без имени'}.`
                      : 'Инструктор пока не назначен.')
                  : 'Назначенный инструктор и будущие записи на занятия снимаются при приостановке доступа.'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {profile?.driving_enabled ? (
        <Card>
          <CardContent>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-4 text-left"
              aria-expanded={isInstructorsOpen}
              onClick={() => setIsInstructorsOpen((value) => !value)}
            >
              <span className="flex min-w-0 items-center gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-700">
                  <UserRound className="h-6 w-6" />
                </span>
                <span>
                  <span className="block font-semibold text-primary">Инструктор</span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    {instructors && instructors.length > 0
                      ? `Назначено: ${instructors.length}`
                      : 'Инструкторы не назначены'}
                  </span>
                </span>
              </span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                  isInstructorsOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {isInstructorsOpen ? (
              <div className="mt-4 space-y-2 border-t border-border pt-4">
                {instructors && instructors.length > 0 ? (
                  instructors.map((instructor) => (
                    <div
                      key={instructor.id}
                      className="rounded-lg border border-border p-3"
                    >
                      <p className="font-medium text-primary">
                        {instructor.full_name || 'Без имени'}
                      </p>
                      {instructor.phone ? (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {instructor.phone}
                        </p>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Инструкторы не назначены
                  </p>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
