import { useEffect, useState, type ElementType } from 'react'
import { Link } from 'react-router-dom'
import { Book, BookOpen, ClipboardCheck, Dumbbell } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'

const TOTAL_COURSE_VIDEOS = 5
const TOTAL_PDD_TOPICS = 38
const TOTAL_THEORY_ITEMS = TOTAL_COURSE_VIDEOS + TOTAL_PDD_TOPICS
const TOTAL_MARATHON_QUESTIONS = 795

function getStoredStringList(key: string) {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '[]') as string[]
  } catch {
    return []
  }
}

function SectionLink({
  to,
  icon: Icon,
  title,
  description,
  progress,
}: {
  to: string
  icon: ElementType
  title: string
  description: string
  progress?: { completed: number; total: number }
}) {
  return (
    <Link
      to={to}
      className="flex items-start gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-700">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block font-medium text-primary">{title}</span>
        <span className="mt-1 block text-sm text-muted-foreground">
          {description}
        </span>
        {progress ? (
          <span className="mt-2 block">
            <span className="flex items-center justify-between gap-3 text-xs font-medium text-muted-foreground">
              <span>Пройдено {progress.completed} из {progress.total}</span>
              <span>{Math.round((progress.completed / progress.total) * 100)}%</span>
            </span>
            <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-muted">
              <span
                className="block h-full rounded-full bg-secondary"
                style={{ width: `${Math.round((progress.completed / progress.total) * 100)}%` }}
              />
            </span>
          </span>
        ) : null}
      </span>
    </Link>
  )
}

export function StudentTheoryPage() {
  const [watchedVideoIds, setWatchedVideoIds] = useState<string[]>(() =>
    getStoredStringList('watched-theory-videos')
  )
  const [readTopicIds, setReadTopicIds] = useState<string[]>(() =>
    getStoredStringList('read-pdd-topics')
  )
  const [answeredMarathonQuestionIds, setAnsweredMarathonQuestionIds] = useState<string[]>(() =>
    getStoredStringList('answered-marathon-questions')
  )
  const completedTheoryItems = Math.min(
    watchedVideoIds.length + readTopicIds.length,
    TOTAL_THEORY_ITEMS
  )
  const completedMarathonQuestions = Math.min(answeredMarathonQuestionIds.length, TOTAL_MARATHON_QUESTIONS)
  const theoryProgress = Math.round((completedTheoryItems / TOTAL_THEORY_ITEMS) * 100)

  useEffect(() => {
    function syncTheoryProgress() {
      setWatchedVideoIds(getStoredStringList('watched-theory-videos'))
      setReadTopicIds(getStoredStringList('read-pdd-topics'))
      setAnsweredMarathonQuestionIds(getStoredStringList('answered-marathon-questions'))
    }

    window.addEventListener('focus', syncTheoryProgress)
    window.addEventListener('storage', syncTheoryProgress)

    return () => {
      window.removeEventListener('focus', syncTheoryProgress)
      window.removeEventListener('storage', syncTheoryProgress)
    }
  }, [])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-primary">Теория</h1>

      <Link
        to="/student/theory/course"
        className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Card className="transition-colors hover:bg-muted">
          <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-700">
              <Book className="h-7 w-7" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-semibold text-primary">Теоретический курс</h2>
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
                Пройдено {completedTheoryItems} из {TOTAL_THEORY_ITEMS}
              </p>
            </div>
          </div>
          </CardContent>
        </Card>
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Тестирование</CardTitle>
        </CardHeader>
        <CardContent>
          <SectionLink
            to="/student/theory/testing"
            icon={ClipboardCheck}
            title="Тестирование"
            description="Промежуточные зачеты и внутренние экзамены"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Тренировки</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <SectionLink
            to="/student/theory/training/tickets"
            icon={BookOpen}
            title="По билетам"
            description="40 билетов по 20 вопросов"
          />
          <SectionLink
            to="/student/theory/training/marathon"
            icon={Dumbbell}
            title="Марафон"
            description="Все вопросы подряд"
            progress={{ completed: completedMarathonQuestions, total: TOTAL_MARATHON_QUESTIONS }}
          />
          <SectionLink
            to="/student/theory/exam"
            icon={ClipboardCheck}
            title="Экзамен как в ГИБДД"
            description="По правилам реального экзамена"
          />
        </CardContent>
      </Card>
    </div>
  )
}
