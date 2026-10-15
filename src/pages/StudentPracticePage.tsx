import { useMemo, useState } from 'react'
import { StudentDrivingHistory } from '@/features/schedule/StudentDrivingHistory'
import { addDays, format, startOfWeek } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import {
  useAvailableInstructors,
  useChooseInstructor,
  useBeginInstructorChange,
  useCreateInstructorReview,
  useInstructorReviews,
  useMyInstructors,
} from '@/features/instructors/useInstructorStudents'
import {
  useDrivingSlots,
  useMyLessons,
  useUpdateDrivingSlot,
} from '@/features/schedule/useLessons'
import { useAuth } from '@/hooks/useAuth'
import type { DrivingSlot, LessonWithDetails, Profile } from '@/types'
import { CalendarDays, Car, ChevronDown, ChevronLeft, ChevronRight, Mail, MessageSquare, Phone, Star, UserCheck, UserRound } from 'lucide-react'

function RatingStars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-1 text-amber-500">
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={index}
          className={`h-4 w-4 ${index < Math.round(rating) ? 'fill-current' : ''}`}
        />
      ))}
      <span className="ml-1 text-sm font-medium text-primary">
        {rating.toFixed(1)}
      </span>
    </span>
  )
}

const dayStartHour = 6
const dayEndHour = 24
const hourHeight = 56
const hourLabels = Array.from(
  { length: dayEndHour - dayStartHour + 1 },
  (_, index) => dayStartHour + index
)

function toDateInputValue(date: Date) {
  return format(date, 'yyyy-MM-dd')
}

