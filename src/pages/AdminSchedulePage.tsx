import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { addDays, format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Pencil, Trash2, X } from 'lucide-react'
import {
  useCreateDrivingSlot,
  useDeleteDrivingSlot,
  useDrivingSlots,
  useMyLessons,
  useUpdateDrivingSlot,
} from '@/features/schedule/useLessons'
import { useInstructors, useStudents } from '@/features/admin/useAdmin'
import { LessonList } from '@/features/schedule/LessonList'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import type { DrivingSlot } from '@/types'

const durationOptions = [
  { label: '1ч', value: 60 },
  { label: '1,5ч', value: 90 },
  { label: '2ч', value: 120 },
]

const dayStartHour = 6
const dayEndHour = 24
const timeOptions = Array.from(
  { length: ((dayEndHour - dayStartHour) * 60) / 15 },
  (_, index) => {
    const totalMinutes = dayStartHour * 60 + index * 15
    const hour = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60

    return `${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
  }
)
const hourLabels = Array.from(
  { length: dayEndHour - dayStartHour + 1 },
  (_, index) => dayStartHour + index
)
const hourHeight = 56

function toDateInputValue(date: Date) {
  return format(date, 'yyyy-MM-dd')
}

export function AdminSchedulePage() {
  const [searchParams] = useSearchParams()
  const initialInstructorId = searchParams.get('instructor') ?? ''
  const { data: lessons, isLoading } = useMyLessons()
  const { data: instructors } = useInstructors()
  const { data: students } = useStudents()
  const { data: drivingSlots } = useDrivingSlots()
  const createDrivingSlot = useCreateDrivingSlot()
  const updateDrivingSlot = useUpdateDrivingSlot()
  const deleteDrivingSlot = useDeleteDrivingSlot()

  const [form, setForm] = useState({
    instructorId: initialInstructorId,
    type: 'practice' as 'theory' | 'practice',
    selectedDate: toDateInputValue(new Date()),
    duration: 60,
    comment: '',
  })
  const [weekStartDate, setWeekStartDate] = useState(() => new Date())
  const [activeSlot, setActiveSlot] = useState<DrivingSlot | null>(null)
  const [isMovingSlot, setIsMovingSlot] = useState(false)
  const [moveDate, setMoveDate] = useState(form.selectedDate)
  const [moveHour, setMoveHour] = useState('')
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [isBookingSlot, setIsBookingSlot] = useState(false)
  const [bookingStudentId, setBookingStudentId] = useState('')

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStartDate, index)),
    [weekStartDate]
  )

  const selectedDateLabel = format(new Date(`${form.selectedDate}T00:00:00`), 'd MMMM, EEEE', {
    locale: ru,
  })

  function createSlot(hourValue: string) {
    if (!form.instructorId || !form.selectedDate) return

    createDrivingSlot.mutate({
      instructor_id: form.instructorId,
      student_id: null,
      start_at: new Date(`${form.selectedDate}T${hourValue}:00`).toISOString(),
      duration_minutes: Number(form.duration),
      status: 'open',
      comment: form.comment || null,
    })
  }

  function openSlotMenu(slot: DrivingSlot) {
    const slotDate = new Date(slot.start_at)
    setActiveSlot(slot)
    setIsMovingSlot(false)
    setIsDeleteConfirmOpen(false)
    setIsBookingSlot(false)
    setBookingStudentId(slot.student_id ?? '')
    setMoveDate(toDateInputValue(slotDate))
    setMoveHour(format(slotDate, 'HH:mm'))
  }

  function moveSlot() {
    if (!activeSlot || !moveDate || !moveHour) return

    updateDrivingSlot.mutate(
      {
        id: activeSlot.id,
        updates: {
          start_at: new Date(`${moveDate}T${moveHour}:00`).toISOString(),
        },
      },
      {
        onSuccess: () => {
          setActiveSlot(null)
          setIsMovingSlot(false)
        },
      }
    )
  }

  function deleteSlot() {
    if (!activeSlot) return

    deleteDrivingSlot.mutate(activeSlot.id, {
      onSuccess: () => {
        setActiveSlot(null)
        setIsDeleteConfirmOpen(false)
      },
    })
  }

  function bookSlot() {
    if (!activeSlot || !bookingStudentId) return

    updateDrivingSlot.mutate(
      {
        id: activeSlot.id,
        updates: {
          student_id: bookingStudentId,
          status: 'booked',
        },
      },
      {
        onSuccess: () => {
          setActiveSlot(null)
          setIsBookingSlot(false)
          setBookingStudentId('')
        },
      }
    )
  }

  function reserveSlot() {
    if (!activeSlot) return

    updateDrivingSlot.mutate(
      {
        id: activeSlot.id,
        updates: {
          student_id: null,
          status: 'reserved',
        },
      },
      {
        onSuccess: () => setActiveSlot(null),
      }
    )
  }

  const todayValue = toDateInputValue(new Date())
  const selectedDaySlots = (drivingSlots ?? [])
    .filter((slot) => slot.instructor_id === form.instructorId)
    .filter((slot) => toDateInputValue(new Date(slot.start_at)) === form.selectedDate)

  const createdSlotTimes = new Set(
    selectedDaySlots.map((slot) => format(new Date(slot.start_at), 'HH:mm'))
  )

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-primary">Управление расписанием</h1>

      <Card>
        <CardHeader>
          <CardTitle>Добавить занятие</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-primary">
                  Инструктор
                </label>
                <select
                  value={form.instructorId}
                  onChange={(e) => setForm({ ...form, instructorId: e.target.value })}
                  className="h-10 w-full rounded-lg border border-border px-3"
                  required
                >
                  <option value="">Выберите инструктора</option>
                  {instructors?.map((instructor) => (
                    <option key={instructor.id} value={instructor.id}>
                      {instructor.full_name || instructor.id}
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
                  onChange={(e) => setForm({ ...form, type: e.target.value as 'theory' | 'practice' })}
                  className="h-10 w-full rounded-lg border border-border px-3"
                >
                  <option value="theory">Теория</option>
                  <option value="practice">Вождение</option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-primary">
                  Длительность занятия
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {durationOptions.map((duration) => (
                    <button
                      key={duration.value}
                      type="button"
                      className={`h-10 rounded-lg border text-sm font-medium transition-colors ${
                        form.duration === duration.value
                          ? 'border-secondary bg-secondary/10 text-secondary'
                          : 'border-border bg-white text-primary hover:bg-muted'
                      }`}
                      onClick={() => setForm({ ...form, duration: duration.value })}
                    >
                      {duration.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border p-3">
              <div className="mb-3 flex flex-col gap-2 sm:grid sm:grid-cols-[auto_1fr_auto] sm:items-center">
                <button
                  type="button"
                  className="inline-flex h-9 items-center justify-center gap-1 rounded-lg border border-border bg-white px-3 text-sm font-medium text-primary hover:bg-muted"
                  onClick={() => {
                    const today = new Date()
                    today.setHours(0, 0, 0, 0)
                    setWeekStartDate((date) => {
                      const previous = addDays(date, -7)
                      previous.setHours(0, 0, 0, 0)
                      return previous < today ? today : previous
                    })
                  }}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Прошлая
                </button>
                <div className="flex items-center justify-center gap-2 text-sm font-medium text-primary">
                  <CalendarDays className="h-4 w-4" />
                  {format(weekDays[0], 'd MMM', { locale: ru })} - {format(weekDays[6], 'd MMM', { locale: ru })}
                </div>
                <button
                  type="button"
                  className="inline-flex h-9 items-center justify-center gap-1 rounded-lg border border-border bg-white px-3 text-sm font-medium text-primary hover:bg-muted"
                  onClick={() => setWeekStartDate((date) => addDays(date, 7))}
                >
                  Будущая
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                {weekDays.map((day) => {
                  const dateValue = toDateInputValue(day)
                  const isSelected = form.selectedDate === dateValue

                  return (
                    <button
                      key={dateValue}
                      type="button"
                      className={`rounded-lg border p-3 text-left transition-colors ${
                        isSelected
                          ? 'border-secondary bg-secondary/10 text-secondary'
                          : dateValue === todayValue
                            ? 'border-danger/30 bg-danger/10 text-primary hover:bg-danger/15'
                            : 'border-border bg-white text-primary hover:bg-muted'
                      }`}
                      onClick={() => setForm({ ...form, selectedDate: dateValue })}
                    >
                      <span className="block text-xs capitalize text-muted-foreground">
                        {format(day, 'EEEEEE', { locale: ru })}
                      </span>
                      <span className="mt-1 block text-lg font-semibold">
                        {format(day, 'd')}
                      </span>
                      <span className="block text-xs capitalize text-muted-foreground">
                        {format(day, 'MMMM', { locale: ru })}
                      </span>
                    </button>
                  )
                })}
              </div>

              <div className="mt-4 border-t border-border pt-4">
                <p className="mb-3 flex items-center gap-2 font-medium text-primary">
                  <Clock className="h-4 w-4" />
                  {selectedDateLabel}
                </p>
                <div
                  className="relative min-w-[280px] rounded-lg border border-border bg-white"
                  style={{ height: `${(dayEndHour - dayStartHour) * hourHeight}px` }}
                >
                  {hourLabels.map((hour) => (
                    <div
                      key={hour}
                      className="absolute left-0 right-0 border-t border-border/70"
                      style={{ top: `${(hour - dayStartHour) * hourHeight}px` }}
                    >
                      <span className="absolute left-3 top-1 text-xs font-medium text-muted-foreground">
                        {String(hour).padStart(2, '0')}:00
                      </span>
                    </div>
                  ))}

                  {timeOptions.map((timeValue) => {
                    const [hour, minutes] = timeValue.split(':').map(Number)
                    const top = (((hour * 60 + minutes) - dayStartHour * 60) / 60) * hourHeight

                    return (
                      <button
                        key={timeValue}
                        type="button"
                        className="absolute left-20 right-3 rounded border border-transparent text-left text-sm transition-colors hover:border-secondary/40 hover:bg-secondary/5 disabled:pointer-events-none disabled:opacity-50"
                        style={{
                          top: `${top}px`,
                          height: `${hourHeight / 4}px`,
                        }}
                        disabled={!form.instructorId || createDrivingSlot.isPending || createdSlotTimes.has(timeValue)}
                        onClick={() => createSlot(timeValue)}
                        aria-label={`Создать слот на ${timeValue}`}
                      />
                    )
                  })}

                  {selectedDaySlots.map((slot) => {
                    const startDate = new Date(slot.start_at)
                    const startMinutes = startDate.getHours() * 60 + startDate.getMinutes()
                    const top = ((startMinutes - dayStartHour * 60) / 60) * hourHeight
                    const height = (slot.duration_minutes / 60) * hourHeight
                    const startLabel = format(startDate, 'HH:mm')
                    const endLabel = format(
                      new Date(startDate.getTime() + slot.duration_minutes * 60 * 1000),
                      'HH:mm'
                    )

                    return (
                      <button
                        key={slot.id}
                        type="button"
                        className={`absolute left-20 right-3 rounded-lg border px-3 py-2 text-left text-sm font-medium shadow-sm transition-colors ${slot.status === 'reserved' ? 'border-danger/30 bg-danger/10 text-danger hover:bg-danger/15' : slot.status === 'booked' ? 'border-primary/30 bg-primary/10 text-primary hover:bg-primary/15' : 'border-secondary/40 bg-secondary/15 text-secondary hover:bg-secondary/20'}`}
                        style={{ top: `${top + 4}px`, height: `${Math.max(height - 8, 40)}px` }}
                        onClick={() => openSlotMenu(slot)}
                      >
                        <span className="block">{startLabel} - {endLabel}</span>
                        <span className="text-xs text-secondary/80">
                          {slot.status === 'open' ? 'Открыто для записи' : slot.status === 'booked' ? `Записано${slot.student?.full_name ? `: ${slot.student.full_name}` : ''}` : slot.status === 'reserved' ? 'Бронь без ФИО' : 'Отменено'}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <Input
              label="Комментарий"
              value={form.comment}
              onChange={(e) => setForm({ ...form, comment: e.target.value })}
              placeholder="Например, адрес встречи"
            />


          </div>
        </CardContent>
      </Card>

      {activeSlot ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-3 sm:p-4">
          <div className="relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-4 shadow-lg sm:p-5">
            <button
              type="button"
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-white text-primary hover:bg-muted"
              aria-label="Закрыть"
              onClick={() => setActiveSlot(null)}
            >
              <X className="h-4 w-4" />
            </button>
            <div className="pr-10">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-primary">Слот записи</h2>
                {!isMovingSlot && !isBookingSlot && !isDeleteConfirmOpen ? (
                  <div className="flex shrink-0 gap-2">
                  <button type="button" className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-white text-primary hover:bg-muted" aria-label="Перенести" onClick={() => setIsMovingSlot(true)}>
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button type="button" className="flex h-10 w-10 items-center justify-center rounded-lg border border-danger/30 bg-danger/10 text-danger hover:bg-danger/15" aria-label="Удалить" onClick={() => setIsDeleteConfirmOpen(true)}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                  </div>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {format(new Date(activeSlot.start_at), 'd MMMM, HH:mm', { locale: ru })}
              </p>
            </div>

            {isMovingSlot ? (
              <div className="mt-4 space-y-3">
                <Input
                  label="Дата"
                  type="date"
                  value={moveDate}
                  onChange={(e) => setMoveDate(e.target.value)}
                />
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-primary">
                    Время
                  </label>
                  <select
                    value={moveHour}
                    onChange={(e) => setMoveHour(e.target.value)}
                    className="h-10 w-full rounded-lg border border-border bg-white px-3 text-primary"
                  >
                    {timeOptions.map((timeValue) => (
                      <option key={timeValue} value={timeValue}>{timeValue}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button type="button" className="h-10 rounded-lg border border-border bg-white px-4 font-medium text-primary hover:bg-muted" onClick={() => setIsMovingSlot(false)}>
                    Отмена
                  </button>
                  <button type="button" className="h-10 rounded-lg bg-primary px-4 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50" disabled={updateDrivingSlot.isPending} onClick={moveSlot}>
                    Сохранить
                  </button>
                </div>
              </div>
            ) : isBookingSlot ? (
              <div className="mt-4 space-y-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-primary">
                    Курсант
                  </label>
                  <select
                    value={bookingStudentId}
                    onChange={(e) => setBookingStudentId(e.target.value)}
                    className="h-10 w-full rounded-lg border border-border bg-white px-3 text-primary"
                  >
                    <option value="">Выберите курсанта</option>
                    {students?.map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.full_name || student.email || student.id}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button type="button" className="h-10 rounded-lg border border-border bg-white px-4 font-medium text-primary hover:bg-muted" onClick={() => setIsBookingSlot(false)}>
                    Отмена
                  </button>
                  <button type="button" className="h-10 rounded-lg bg-secondary px-4 font-medium text-secondary-foreground hover:bg-secondary/90 disabled:opacity-50" disabled={!bookingStudentId || updateDrivingSlot.isPending} onClick={bookSlot}>
                    Забронировать
                  </button>
                </div>
              </div>
            ) : isDeleteConfirmOpen ? (
              <div className="mt-4 space-y-4">
                <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
                  Удалить этот слот?
                </p>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button type="button" className="h-10 rounded-lg border border-border bg-white px-4 font-medium text-primary hover:bg-muted" onClick={() => setIsDeleteConfirmOpen(false)}>
                    Нет
                  </button>
                  <button type="button" className="h-10 rounded-lg bg-danger px-4 font-medium text-danger-foreground hover:bg-danger/90 disabled:opacity-50" disabled={deleteDrivingSlot.isPending} onClick={deleteSlot}>
                    Да
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <button type="button" className="h-10 rounded-lg border border-secondary/30 bg-secondary/10 px-4 font-medium text-secondary hover:bg-secondary/15" onClick={() => setIsBookingSlot(true)}>
                    Запись
                  </button>
                  <button type="button" className="h-10 rounded-lg border border-danger/30 bg-danger/10 px-4 font-medium text-danger hover:bg-danger/15 disabled:opacity-50" disabled={updateDrivingSlot.isPending} onClick={reserveSlot}>
                    Бронь
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}

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
