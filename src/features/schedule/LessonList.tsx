import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import type { LessonWithDetails, LessonStatus } from '@/types'
import { format, parseISO, isPast } from 'date-fns'
import { ru } from 'date-fns/locale'
import { CheckCircle2, XCircle, User } from 'lucide-react'

interface LessonListProps {
  lessons: LessonWithDetails[]
  title?: string
  showActions?: boolean
  onStatusChange?: (id: string, status: LessonStatus) => void
}

const statusLabels: Record<LessonStatus, string> = {
  scheduled: 'Запланировано',
  completed: 'Проведено',
  cancelled: 'Отменено',
}

const statusVariants: Record<LessonStatus, 'default' | 'success' | 'danger'> = {
  scheduled: 'default',
  completed: 'success',
  cancelled: 'danger',
}

const typeLabels: Record<string, string> = {
  theory: 'Теория',
  practice: 'Вождение',
}

export function LessonList({
  lessons,
  title = 'Расписание',
  showActions,
  onStatusChange,
}: LessonListProps) {
  if (lessons.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Занятий пока нет.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {lessons.map((lesson) => {
          const date = parseISO(lesson.start_at)
          const canComplete =
            lesson.status === 'scheduled' && isPast(date)

          return (
            <div
              key={lesson.id}
              className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant={statusVariants[lesson.status]}>
                    {statusLabels[lesson.status]}
                  </Badge>
                  <Badge variant="secondary">{typeLabels[lesson.type]}</Badge>
                </div>
                <p className="font-medium text-primary">
                  {format(date, 'EEEE, d MMMM, HH:mm', { locale: ru })}
                </p>
                <p className="text-sm text-muted-foreground">
                  {lesson.duration_minutes} мин
                </p>
                {lesson.student ? (
                  <p className="flex items-center gap-1 text-sm text-muted-foreground">
                    <User className="h-3.5 w-3.5" />
                    Ученик: {lesson.student.full_name || '—'}
                  </p>
                ) : null}
                {lesson.instructor ? (
                  <p className="flex items-center gap-1 text-sm text-muted-foreground">
                    <User className="h-3.5 w-3.5" />
                    Инструктор: {lesson.instructor.full_name || '—'}
                  </p>
                ) : null}
                {lesson.comment ? (
                  <p className="text-sm text-muted-foreground">
                    {lesson.comment}
                  </p>
                ) : null}
              </div>

              {showActions && canComplete && onStatusChange ? (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onStatusChange(lesson.id, 'completed')}
                  >
                    <CheckCircle2 className="mr-1 h-4 w-4" />
                    Проведено
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onStatusChange(lesson.id, 'cancelled')}
                  >
                    <XCircle className="mr-1 h-4 w-4" />
                    Отменить
                  </Button>
                </div>
              ) : null}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
