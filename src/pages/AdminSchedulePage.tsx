import { useState } from 'react'
import { useMyLessons, useCreateLesson } from '@/features/schedule/useLessons'
import { useInstructors, useStudents } from '@/features/admin/useAdmin'
import { LessonList } from '@/features/schedule/LessonList'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'

export function AdminSchedulePage() {
  const { data: lessons, isLoading } = useMyLessons()
  const { data: instructors } = useInstructors()
  const { data: students } = useStudents()
  const createLesson = useCreateLesson()

  const [form, setForm] = useState({
    studentId: '',
    instructorId: '',
    type: 'practice' as 'theory' | 'practice',
    startAt: '',
    duration: 60,
    comment: '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.studentId || !form.instructorId || !form.startAt) return

    createLesson.mutate(
      {
        student_id: form.studentId,
        instructor_id: form.instructorId,
        type: form.type,
        start_at: new Date(form.startAt).toISOString(),
        duration_minutes: Number(form.duration),
        status: 'scheduled',
        comment: form.comment || null,
      },
      {
        onSuccess: () => {
          setForm({
            studentId: '',
            instructorId: '',
            type: 'practice',
            startAt: '',
            duration: 60,
            comment: '',
          })
        },
      }
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-primary">Управление расписанием</h1>

      <Card>
        <CardHeader>
          <CardTitle>Добавить занятие</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-primary">
                  Ученик
                </label>
                <select
                  value={form.studentId}
                  onChange={(e) =>
                    setForm({ ...form, studentId: e.target.value })
                  }
                  className="h-10 w-full rounded-lg border border-border px-3"
                  required
                >
                  <option value="">Выберите ученика</option>
                  {students?.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name || s.id}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-primary">
                  Инструктор
                </label>
                <select
                  value={form.instructorId}
                  onChange={(e) =>
                    setForm({ ...form, instructorId: e.target.value })
                  }
                  className="h-10 w-full rounded-lg border border-border px-3"
                  required
                >
                  <option value="">Выберите инструктора</option>
                  {instructors?.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.full_name || i.id}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-primary">
                  Тип занятия
                </label>
                <select
                  value={form.type}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      type: e.target.value as 'theory' | 'practice',
                    })
                  }
                  className="h-10 w-full rounded-lg border border-border px-3"
                >
                  <option value="theory">Теория</option>
                  <option value="practice">Вождение</option>
                </select>
              </div>

              <Input
                label="Дата и время"
                type="datetime-local"
                value={form.startAt}
                onChange={(e) =>
                  setForm({ ...form, startAt: e.target.value })
                }
                required
              />

              <Input
                label="Длительность (мин)"
                type="number"
                min={15}
                step={15}
                value={form.duration}
                onChange={(e) =>
                  setForm({ ...form, duration: Number(e.target.value) })
                }
                required
              />

              <Input
                label="Комментарий"
                value={form.comment}
                onChange={(e) =>
                  setForm({ ...form, comment: e.target.value })
                }
                placeholder="Например, адрес встречи"
              />
            </div>

            <Button type="submit" isLoading={createLesson.isPending}>
              Добавить занятие
            </Button>
          </form>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : (
        <LessonList lessons={lessons ?? []} title="Все занятия" />
      )}
    </div>
  )
}