function FreeDrivingSlotsCard({
  slots,
  selectedInstructor,
  onBook,
  isBooking,
}: {
  slots: DrivingSlot[]
  selectedInstructor?: Profile
  onBook: (slot: DrivingSlot) => void
  isBooking: boolean
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [weekStartDate, setWeekStartDate] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStartDate, index)),
    [weekStartDate]
  )
  const freeSlotsCount = slots.filter((slot) => slot.status === 'open' && !slot.student_id).length
  const weekSlots = useMemo(() => {
    const start = toDateInputValue(weekDays[0])
    const end = toDateInputValue(weekDays[6])
    return slots.filter((slot) => {
      const day = toDateInputValue(new Date(slot.start_at))
      return day >= start && day <= end
    })
  }, [slots, weekDays])
  const earliestWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 })

  if (!selectedInstructor) {
    return (
      <Card>
        <CardHeader><CardTitle>Запись на вождение</CardTitle></CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Сначала выберите инструктора.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden p-3 sm:p-4">
      <CardHeader>
        <CardTitle>Запись на вождение</CardTitle>
      </CardHeader>
      <CardContent className="min-w-0 space-y-4">
        <button
          type="button"
          className="flex w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-border p-3 text-left hover:bg-muted"
          onClick={() => setIsOpen((value) => !value)}
        >
          <span>
            <span className="block font-medium text-primary">
              {selectedInstructor.full_name || 'Инструктор'}
            </span>
            <span className="mt-1 block text-sm text-muted-foreground">
              Свободных слотов: {freeSlotsCount}
            </span>
          </span>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen ? (
          <div className="min-w-0 space-y-3 rounded-lg border border-border p-2 sm:space-y-4 sm:p-3">
            <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
              <button
                type="button"
                className="inline-flex h-9 items-center justify-center gap-1 rounded-lg border border-border bg-white px-2 text-xs font-medium text-primary hover:bg-muted sm:px-3 sm:text-sm"
                onClick={() => {
                  setWeekStartDate((date) => {
                    const previous = addDays(date, -7)
                    return previous < earliestWeekStart ? earliestWeekStart : previous
                  })
                }}
              >
                <ChevronLeft className="h-4 w-4" />
                Назад
              </button>
              <div className="flex min-w-0 items-center justify-center gap-1 text-center text-xs font-medium text-primary sm:gap-2 sm:text-sm">
                <CalendarDays className="h-4 w-4 shrink-0" />
                <span className="truncate">{format(weekDays[0], 'd MMM', { locale: ru })} - {format(weekDays[6], 'd MMM', { locale: ru })}</span>
              </div>
              <button
                type="button"
                className="inline-flex h-9 items-center justify-center gap-1 rounded-lg border border-border bg-white px-2 text-xs font-medium text-primary hover:bg-muted sm:px-3 sm:text-sm"
                onClick={() => setWeekStartDate((date) => addDays(date, 7))}
              >
                Далее
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground">Листайте таблицу по горизонтали, чтобы увидеть остальные дни.</p>
            <div className="w-full max-w-full overflow-x-auto overscroll-x-contain rounded-lg border border-border" aria-label="Недельное расписание вождения" tabIndex={0}>
              <div className="min-w-[788px] bg-white">
                <div className="grid grid-cols-[60px_repeat(7,minmax(104px,1fr))] border-b border-border bg-muted/40">
                  <div className="sticky left-0 z-20 border-r border-border bg-muted p-2 text-xs text-muted-foreground">Время</div>
                  {weekDays.map((day) => {
                    const dayValue = toDateInputValue(day)
                    const available = weekSlots.filter((slot) =>
                      toDateInputValue(new Date(slot.start_at)) === dayValue &&
                      slot.status === 'open' && !slot.student_id
                    ).length
                    return (
                      <div key={dayValue} className="min-w-0 border-r border-border px-1 py-3 text-center text-xs text-primary last:border-r-0">
                        <span className="block capitalize">{format(day, 'EEEEEE', { locale: ru })}</span>
                        <span className="block text-base font-semibold">{format(day, 'd MMM', { locale: ru })}</span>
                        <span className="block whitespace-nowrap text-[11px] text-emerald-700">{available} свободно</span>
                      </div>
                    )
                  })}
                </div>
                <div className="grid grid-cols-[60px_repeat(7,minmax(104px,1fr))]">
                  <div className="sticky left-0 z-10 border-r border-border bg-white" style={{ height: (dayEndHour - dayStartHour) * hourHeight }}>
                    {hourLabels.map((hour) => (
                      <span key={hour} className="absolute left-1 text-[11px] text-muted-foreground" style={{ top: (hour - dayStartHour) * hourHeight + 4 }}>
                        {String(hour).padStart(2, '0')}:00
                      </span>
                    ))}
                  </div>
                  {weekDays.map((day) => {
                    const dayValue = toDateInputValue(day)
                    const daySlots = weekSlots.filter((slot) =>
                      toDateInputValue(new Date(slot.start_at)) === dayValue
                    )
                    return (
                      <div key={dayValue} className="relative border-r border-border last:border-r-0"
                        style={{ height: (dayEndHour - dayStartHour) * hourHeight }}>
                        {hourLabels.map((hour) => (
                          <div key={hour} className="absolute left-0 right-0 border-t border-border/70"
                            style={{ top: (hour - dayStartHour) * hourHeight }} />
                        ))}
                        {daySlots.map((slot) => {
                          const start = new Date(slot.start_at)
                          const startMinutes = start.getHours() * 60 + start.getMinutes()
                          const top = ((startMinutes - dayStartHour * 60) / 60) * hourHeight
                          const height = (slot.duration_minutes / 60) * hourHeight
                          const isBooked = slot.status === 'booked'
                          return (
                            <button key={slot.id} type="button"
                              className={`absolute left-1 right-1 overflow-hidden rounded-md border p-1 text-left text-[11px] font-medium shadow-sm disabled:cursor-default ${isBooked
                                ? 'border-red-400 bg-red-100 text-red-900'
                                : 'border-emerald-400 bg-emerald-100 text-emerald-900 hover:bg-emerald-200'}`}
                              style={{ top: top + 3, height: Math.max(height - 6, 24) }}
                              disabled={isBooking || isBooked}
                              onClick={() => { if (!isBooked) onBook(slot) }}
                              title={`${format(start, 'HH:mm')}–${format(new Date(start.getTime() + slot.duration_minutes * 60000), 'HH:mm')} · ${isBooked ? 'Вы записаны' : 'Записаться'}`}
                            >
                              <span className="block break-normal leading-tight">{format(start, 'HH:mm')}–{format(new Date(start.getTime() + slot.duration_minutes * 60000), 'HH:mm')}</span>
                              <span className="block">{isBooked ? 'Вы записаны' : 'Свободно'}</span>
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
        ) : null}
      </CardContent>
    </Card>
  )
}


function MyDrivingBookingsCard({
  slots,
  onCancel,
  isCancelling,
}: {
  slots: DrivingSlot[]
  onCancel: (slot: DrivingSlot) => Promise<unknown>
  isCancelling: boolean
}) {
  const [activeSlot, setActiveSlot] = useState<DrivingSlot | null>(null)
  const [cancelError, setCancelError] = useState<string | null>(null)

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Мои записи</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {slots.length > 0 ? (
            slots.map((slot) => {
              const startDate = new Date(slot.start_at)
              const endDate = new Date(startDate.getTime() + slot.duration_minutes * 60 * 1000)

              return (
                <button
                  key={slot.id}
                  type="button"
                  className="w-full rounded-lg border border-secondary/40 bg-secondary/10 p-3 text-left text-primary transition-colors hover:bg-secondary/15"
                  onClick={() => {
                    setCancelError(null)
                    setActiveSlot(slot)
                  }}
                >
                  <p className="font-semibold">
                    {format(startDate, 'd MMMM, EEEE', { locale: ru })}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {format(startDate, 'HH:mm')} - {format(endDate, 'HH:mm')}, {slot.duration_minutes} мин.
                  </p>
                  <p className="mt-2 text-sm font-medium text-secondary">
                    {slot.instructor?.full_name || 'Инструктор'}
                  </p>
                </button>
              )
            })
          ) : (
            <p className="text-muted-foreground">Записей пока нет.</p>
          )}
        </CardContent>
      </Card>

      {activeSlot ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-3 sm:p-4">
          <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-4 shadow-lg sm:p-5">
            <h2 className="text-lg font-semibold text-primary">Отменить занятие?</h2>
            {new Date(activeSlot.start_at).getTime() <= Date.now() + 24 * 60 * 60 * 1000 && <p className="mt-2 text-sm text-amber-800">Отменить запись самостоятельно можно только более чем за 24 часа. При болезни предоставьте справку администратору для рассмотрения отмены.</p>}
            <p className="mt-2 text-sm text-muted-foreground">
              {format(new Date(activeSlot.start_at), 'd MMMM, HH:mm', { locale: ru })}
            </p>
            {cancelError ? (
              <p className="mt-3 rounded-lg bg-danger/10 p-3 text-sm text-danger">
                {cancelError}
              </p>
            ) : null}
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={isCancelling}
                onClick={() => setActiveSlot(null)}
              >
                Закрыть
              </Button>
              <Button
                type="button"
                variant="outline"
                className="border border-danger/30 bg-danger/10 text-danger hover:bg-danger/15"
                isLoading={isCancelling}
                disabled={new Date(activeSlot.start_at).getTime() <= Date.now() + 24 * 60 * 60 * 1000}
                onClick={async () => {
                  setCancelError(null)
                  try {
                    await onCancel(activeSlot)
                    setActiveSlot(null)
                  } catch (error) {
                    setCancelError(error instanceof Error ? error.message : 'Не удалось отменить занятие.')
                  }
                }}
              >
                Отменить занятие
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

function InstructorCard({
  instructor,
  isSelected,
  isChoosing,
  canLeaveReview,
  availableSlotsCount,
  onChoose,
  onStartChange,
}: {
  instructor: Profile
  isSelected: boolean
  isChoosing: boolean
  canLeaveReview: boolean
  availableSlotsCount: number
  onChoose: () => void
  onStartChange?: () => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [isReviewsOpen, setIsReviewsOpen] = useState(false)
  const [reviewRating, setReviewRating] = useState('5')
  const [reviewText, setReviewText] = useState('')
  const [reviewError, setReviewError] = useState<string | null>(null)
  const { data: reviews, isLoading: isReviewsLoading } = useInstructorReviews(instructor.id)
  const createReview = useCreateInstructorReview()
  const fallbackRating = instructor.instructor_rating ?? 0
  const reviewsRating = reviews && reviews.length > 0
    ? reviews.reduce((total, review) => total + Number(review.rating), 0) / reviews.length
    : instructor.instructor_reviews_rating ?? fallbackRating
  function submitReview() {
    const rating = Number(reviewRating)
    if (!Number.isFinite(rating) || rating < 0 || rating > 5) {
      setReviewError('Поставьте оценку от 0 до 5.')
      return
    }
    if (!reviewText.trim()) {
      setReviewError('Напишите текст отзыва.')
      return
    }

    setReviewError(null)
    createReview.mutate(
      { instructorId: instructor.id, rating, text: reviewText.trim() },
      {
        onSuccess: () => setReviewText(''),
        onError: (error) => setReviewError(error.message),
      }
    )
  }

  return (
    <div className={`rounded-lg border bg-background ${isSelected ? 'border-secondary bg-secondary/5' : 'border-border'}`}>
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((value) => !value)}
      >
        <span className="min-w-0">
          <span className="block truncate font-medium text-primary">
            {instructor.full_name || 'Инструктор'}
          </span>
          <span className="mt-1 block">
            <RatingStars rating={reviewsRating} />
          </span>
          <span className="mt-1 block text-sm font-semibold text-secondary">
            Свободных занятий: {availableSlotsCount}
          </span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen ? (
        <div className="space-y-4 border-t border-border p-4 pt-3">
          <div className="grid gap-3 lg:grid-cols-[260px_1fr]">
            {instructor.instructor_photo_url ? (
              <img src={instructor.instructor_photo_url} alt={instructor.full_name || 'Инструктор'} className="max-h-[360px] min-h-64 w-full rounded-lg object-contain bg-muted" />
            ) : (
              <div className="flex min-h-64 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <UserRound className="h-10 w-10" />
              </div>
            )}
            <div className="space-y-3 text-sm text-muted-foreground">
              {isSelected ? (
                <p className="flex items-center gap-2 font-medium text-secondary"><UserCheck className="h-4 w-4" />Выбранный инструктор</p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" className={isSelected ? undefined : 'border border-secondary/30 bg-secondary/10 text-secondary hover:bg-secondary/15'} variant={isSelected ? 'secondary' : 'outline'} isLoading={isChoosing} disabled={isSelected || isChoosing} onClick={onChoose}>
                  {isSelected ? 'Выбран' : 'Выбрать инструктора'}
                </Button>
                {isSelected && onStartChange ? (
                  <Button type="button" size="sm" className="border border-danger/30 bg-danger/10 text-danger hover:bg-danger/15" onClick={onStartChange}>
                    Сменить инструктора
                  </Button>
                ) : null}
              </div>
              {instructor.phone ? <p className="flex items-center gap-2"><Phone className="h-4 w-4" />{instructor.phone}</p> : null}
              {instructor.email ? <p className="flex items-center gap-2 break-all"><Mail className="h-4 w-4 shrink-0" />{instructor.email}</p> : null}
            </div>
          </div>

          <div className="rounded-lg border border-border p-3">
            <p className="mb-2 flex items-center gap-2 font-medium text-primary"><Car className="h-4 w-4" />Автомобиль</p>
            <div className="grid gap-3 lg:grid-cols-[260px_1fr]">
              {instructor.instructor_car_photo_url ? (
                <img src={instructor.instructor_car_photo_url} alt={instructor.instructor_car || 'Автомобиль'} className="max-h-[320px] min-h-56 w-full rounded-lg object-contain bg-muted" />
              ) : (
                <div className="flex min-h-56 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Car className="h-8 w-8" /></div>
              )}
              <div>
                <p className="font-medium text-primary">{instructor.instructor_car || 'Автомобиль не указан'}</p>
                <p className="text-sm text-muted-foreground">Год выпуска: {instructor.instructor_car_year || 'не указан'}</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border">
            <button type="button" className="flex w-full items-center justify-between gap-3 p-3 text-left" onClick={() => setIsReviewsOpen((value) => !value)}>
              <span className="flex items-center gap-2 font-medium text-primary"><MessageSquare className="h-4 w-4" />Отзывы</span>
              <span className="flex items-center gap-3"><RatingStars rating={reviewsRating} /><ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isReviewsOpen ? 'rotate-180' : ''}`} /></span>
            </button>
            {isReviewsOpen ? (
              <div className="space-y-3 border-t border-border p-3">
                {canLeaveReview ? (
                  <div className="space-y-2 rounded-lg bg-muted p-3">
                    <div className="grid gap-2 sm:grid-cols-[120px_1fr]">
                      <input className="h-10 rounded-lg border border-border bg-white px-3 text-primary" type="number" min="0" max="5" step="0.1" value={reviewRating} onChange={(e) => setReviewRating(e.target.value)} />
                      <textarea className="min-h-24 rounded-lg border border-border bg-white px-3 py-2 text-primary" value={reviewText} onChange={(e) => setReviewText(e.target.value)} placeholder="Текст отзыва" />
                    </div>
                    {reviewError ? <p className="text-sm text-danger">{reviewError}</p> : null}
                    <Button type="button" size="sm" isLoading={createReview.isPending} onClick={submitReview}>Оставить отзыв</Button>
                  </div>
                ) : null}

                {isReviewsLoading ? (
                  <p className="text-sm text-muted-foreground">Отзывы загружаются...</p>
                ) : reviews && reviews.length > 0 ? (
                  reviews.map((review) => (
                    <div key={review.id} className="rounded-lg border border-border p-3">
                      <div className="mb-1 flex items-center justify-between gap-3">
                        <p className="font-medium text-primary">{review.student?.full_name || 'Ученик'}</p>
                        <RatingStars rating={Number(review.rating)} />
                      </div>
                      <p className="text-sm text-muted-foreground">{review.text}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Отзывов пока нет.</p>
                )}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function StudentPracticePage() {
  const { user, profile } = useAuth()
  const { data: lessons, isLoading: isLessonsLoading, isError: lessonsError, refetch: refetchLessons } = useMyLessons()
  const { data: instructors, isLoading: isInstructorsLoading, isError: instructorsError, refetch: refetchInstructors } = useAvailableInstructors()
  const { data: selectedInstructors, isLoading: isSelectedInstructorsLoading, isError: selectedInstructorsError, refetch: refetchSelectedInstructors } = useMyInstructors()
  const { data: drivingSlots, isLoading: isDrivingSlotsLoading, isError: drivingSlotsError, refetch: refetchDrivingSlots } = useDrivingSlots()
  const chooseInstructor = useChooseInstructor()
  const updateDrivingSlot = useUpdateDrivingSlot()
  const beginInstructorChange = useBeginInstructorChange()
  const [isChangingInstructor, setIsChangingInstructor] = useState(false)
  const [isChangeWarningOpen, setIsChangeWarningOpen] = useState(false)
  const [chosenInstructorId, setChosenInstructorId] = useState<string | null>(null)
  const [changeInstructorError, setChangeInstructorError] = useState<string | null>(null)

  const drivingDisabled = Boolean(profile && !profile.driving_enabled)

  const completedPracticeInstructorIds = useMemo(
    () => new Set((lessons ?? []).filter((lesson: LessonWithDetails) => lesson.type === 'practice' && lesson.status === 'completed').map((lesson) => lesson.instructor_id).filter(Boolean)),
    [lessons]
  )
  const selectedInstructorIds = new Set(
    chosenInstructorId
      ? [chosenInstructorId]
      : selectedInstructors?.map((instructor) => instructor.id) ?? []
  )
  const hasSelectedInstructor = selectedInstructorIds.size > 0
  const selectedInstructor = (instructors ?? []).find((instructor) =>
    selectedInstructorIds.has(instructor.id)
  )
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const selectedInstructorScheduleSlots = isChangingInstructor
    ? []
    : (drivingSlots ?? []).filter(
        (slot) =>
          selectedInstructorIds.has(slot.instructor_id) &&
          new Date(slot.start_at) >= todayStart &&
          ((slot.status === 'open' && !slot.student_id) ||
            (slot.status === 'booked' && slot.student_id === user?.id))
      )
  const myBookedDrivingSlots = (drivingSlots ?? []).filter(
    (slot) =>
      slot.student_id === user?.id &&
      slot.status === 'booked' &&
      new Date(slot.start_at) >= todayStart
  )
  const visibleInstructors = hasSelectedInstructor && !isChangingInstructor
    ? (instructors ?? []).filter((instructor) => selectedInstructorIds.has(instructor.id))
    : instructors ?? []

  function bookFreeSlot(slot: DrivingSlot) {
    if (!user) return

    updateDrivingSlot.mutate({
      id: slot.id,
      updates: {
        student_id: user.id,
        status: 'booked',
      },
    })
  }

  function cancelBookedSlot(slot: DrivingSlot) {
    return updateDrivingSlot.mutateAsync({
      id: slot.id,
      updates: {
        student_id: null,
        status: 'open',
      },
    })
  }

  if (lessonsError || instructorsError || selectedInstructorsError || drivingSlotsError) {
    return (
      <div className="space-y-4 p-4">
        <h1 className="text-2xl font-bold text-primary">Вождение</h1>
        <p role="alert">Не удалось загрузить данные раздела. Попробуйте повторить загрузку.</p>
        <Button onClick={() => {
          void refetchLessons()
          void refetchInstructors()
          void refetchSelectedInstructors()
          void refetchDrivingSlots()
        }}>Повторить загрузку</Button>
      </div>
    )
  }

  if (isLessonsLoading || isInstructorsLoading || isSelectedInstructorsLoading || isDrivingSlotsLoading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
  }

  if (drivingDisabled) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-primary">Вождение</h1>
        <Card>
          <CardHeader><CardTitle>Вождение недоступно</CardTitle></CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Доступ к разделу «Вождение» ещё не открыт администратором.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const hasBookedSlots = myBookedDrivingSlots.length > 0
  const instructorSection = (
    <Card>
      <CardHeader><CardTitle>{hasSelectedInstructor && !isChangingInstructor ? 'Мой инструктор' : 'Выбор инструктора'}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {visibleInstructors.length > 0 ? visibleInstructors.map((instructor) => (
          <InstructorCard
            key={`${instructor.id}-${isChangingInstructor ? 'change' : 'view'}`}
            instructor={instructor}
            isSelected={!isChangingInstructor && selectedInstructorIds.has(instructor.id)}
            isChoosing={chooseInstructor.isPending && chooseInstructor.variables === instructor.id}
            canLeaveReview={completedPracticeInstructorIds.has(instructor.id)}
            availableSlotsCount={(drivingSlots ?? []).filter(
              (slot) =>
                slot.instructor_id === instructor.id &&
                slot.status === 'open' &&
                !slot.student_id &&
                new Date(slot.start_at) >= todayStart
            ).length}
            onChoose={() =>
              chooseInstructor.mutate(instructor.id, {
                onSuccess: () => {
                  setChosenInstructorId(instructor.id)
                  setIsChangingInstructor(false)
                },
              })
            }
            onStartChange={() => {
              setChangeInstructorError(null)
              setIsChangeWarningOpen(true)
            }}
          />
        )) : <p className="text-muted-foreground">Зарегистрированных инструкторов пока нет.</p>}
      </CardContent>
    </Card>
  )
  const drivingSlotsSection = (
    <FreeDrivingSlotsCard
      slots={selectedInstructorScheduleSlots}
      selectedInstructor={isChangingInstructor ? undefined : selectedInstructor}
      isBooking={updateDrivingSlot.isPending}
      onBook={bookFreeSlot}
    />
  )
  const myBookingsSection = (
    <MyDrivingBookingsCard
      slots={myBookedDrivingSlots}
      isCancelling={updateDrivingSlot.isPending}
      onCancel={cancelBookedSlot}
    />
  )

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-primary">Вождение</h1>
      {hasBookedSlots ? (
        <>
          {myBookingsSection}
          {drivingSlotsSection}
          {instructorSection}
        </>
      ) : hasSelectedInstructor && !isChangingInstructor ? (
        <>
          {drivingSlotsSection}
          {instructorSection}
          {myBookingsSection}
        </>
      ) : (
        <>
          {instructorSection}
          {drivingSlotsSection}
          {myBookingsSection}
        </>
      )}
      <StudentDrivingHistory />
      {isChangeWarningOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-3 sm:p-4">
          <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-4 shadow-lg sm:p-5">
            <h2 className="text-lg font-semibold text-primary">Сменить инструктора?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Все будущие записи к текущему инструктору пропадут.
            </p>
            {changeInstructorError ? (
              <p className="mt-3 rounded-lg bg-danger/10 p-3 text-sm text-danger">
                {changeInstructorError}
              </p>
            ) : null}
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={beginInstructorChange.isPending}
                onClick={() => setIsChangeWarningOpen(false)}
              >
                Отмена
              </Button>
              <Button
                type="button"
                className="border border-danger/30 bg-danger/10 text-danger hover:bg-danger/15"
                variant="outline"
                disabled={beginInstructorChange.isPending}
                onClick={() => {
                  setChangeInstructorError(null)
                  beginInstructorChange.mutate(undefined, {
                    onSuccess: () => {
                      setChosenInstructorId(null)
                      setIsChangeWarningOpen(false)
                      setIsChangingInstructor(true)
                    },
                    onError: (error) => {
                      setChangeInstructorError(error instanceof Error ? error.message : 'Не удалось сменить инструктора.')
                    },
                  })
                }}
              >
                Сменить
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
