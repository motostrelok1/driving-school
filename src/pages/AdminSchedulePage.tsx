import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { addDays, format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Pencil, Trash2, X } from 'lucide-react'
import {
  useCreateDrivingSlot,
  useDeleteDrivingSlot,
  useDrivingSlots,
  useUpdateDrivingSlot,
} from '@/features/schedule/useLessons'
import { useAllUsers } from '@/features/admin/useAdmin'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import type { DrivingSlot } from '@/types'
import { supabase } from '@/lib/supabase'

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
  const { data: users = [], isLoading: usersLoading } = useAllUsers()
  const instructors = users.filter((person) => person.role === 'instructor')
  const students = users.filter((person) => person.role === 'student')
  const { data: drivingSlots, isLoading: drivingSlotsLoading } = useDrivingSlots()
  const createDrivingSlot = useCreateDrivingSlot()
  const updateDrivingSlot = useUpdateDrivingSlot()
  const deleteDrivingSlot = useDeleteDrivingSlot()

  const [form, setForm] = useState({
    instructorId: initialInstructorId,
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
  const [bookingStudentSearch, setBookingStudentSearch] = useState('')
  const [notificationWarning, setNotificationWarning] = useState<string | null>(null)

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStartDate, index)),
    [weekStartDate]
  )

  const selectedDateLabel = format(new Date(`${form.selectedDate}T00:00:00`), 'd MMMM, EEEE', {
    locale: ru,
  })

  function isPastSlot(dateValue: string, timeValue: string) {
    return new Date(`${dateValue}T${timeValue}:00`).getTime() < Date.now()
  }

  async function sendStudentNotification(studentId: string, title: string, message: string) {
    const { error } = await supabase.functions.invoke('send-push-notification', {
      body: {
        userId: studentId,
        title,
        message,
        messageType: 'notification',
        allowReply: false,
      },
    })

    if (error) {
      setNotificationWarning('Изменение расписания сохранено, но push-уведомление отправить не удалось.')
      return false
    }

    setNotificationWarning(null)
    return true
  }

  function createSlot(hourValue: string, instructorId = form.instructorId) {
    if (!instructorId || !form.selectedDate || isPastSlot(form.selectedDate, hourValue)) return

    createDrivingSlot.mutate({
      instructor_id: instructorId,
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
    setBookingStudentSearch('')
    setMoveDate(toDateInputValue(slotDate))
    setMoveHour(format(slotDate, 'HH:mm'))
  }

  function moveSlot() {
    if (!activeSlot || !moveDate || !moveHour) return
    if (isPastSlot(moveDate, moveHour)) {
      setNotificationWarning('Нельзя перенести занятие на прошедшие дату и время.')
      return
    }

    updateDrivingSlot.mutate(
      {
        id: activeSlot.id,
        updates: {
          start_at: new Date(`${moveDate}T${moveHour}:00`).toISOString(),
        },
      },
      {
        onSuccess: async () => {
          if (activeSlot.student_id && activeSlot.status === 'booked') {
            const newStart = new Date(`${moveDate}T${moveHour}:00`)
            await sendStudentNotification(
              activeSlot.student_id,
              'Занятие перенесено',
              `Ваше занятие перенесено на ${format(newStart, 'd MMMM, HH:mm', { locale: ru })}.`
            )
          }
          setActiveSlot(null)
          setIsMovingSlot(false)
        },
      }
    )
  }

  function deleteSlot() {
    if (!activeSlot) return

    const cancelledSlot = activeSlot
    deleteDrivingSlot.mutate(activeSlot.id, {
      onSuccess: async () => {
        if (cancelledSlot.student_id && cancelledSlot.status === 'booked') {
          await sendStudentNotification(
            cancelledSlot.student_id,
            'Занятие отменено',
            `Занятие ${format(new Date(cancelledSlot.start_at), 'd MMMM, HH:mm', { locale: ru })} отменено.`
          )
        }
        setActiveSlot(null)
        setIsDeleteConfirmOpen(false)
      },
    })
  }

  function bookSlot() {
    if (!activeSlot || !bookingStudentId) return

    const previousStudentId = activeSlot.student_id
    const bookedSlot = activeSlot
    updateDrivingSlot.mutate(
      {
        id: activeSlot.id,
        updates: {
          student_id: bookingStudentId,
          status: 'booked',
        },
      },
      {
        onSuccess: async () => {
          if (previousStudentId && previousStudentId !== bookingStudentId) {
            await sendStudentNotification(
              previousStudentId,
              'Запись на занятие отменена',
              `Ваша запись на ${format(new Date(bookedSlot.start_at), 'd MMMM, HH:mm', { locale: ru })} отменена администратором.`
            )
          }

          if (previousStudentId !== bookingStudentId) {
            await sendStudentNotification(
              bookingStudentId,
              'Назначено занятие',
              `Вам назначено занятие ${format(new Date(bookedSlot.start_at), 'd MMMM, HH:mm', { locale: ru })}.`
            )
          }

          setActiveSlot(null)
          setIsBookingSlot(false)
          setBookingStudentId('')
          setBookingStudentSearch('')
        },
      }
    )
  }

  function reserveSlot() {
    if (!activeSlot) return

    const reservedSlot = activeSlot
    updateDrivingSlot.mutate(
      {
        id: activeSlot.id,
        updates: {
          student_id: null,
          status: 'reserved',
        },
      },
      {
        onSuccess: async () => {
          if (reservedSlot.student_id && reservedSlot.status === 'booked') {
            await sendStudentNotification(
              reservedSlot.student_id,
              'Запись на занятие отменена',
              `Ваша запись на ${format(new Date(reservedSlot.start_at), 'd MMMM, HH:mm', { locale: ru })} отменена администратором.`
            )
          }
          setActiveSlot(null)
        },
      }
    )
  }

  const todayValue = toDateInputValue(new Date())
  const visibleInstructors = form.instructorId
    ? instructors.filter((instructor) => instructor.id === form.instructorId)
    : instructors
  const selectedDateSlots = (drivingSlots ?? [])
    .filter((slot) => toDateInputValue(new Date(slot.start_at)) === form.selectedDate)

  function slotsForInstructor(instructorId: string) {
    return selectedDateSlots.filter((slot) => slot.instructor_id === instructorId)
  }

  function createdSlotTimesForInstructor(instructorId: string) {
    return new Set(
      slotsForInstructor(instructorId).map((slot) => format(new Date(slot.start_at), 'HH:mm'))
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-primary">Управление расписанием</h1>

      {notificationWarning ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {notificationWarning}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Добавить занятие по вождению</CardTitle>
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
                >
                  <option value="">{instructors.length === 0 ? 'Нет пользователей с ролью «Инструктор»' : 'Все инструкторы'}</option>
                  {instructors.map((instructor) => (
                    <option key={instructor.id} value={instructor.id}>
                      {instructor.full_name || instructor.id}
                    </option>
                  ))}
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

            {instructors.length === 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                В системе нет пользователя с ролью «Инструктор». Создайте инструктора или измените роль существующего пользователя в разделе «Пользователи».
              </div>
            ) : null}

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
                <div className="overflow-x-auto pb-2">
                  <div
                    style={{
                      minWidth: `${80 + Math.max(visibleInstructors.length, 1) * 220}px`,
                    }}
                  >
                    <div
                      className="grid border-x border-t border-border bg-slate-50"
                      style={{
                        gridTemplateColumns: `80px repeat(${Math.max(visibleInstructors.length, 1)}, minmax(220px, 1fr))`,
                      }}
                    >
                      <div className="border-r border-border px-2 py-3 text-xs font-medium text-muted-foreground">
                        Время
                      </div>
                      {visibleInstructors.map((instructor) => (
                        <div key={instructor.id} className="border-r border-border px-3 py-3 text-sm font-semibold text-primary last:border-r-0">
                          {instructor.full_name || instructor.id}
                        </div>
                      ))}
                    </div>

                    <div
                      className="relative grid rounded-b-lg border border-border bg-white"
                      style={{
                        gridTemplateColumns: `80px repeat(${Math.max(visibleInstructors.length, 1)}, minmax(220px, 1fr))`,
                        height: `${(dayEndHour - dayStartHour) * hourHeight}px`,
                      }}
                    >
                      {hourLabels.map((hour) => (
                        <div
                          key={hour}
                          className="pointer-events-none absolute left-0 right-0 border-t border-border/70"
                          style={{ top: `${(hour - dayStartHour) * hourHeight}px` }}
                        />
                      ))}

                      <div className="relative border-r border-border">
                        {hourLabels.map((hour) => (
                          <span
                            key={hour}
                            className="absolute left-3 text-xs font-medium text-muted-foreground"
                            style={{ top: `${(hour - dayStartHour) * hourHeight + 4}px` }}
                          >
                            {String(hour).padStart(2, '0')}:00
                          </span>
                        ))}
                      </div>

                      {visibleInstructors.map((instructor) => {
                        const instructorSlots = slotsForInstructor(instructor.id)
                        const createdSlotTimes = createdSlotTimesForInstructor(instructor.id)

                        return (
                          <div key={instructor.id} className="relative border-r border-border last:border-r-0">
                            {timeOptions.map((timeValue) => {
                              const [hour, minutes] = timeValue.split(':').map(Number)
                              const top = (((hour * 60 + minutes) - dayStartHour * 60) / 60) * hourHeight

                              return (
                                <button
                                  key={timeValue}
                                  type="button"
                                  className="absolute left-1 right-1 rounded border border-transparent transition-colors hover:border-secondary/40 hover:bg-secondary/5 disabled:pointer-events-none disabled:opacity-50"
                                  style={{
                                    top: `${top}px`,
                                    height: `${hourHeight / 4}px`,
                                  }}
                                  disabled={createDrivingSlot.isPending || createdSlotTimes.has(timeValue) || isPastSlot(form.selectedDate, timeValue)}
                                  onClick={() => createSlot(timeValue, instructor.id)}
                                  aria-label={`Создать слот для ${instructor.full_name || 'инструктора'} на ${timeValue}`}
                                />
                              )
                            })}

                            {instructorSlots.map((slot) => {
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
                                  className={`absolute left-1 right-1 overflow-hidden rounded-lg border px-2 py-2 text-left text-sm font-medium shadow-sm transition-colors ${slot.status === 'reserved' ? 'border-danger/30 bg-danger/10 text-danger hover:bg-danger/15' : slot.status === 'booked' ? 'border-primary/30 bg-primary/10 text-primary hover:bg-primary/15' : 'border-secondary/40 bg-secondary/15 text-secondary hover:bg-secondary/20'}`}
                                  style={{ top: `${top + 4}px`, height: `${Math.max(height - 8, 40)}px` }}
                                  onClick={() => openSlotMenu(slot)}
                                >
                                  <span className="block">{startLabel} - {endLabel}</span>
                                  <span className="block truncate text-xs">
                                    {slot.status === 'open' ? 'Открыто для записи' : slot.status === 'booked' ? `Записано${slot.student?.full_name ? `: ${slot.student.full_name}` : ''}` : slot.status === 'reserved' ? 'Бронь без ФИО' : 'Отменено'}
                                  </span>
                                </button>
                              )
                            })}
                          </div>
                        )
                      })}
                    </div>
                  </div>
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
                  <input
                    type="search"
                    value={bookingStudentSearch}
                    onChange={(e) => setBookingStudentSearch(e.target.value)}
                    placeholder="Поиск по ФИО или email"
                    className="h-10 w-full rounded-lg border border-border bg-white px-3 text-primary"
                    autoFocus
                  />
                  <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-border bg-white">
                    {students
                      .filter((student) => {
                        const query = bookingStudentSearch.trim().toLocaleLowerCase('ru')
                        if (!query) return true
                        return [student.full_name || '', student.email || '']
                          .some((value) => value.toLocaleLowerCase('ru').includes(query))
                      })
                      .sort((a, b) => (a.full_name || a.email || '').localeCompare(b.full_name || b.email || '', 'ru'))
                      .map((student) => {
                        const selected = bookingStudentId === student.id
                        return (
                          <button
                            key={student.id}
                            type="button"
                            onClick={() => setBookingStudentId(student.id)}
                            className={`flex w-full items-center justify-between gap-3 border-b border-border px-3 py-2 text-left last:border-b-0 hover:bg-muted ${selected ? 'bg-secondary/10' : ''}`}
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium text-primary">
                                {student.full_name || student.email || student.id}
                              </span>
                              {student.email ? <span className="block truncate text-xs text-muted-foreground">{student.email}</span> : null}
                            </span>
                            {selected ? <span className="text-xs font-medium text-secondary">Выбран</span> : null}
                          </button>
                        )
                      })}
                    {students.filter((student) => {
                      const query = bookingStudentSearch.trim().toLocaleLowerCase('ru')
                      if (!query) return true
                      return [student.full_name || '', student.email || '']
                        .some((value) => value.toLocaleLowerCase('ru').includes(query))
                    }).length === 0 ? (
                      <p className="px-3 py-4 text-sm text-muted-foreground">Ничего не найдено.</p>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button type="button" className="h-10 rounded-lg border border-border bg-white px-4 font-medium text-primary hover:bg-muted" onClick={() => { setIsBookingSlot(false); setBookingStudentSearch('') }}>
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
                    Бронь (отмена)
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {usersLoading || drivingSlotsLoading ? (
        <div className="flex h-32 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : null}
    </div>
  )
}
