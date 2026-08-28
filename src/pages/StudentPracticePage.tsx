import { useMemo, useState } from 'react'
import { addDays, format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import {
  useAvailableInstructors,
  useChooseInstructor,
  useCreateInstructorReview,
  useInstructorReviews,
  useMyInstructors,
} from '@/features/instructors/useInstructorStudents'
import {
  useCancelMyFutureDrivingSlots,
  useDrivingSlots,
  useMyLessons,
  useUpdateDrivingSlot,
} from '@/features/schedule/useLessons'
import { useAuth } from '@/hooks/useAuth'
import type { DrivingSlot, LessonWithDetails, Profile } from '@/types'
import { CalendarDays, Car, ChevronDown, ChevronLeft, ChevronRight, Clock, Mail, MessageSquare, Phone, Star, UserCheck, UserRound } from 'lucide-react'

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
  const [selectedDate, setSelectedDate] = useState(toDateInputValue(new Date()))
  const [weekStartDate, setWeekStartDate] = useState(() => new Date())
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStartDate, index)),
    [weekStartDate]
  )
  const freeSlotsCount = slots.filter((slot) => slot.status === 'open' && !slot.student_id).length
  const selectedDaySlots = slots.filter(
    (slot) => toDateInputValue(new Date(slot.start_at)) === selectedDate
  )

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
                  const today = new Date()
                  setWeekStartDate((date) => {
                    const previous = addDays(date, -7)
                    return previous < today ? today : previous
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

            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {weekDays.map((day) => {
                const dateValue = toDateInputValue(day)
                const isSelected = selectedDate === dateValue
                const daySlotsCount = slots.filter(
                  (slot) =>
                    slot.status === 'open' &&
                    !slot.student_id &&
                    toDateInputValue(new Date(slot.start_at)) === dateValue
                ).length

                return (
                  <button
                    key={dateValue}
                    type="button"
                    className={`min-w-0 rounded-lg border px-1 py-2 text-center transition-colors sm:px-2 ${
                      isSelected
                        ? 'border-secondary bg-secondary/10 text-secondary'
                        : 'border-border bg-white text-primary hover:bg-muted'
                    }`}
                    onClick={() => setSelectedDate(dateValue)}
                  >
                    <span className="block text-[11px] font-medium capitalize text-muted-foreground sm:text-xs">
                      {format(day, 'EE', { locale: ru })}
                    </span>
                    <span className="mt-0.5 block text-base font-semibold sm:text-lg">
                      {format(day, 'd')}
                    </span>
                    <span className="block text-[11px] font-semibold text-secondary sm:text-xs">
                      {daySlotsCount}
                    </span>
                  </button>
                )
              })}
            </div>

            <div>
              <p className="mb-3 flex min-w-0 items-center gap-2 text-sm font-medium text-primary sm:text-base">
                <Clock className="h-4 w-4" />
                {format(new Date(`${selectedDate}T00:00:00`), 'd MMMM, EEEE', { locale: ru })}
              </p>
              <div className="overflow-x-auto">
                <div
                  className="relative mx-auto min-w-0 rounded-lg border border-border bg-white sm:w-[70%]"
                style={{ height: `${(dayEndHour - dayStartHour) * hourHeight}px` }}
              >
                {hourLabels.map((hour) => (
                  <div
                    key={hour}
                    className="absolute left-0 right-0 border-t border-border/70"
                    style={{ top: `${(hour - dayStartHour) * hourHeight}px` }}
                  >
                    <span className="absolute left-2 top-1 text-[11px] font-medium text-muted-foreground sm:left-3 sm:text-xs">
                      {String(hour).padStart(2, '0')}:00
                    </span>
                  </div>
                ))}

                {selectedDaySlots.map((slot) => {
                  const startDate = new Date(slot.start_at)
                  const startMinutes = startDate.getHours() * 60 + startDate.getMinutes()
                  const top = ((startMinutes - dayStartHour * 60) / 60) * hourHeight
                  const height = (slot.duration_minutes / 60) * hourHeight
                  const startLabel = format(startDate, 'HH:mm')
                  const endLabel = format(new Date(startDate.getTime() + slot.duration_minutes * 60 * 1000), 'HH:mm')
                  const isMyBooking = slot.status === 'booked'

                  return (
                    <button
                      key={slot.id}
                      type="button"
                      className={`absolute left-14 right-2 overflow-hidden rounded-lg border px-2 py-1.5 text-left text-xs font-medium shadow-sm disabled:opacity-80 sm:left-16 sm:right-2 sm:px-3 sm:py-2 sm:text-sm ${
                        isMyBooking
                          ? 'border-emerald-300 bg-emerald-100 text-emerald-800'
                          : 'border-secondary/40 bg-secondary/15 text-secondary hover:bg-secondary/20'
                      }`}
                      style={{ top: `${top + 4}px`, height: `${Math.max(height - 8, 40)}px` }}
                      disabled={isBooking || isMyBooking}
                      onClick={() => {
                        if (!isMyBooking) onBook(slot)
                      }}
                    >
                      <span className="block">{startLabel} - {endLabel}</span>
                      <span className={`text-xs ${isMyBooking ? 'text-emerald-700' : 'text-secondary/80'}`}>
                        {isMyBooking ? 'Вы записаны' : 'Записаться'}
                      </span>
                    </button>
                  )
                })}

                {selectedDaySlots.length === 0 ? (
                  <p className="absolute left-14 right-2 top-4 text-xs text-muted-foreground sm:left-20 sm:text-sm">
                    Нет свободных слотов на этот день.
                  </p>
                ) : null}
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
  const { user } = useAuth()
  const { data: lessons, isLoading: isLessonsLoading } = useMyLessons()
  const { data: instructors, isLoading: isInstructorsLoading } = useAvailableInstructors()
  const { data: selectedInstructors, isLoading: isSelectedInstructorsLoading } = useMyInstructors()
  const { data: drivingSlots, isLoading: isDrivingSlotsLoading } = useDrivingSlots()
  const chooseInstructor = useChooseInstructor()
  const updateDrivingSlot = useUpdateDrivingSlot()
  const cancelMyFutureDrivingSlots = useCancelMyFutureDrivingSlots()
  const [isChangingInstructor, setIsChangingInstructor] = useState(false)
  const [isChangeWarningOpen, setIsChangeWarningOpen] = useState(false)
  const [chosenInstructorId, setChosenInstructorId] = useState<string | null>(null)
  const [changeInstructorError, setChangeInstructorError] = useState<string | null>(null)
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

  if (isLessonsLoading || isInstructorsLoading || isSelectedInstructorsLoading || isDrivingSlotsLoading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
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
                disabled={cancelMyFutureDrivingSlots.isPending}
                onClick={() => setIsChangeWarningOpen(false)}
              >
                Отмена
              </Button>
              <Button
                type="button"
                className="border border-danger/30 bg-danger/10 text-danger hover:bg-danger/15"
                variant="outline"
                disabled={cancelMyFutureDrivingSlots.isPending}
                onClick={() => {
                  setChangeInstructorError(null)
                  const instructorId = selectedInstructor?.id
                  if (!instructorId) {
                    setIsChangeWarningOpen(false)
                    setIsChangingInstructor(true)
                    return
                  }

                  cancelMyFutureDrivingSlots.mutate(instructorId, {
                    onSuccess: () => {
                      setChosenInstructorId(null)
                      setIsChangeWarningOpen(false)
                      setIsChangingInstructor(true)
                    },
                    onError: (error) => {
                      setChangeInstructorError(error instanceof Error ? error.message : 'Не удалось освободить будущие записи.')
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
