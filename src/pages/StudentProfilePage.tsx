import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Car, ChevronDown, UserRound } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { useAuth } from '@/hooks/useAuth'
import { useMyLessons } from '@/features/schedule/useLessons'
import { useMyInstructors } from '@/features/instructors/useInstructorStudents'

const TOTAL_COURSE_VIDEOS = 5
const TOTAL_PDD_TOPICS = 38
const TOTAL_THEORY_ITEMS = TOTAL_COURSE_VIDEOS + TOTAL_PDD_TOPICS
const TOTAL_DRIVING_HOURS = 56

function getStoredStringList(key: string) {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '[]') as string[]
  } catch {
    return []
  }
}

export function StudentProfilePage() {
  const { profile, user } = useAuth()
  const { data: lessons } = useMyLessons()
  const { data: instructors } = useMyInstructors()
  const [isInstructorsOpen, setIsInstructorsOpen] = useState(false)
  const [watchedVideoIds, setWatchedVideoIds] = useState<string[]>(() =>
    getStoredStringList('watched-theory-videos')
  )
  const [readTopicIds, setReadTopicIds] = useState<string[]>(() =>
    getStoredStringList('read-pdd-topics')
  )

  const theoryItemsDone = Math.min(
    watchedVideoIds.length + readTopicIds.length,
    TOTAL_THEORY_ITEMS
  )
  const theoryItemsLeft = Math.max(TOTAL_THEORY_ITEMS - theoryItemsDone, 0)
  const theoryProgress = Math.round((theoryItemsDone / TOTAL_THEORY_ITEMS) * 100)

  useEffect(() => {
    function syncTheoryProgress() {
      setWatchedVideoIds(getStoredStringList('watched-theory-videos'))
      setReadTopicIds(getStoredStringList('read-pdd-topics'))
    }

    window.addEventListener('focus', syncTheoryProgress)
    window.addEventListener('storage', syncTheoryProgress)

    return () => {
      window.removeEventListener('focus', syncTheoryProgress)
      window.removeEventListener('storage', syncTheoryProgress)
    }
  }, [])

  const completedDrivingMinutes =
    lessons
      ?.filter(
        (lesson) => lesson.type === 'practice' && lesson.status === 'completed'
      )
      .reduce((total, lesson) => total + lesson.duration_minutes, 0) ?? 0
  const completedDrivingHours = completedDrivingMinutes / 60
  const drivingHoursLeft = Math.max(
    TOTAL_DRIVING_HOURS - completedDrivingHours,
    0
  )

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{profile?.full_name || 'Профиль'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Email</p>
            <p className="break-all font-medium text-primary">
              {profile?.email || user?.email || 'Не указан'}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Телефон</p>
            <p className="font-medium text-primary">
              {profile?.phone || 'Не указан'}
            </p>
          </div>
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
                    {theoryProgress}%
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-secondary"
                    style={{ width: `${theoryProgress}%` }}
                  />
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Пройдено {theoryItemsDone} из {TOTAL_THEORY_ITEMS}. Осталось пройти: {theoryItemsLeft}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>

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
              <div>
                <p className="font-semibold text-primary">Вождение</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Осталось часов: {drivingHoursLeft.toFixed(1)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>

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
    </div>
  )
}
