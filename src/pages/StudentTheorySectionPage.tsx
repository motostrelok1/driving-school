import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Clock, Heart, Lightbulb, PlayCircle, RotateCcw, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { usePddArticle } from '@/features/admin/useAdmin'
import { useTickets } from '@/features/tickets/useTickets'
import { pddTopics } from '@/pages/pddTopics'
import { cn } from '@/utils/cn'

function getTicketImageSrc(image: string) {
  if (image.startsWith('/') || image.startsWith('http')) {
    return image
  }

  return `/tickets/${image}`
}

function getStoredStringList(key: string) {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '[]') as string[]
  } catch {
    return []
  }
}

function getTicketQuestionKey(ticketNumber: number, questionNumber: number) {
  return `${ticketNumber}-${questionNumber}`
}

type TicketAnswerState = Record<number, { selectedAnswer: number; isChecked: boolean }>
type TicketsAnswerState = Record<number, TicketAnswerState>

function getStoredTicketsAnswerState() {
  try {
    return JSON.parse(localStorage.getItem('ticket-training-answers') ?? '{}') as TicketsAnswerState
  } catch {
    return {}
  }
}
const courseVideos = [
  {
    id: '6s8PiXa5EjvdJ5kf6vVVMN',
    title: 'Урок 1. Знаки',
    description: 'Материал теоретического курса',
    embedUrl: 'https://kinescope.io/embed/6s8PiXa5EjvdJ5kf6vVVMN',
  },
  {
    id: 'af99nHFP8TNdC5BHtKgDqF',
    title: 'Урок 2. Знаки',
    description: 'Материал теоретического курса',
    embedUrl: 'https://kinescope.io/embed/af99nHFP8TNdC5BHtKgDqF',
  },
  {
    id: 'bmsevH7PhcEEufgxKfzRLH',
    title: 'Урок 3. Знаки',
    description: 'Материал теоретического курса',
    embedUrl: 'https://kinescope.io/embed/bmsevH7PhcEEufgxKfzRLH',
  },
  {
    id: 'gkrYkSyakYLRNQ8e3XWppQ',
    title: 'Урок 4. Светофор',
    description: 'Материал теоретического курса',
    embedUrl: 'https://kinescope.io/embed/gkrYkSyakYLRNQ8e3XWppQ',
  },
  {
    id: 'jtH5cB3qNEwkocW62GcR1P',
    title: 'Урок 5. Перевозка людей',
    description: 'Материал теоретического курса',
    embedUrl: 'https://kinescope.io/embed/jtH5cB3qNEwkocW62GcR1P',
  },
]

export function StudentTheoryTestingPage() {
  return (
    <TheoryPlaceholder
      title="Тестирование"
      description="Промежуточные зачеты и внутренние экзамены"
    />
  )
}

export function StudentTheoryCoursePage() {
  const [isMaterialsOpen, setIsMaterialsOpen] = useState(false)
  const [isPddOpen, setIsPddOpen] = useState(false)
  const [expandedVideoId, setExpandedVideoId] = useState<string | null>(null)
  const [watchedVideoIds, setWatchedVideoIds] = useState<string[]>(() => {
    try {
      return getStoredStringList('watched-theory-videos')
    } catch {
      return []
    }
  })
  const [readTopicIds, setReadTopicIds] = useState<string[]>(() =>
    getStoredStringList('read-pdd-topics')
  )
  const watchedCount = courseVideos.filter((video) => watchedVideoIds.includes(video.id)).length
  const readPddCount = pddTopics.filter((topic) => readTopicIds.includes(topic.id)).length

  useEffect(() => {
    localStorage.setItem('watched-theory-videos', JSON.stringify(watchedVideoIds))
  }, [watchedVideoIds])

  useEffect(() => {
    function syncReadTopics() {
      setReadTopicIds(getStoredStringList('read-pdd-topics'))
    }

    window.addEventListener('focus', syncReadTopics)
    window.addEventListener('storage', syncReadTopics)

    return () => {
      window.removeEventListener('focus', syncReadTopics)
      window.removeEventListener('storage', syncReadTopics)
    }
  }, [])

  function markVideoWatched(videoId: string) {
    setWatchedVideoIds((current) =>
      current.includes(videoId) ? current : [...current, videoId]
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-primary">Теоретический курс</h1>
      <Card>
        <CardHeader>
          <CardTitle>Материалы курса</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-border bg-white">
            <button
              type="button"
              onClick={() => setIsMaterialsOpen((value) => !value)}
              className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {isMaterialsOpen ? (
                <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-primary">Материалы курса</span>
                <span className="block text-sm text-muted-foreground">
                  Просмотрено {watchedCount} из {courseVideos.length}
                </span>
              </span>
              {watchedCount === courseVideos.length ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
              ) : null}
            </button>

            {isMaterialsOpen ? (
              <div className="space-y-2 border-t border-border p-3">
                {courseVideos.map((video) => {
                  const isExpanded = video.id === expandedVideoId
                  const isWatched = watchedVideoIds.includes(video.id)

                  return (
                    <div
                      key={video.id}
                      className={cn(
                        'rounded-lg border border-border bg-white transition-colors',
                        isExpanded && 'border-secondary bg-sky-50'
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedVideoId((current) => current === video.id ? null : video.id)}
                        className="flex w-full items-center gap-3 p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                        )}
                        <PlayCircle className="h-5 w-5 shrink-0 text-secondary" />
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium text-primary">{video.title}</span>
                          <span className="block text-sm text-muted-foreground">{video.description}</span>
                        </span>
                        {isWatched ? (
                          <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
                        ) : null}
                      </button>

                      {isExpanded ? (
                        <div className="space-y-3 border-t border-border p-3">
                          <div className="overflow-hidden rounded-lg border border-border bg-black">
                            <iframe
                              src={video.embedUrl}
                              title={video.title}
                              allow="autoplay; fullscreen; picture-in-picture; encrypted-media;"
                              allowFullScreen
                              className="aspect-video w-full"
                            />
                          </div>
                          <Button
                            variant={isWatched ? 'outline' : 'primary'}
                            onClick={() => markVideoWatched(video.id)}
                            disabled={isWatched}
                          >
                            {isWatched ? 'Просмотрено' : 'Отметить просмотренным'}
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            ) : null}
          </div>

          <div className="rounded-lg border border-border bg-white">
            <button
              type="button"
              onClick={() => setIsPddOpen((value) => !value)}
              className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {isPddOpen ? (
                <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-primary">ПДД</span>
                <span className="block text-sm text-muted-foreground">
                  Просмотрено {readPddCount} из {pddTopics.length}
                </span>
              </span>
              {readPddCount === pddTopics.length ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
              ) : null}
            </button>

            {isPddOpen ? (
              <div className="space-y-2 border-t border-border p-3">
                {pddTopics.map((topic) => {
                  const isRead = readTopicIds.includes(topic.id)

                  return (
                    <Link
                      key={topic.id}
                      to={`/student/theory/course/pdd/${topic.id}`}
                      className="flex items-center gap-3 rounded-lg border border-border bg-white p-3 text-sm font-medium text-primary transition-colors hover:bg-muted"
                    >
                      <span className="min-w-0 flex-1">{topic.id}. {topic.title}</span>
                      {isRead ? (
                        <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
                      ) : null}
                    </Link>
                  )
                })}
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
      <Link
        to="/student/theory"
        className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-white px-4 text-base font-medium text-primary transition-colors hover:bg-muted"
      >
        Назад
      </Link>
    </div>
  )
}

export function StudentPddPage() {
  const [readTopicIds, setReadTopicIds] = useState<string[]>(() =>
    getStoredStringList('read-pdd-topics')
  )

  useEffect(() => {
    function syncReadTopics() {
      setReadTopicIds(getStoredStringList('read-pdd-topics'))
    }

    window.addEventListener('focus', syncReadTopics)
    window.addEventListener('storage', syncReadTopics)

    return () => {
      window.removeEventListener('focus', syncReadTopics)
      window.removeEventListener('storage', syncReadTopics)
    }
  }, [])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-primary">ПДД</h1>
      <Card>
        <CardHeader>
          <CardTitle>Разделы ПДД</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {pddTopics.map((topic) => {
            const isRead = readTopicIds.includes(topic.id)

            return (
              <Link
                key={topic.id}
                to={`/student/theory/course/pdd/${topic.id}`}
                className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm font-medium text-primary transition-colors hover:bg-muted"
              >
                <span className="min-w-0 flex-1">{topic.id}. {topic.title}</span>
                {isRead ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
                ) : null}
              </Link>
            )
          })}
        </CardContent>
      </Card>
      <Link
        to="/student/theory/course"
        className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-white px-4 text-base font-medium text-primary transition-colors hover:bg-muted"
      >
        Назад к курсу
      </Link>
    </div>
  )
}

export function StudentPddTopicPage() {
  const { topicId } = useParams()
  const topic = pddTopics.find((item) => item.id === topicId)
  const { data: article, isLoading } = usePddArticle(topicId)
  const blocks = article?.content?.blocks ?? []

  useEffect(() => {
    if (!topicId) return
    const currentTopicId = topicId

    function markTopicRead() {
      const scrollBottom = window.scrollY + window.innerHeight
      const pageBottom = document.documentElement.scrollHeight - 24

      if (scrollBottom < pageBottom) return

      const current = getStoredStringList('read-pdd-topics')
      if (current.includes(currentTopicId)) return

      localStorage.setItem('read-pdd-topics', JSON.stringify([...current, currentTopicId]))
      window.dispatchEvent(new Event('storage'))
    }

    markTopicRead()
    window.addEventListener('scroll', markTopicRead, { passive: true })
    window.addEventListener('resize', markTopicRead)

    return () => {
      window.removeEventListener('scroll', markTopicRead)
      window.removeEventListener('resize', markTopicRead)
    }
  }, [topicId, blocks.length])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-primary">
        {topic ? topic.title : 'Раздел ПДД'}
      </h1>
      <Card>
        <CardHeader>
          <CardTitle>{topic ? `${topic.id}. ${topic.title}` : 'Материал'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          ) : blocks.length > 0 ? (
            <div className="space-y-4">
              {blocks.map((block, index) => {
                if (block.type === 'image') {
                  return (
                    <figure key={index} className="space-y-2">
                      <img
                        src={block.src}
                        alt={block.alt || ''}
                        className="max-h-96 w-full rounded-lg object-contain"
                      />
                      {block.caption ? (
                        <figcaption className="text-sm text-muted-foreground">
                          {block.caption}
                        </figcaption>
                      ) : null}
                    </figure>
                  )
                }

                return (
                  <p key={index} className="whitespace-pre-line text-primary">
                    {block.text}
                  </p>
                )
              })}
            </div>
          ) : (
            <p className="text-muted-foreground">
              Материал раздела будет добавлен из файла.
            </p>
          )}
          <Link
            to="/student/theory/course/pdd"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-white px-4 text-base font-medium text-primary transition-colors hover:bg-muted"
          >
            Назад к ПДД
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}

export function StudentTheoryTicketsPage() {
  const { data: tickets = [], isLoading, error } = useTickets()
  const [ticketNumber, setTicketNumber] = useState<number | null>(null)
  const [questionIndex, setQuestionIndex] = useState(0)
  const [ticketsAnswerState, setTicketsAnswerState] = useState<TicketsAnswerState>(() =>
    getStoredTicketsAnswerState()
  )
  const [answersByQuestion, setAnswersByQuestion] = useState<TicketAnswerState>({})
  const [favoriteQuestionKeys, setFavoriteQuestionKeys] = useState<string[]>(() =>
    getStoredStringList('favorite-marathon-questions')
  )
  const [showHint, setShowHint] = useState(false)

  const activeTicket = useMemo(() => {
    if (ticketNumber === null) return null
    return tickets.find((ticket) => ticket.ticketNumber === ticketNumber) ?? null
  }, [ticketNumber, tickets])

  const activeQuestion = activeTicket?.questions[questionIndex]
  const currentAnswer = activeQuestion
    ? answersByQuestion[activeQuestion.number]
    : undefined
  const selectedAnswer = currentAnswer?.selectedAnswer ?? null
  const isChecked = currentAnswer?.isChecked ?? false
  const isCorrect =
    activeQuestion && selectedAnswer !== null
      ? selectedAnswer === activeQuestion.correctAnswer
      : false
  const checkedAnswers = activeTicket
    ? activeTicket.questions
        .map((question) => ({ question, answer: answersByQuestion[question.number] }))
        .filter((item) => item.answer?.isChecked)
    : []
  const correctCount = checkedAnswers.filter(
    (item) => item.answer?.selectedAnswer === item.question.correctAnswer
  ).length
  const wrongCount = checkedAnswers.length - correctCount
  const activeQuestionKey = activeTicket && activeQuestion
    ? getTicketQuestionKey(activeTicket.ticketNumber, activeQuestion.number)
    : null
  const isFavoriteQuestion = activeQuestionKey
    ? favoriteQuestionKeys.includes(activeQuestionKey)
    : false

  useEffect(() => {
    localStorage.setItem('favorite-marathon-questions', JSON.stringify(favoriteQuestionKeys))
  }, [favoriteQuestionKeys])

  useEffect(() => {
    localStorage.setItem('ticket-training-answers', JSON.stringify(ticketsAnswerState))
  }, [ticketsAnswerState])

  function toggleFavoriteQuestion(questionKey: string) {
    setFavoriteQuestionKeys((current) =>
      current.includes(questionKey)
        ? current.filter((key) => key !== questionKey)
        : [...current, questionKey]
    )
  }

  function openTicket(nextTicketNumber: number) {
    setTicketNumber(nextTicketNumber)
    setQuestionIndex(0)
    setAnswersByQuestion(ticketsAnswerState[nextTicketNumber] ?? {})
    setShowHint(false)
  }
  function goToQuestion(nextIndex: number) {
    if (!activeTicket) return

    setQuestionIndex(
      Math.min(Math.max(nextIndex, 0), activeTicket.questions.length - 1)
    )
    setShowHint(false)
  }

  if (ticketNumber === null) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-primary">По билетам</h1>
        <Card>
          <CardHeader>
            <CardTitle>Выберите билет</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            ) : error ? (
              <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
                Билеты пока не удалось загрузить. Проверьте файл /tickets/tickets.json.
              </p>
            ) : tickets.length > 0 ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
                {tickets.map((ticket) => {
                  const ticketAnswers = ticketsAnswerState[ticket.ticketNumber] ?? {}
                  const hasWrongAnswer = ticket.questions.some((question) => {
                    const answer = ticketAnswers[question.number]
                    return answer?.isChecked && answer.selectedAnswer !== question.correctAnswer
                  })

                  return (
                    <button
                      key={ticket.ticketNumber}
                      type="button"
                      onClick={() => openTicket(ticket.ticketNumber)}
                      className={cn(
                        'rounded-lg border border-border bg-white p-3 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        hasWrongAnswer && 'border-danger/40 bg-danger/10'
                      )}
                    >
                      <span className="block font-semibold text-primary">
                        Билет {ticket.ticketNumber}
                      </span>
                      <span className="mt-1 block text-sm text-muted-foreground">
                        {ticket.questions.length} вопросов
                      </span>
                    </button>
                  )
                })}
              </div>
            ) : (
              <p className="text-muted-foreground">
                Билеты появятся здесь после загрузки файла /tickets/tickets.json.
              </p>
            )}

            <Link
              to="/student/theory"
              className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-white px-4 text-base font-medium text-primary transition-colors hover:bg-muted"
            >
              Назад
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!activeTicket || !activeQuestion) {
    return (
      <TheoryPlaceholder
        title="По билетам"
        description="Выбранный билет не найден в файле."
      />
    )
  }

  const progressText = `${questionIndex + 1} из ${activeTicket.questions.length}`

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-primary">
            Билет {activeTicket.ticketNumber}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Вопрос {progressText}
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-sm font-medium">
            <span className="rounded-lg border border-green-200 bg-green-50 px-3 py-1 text-primary">
              Верно: {correctCount}
            </span>
            <span className="rounded-lg bg-danger/10 px-3 py-1 text-danger">
              Ошибки: {wrongCount}
            </span>
            <span className="rounded-lg border border-border bg-white px-3 py-1 text-muted-foreground">
              Отвечено: {checkedAnswers.length}
            </span>
          </div>
        </div>
        <Button variant="outline" onClick={() => setTicketNumber(null)}>
          Все билеты
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="relative">
            <CardTitle className="pr-10 text-base sm:text-lg">
              {activeQuestion.number}. {activeQuestion.text}
            </CardTitle>
            {activeQuestionKey ? (
              <button
                type="button"
                onClick={() => toggleFavoriteQuestion(activeQuestionKey)}
                className="absolute right-0 top-0 rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={isFavoriteQuestion ? 'Убрать из избранного' : 'Добавить в избранное'}
              >
                <Heart className={cn('h-5 w-5', isFavoriteQuestion && 'fill-danger text-danger')} />
              </button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {activeQuestion.image ? (
            <img
              src={getTicketImageSrc(activeQuestion.image)}
              alt={`Вопрос ${activeQuestion.number}`}
              className="max-h-96 w-full rounded-lg border border-border object-contain"
            />
          ) : null}

          {showHint && activeQuestion.hint ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-primary">
              {activeQuestion.hint}
            </div>
          ) : null}

          <div className="space-y-2">
            {activeQuestion.answers.map((answer) => {
              const isSelected = selectedAnswer === answer.number
              const isRightAnswer = activeQuestion.correctAnswer === answer.number
              const showCorrect = isChecked && isRightAnswer
              const showWrong = isChecked && isSelected && !isRightAnswer

              return (
                <button
                  key={answer.number}
                  type="button"
                  disabled={isChecked}
                  onClick={() => {
                    if (!activeQuestion) return
                    const nextAnswer = {
                      selectedAnswer: answer.number,
                      isChecked: true,
                    }
                    setAnswersByQuestion((current) => ({
                      ...current,
                      [activeQuestion.number]: nextAnswer,
                    }))
                    setTicketsAnswerState((current) => ({
                      ...current,
                      [activeTicket.ticketNumber]: {
                        ...(current[activeTicket.ticketNumber] ?? {}),
                        [activeQuestion.number]: nextAnswer,
                      },
                    }))
                  }}
                  className={cn(
                    'flex min-h-12 w-full items-start gap-3 rounded-lg border border-border bg-white p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default',
                    isSelected && 'border-secondary bg-sky-50',
                    showCorrect && 'border-green-300 bg-green-50',
                    showWrong && 'border-danger bg-danger/10'
                  )}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-primary">
                    {answer.number}
                  </span>
                  <span className="flex-1 text-primary">{answer.text}</span>
                  {showCorrect ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
                  ) : null}
                  {showWrong ? (
                    <XCircle className="h-5 w-5 shrink-0 text-danger" />
                  ) : null}
                </button>
              )
            })}
          </div>

          {isChecked ? (
            <div
              className={cn(
                'rounded-lg px-3 py-2 text-sm font-medium',
                isCorrect
                  ? 'border border-green-200 bg-green-50 text-primary'
                  : 'bg-danger/10 text-danger'
              )}
            >
              {isCorrect ? 'Верно.' : 'Неверно. Посмотрите правильный вариант и подсказку.'}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => setShowHint((value) => !value)}
              disabled={!activeQuestion.hint}
            >
              <Lightbulb className="mr-1.5 h-4 w-4" />
              Подсказка
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 items-center gap-3">
        <Button
          variant="outline"
          onClick={() => goToQuestion(questionIndex - 1)}
          disabled={questionIndex === 0}
          className="justify-self-start"
        >
          <ChevronLeft className="mr-1.5 h-4 w-4" />
          Назад
        </Button>
        <Link
          to="/student/theory"
          className="justify-self-center inline-flex h-10 items-center justify-center rounded-lg border border-border bg-white px-4 text-base font-medium text-primary transition-colors hover:bg-muted"
        >
          Назад
        </Link>
        <Button
          variant="outline"
          onClick={() => goToQuestion(questionIndex + 1)}
          disabled={questionIndex === activeTicket.questions.length - 1}
          className="justify-self-end"
        >
          Далее
          <ChevronRight className="ml-1.5 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

export function StudentTheoryTopicsPage() {
  return (
    <TheoryPlaceholder
      title="По темам"
      description="37 тем по 1-117 вопросов"
    />
  )
}

type MarathonMode = 'ordered' | 'random' | 'favorites'

type MarathonQuestion = {
  key: string
  ticketNumber: number
  number: number
  text: string
  image?: string
  answers: Array<{ number: number; text: string }>
  correctAnswer: number
  hint?: string
}

function shuffleQuestions(questions: MarathonQuestion[]) {
  const result = [...questions]

  for (let index = result.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1))
    ;[result[index], result[randomIndex]] = [result[randomIndex], result[index]]
  }

  return result
}

function formatExamTime(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60

  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`
}

export function StudentTheoryMarathonPage() {
  const { data: tickets = [], isLoading, error } = useTickets()
  const [mode, setMode] = useState<MarathonMode | null>(null)
  const [questions, setQuestions] = useState<MarathonQuestion[]>([])
  const [questionIndex, setQuestionIndex] = useState(0)
  const [answersByQuestion, setAnswersByQuestion] = useState<Record<string, { selectedAnswer: number; isChecked: boolean }>>({})
  const [favoriteQuestionKeys, setFavoriteQuestionKeys] = useState<string[]>(() =>
    getStoredStringList('favorite-marathon-questions')
  )
  const [answeredQuestionKeys, setAnsweredQuestionKeys] = useState<string[]>(() =>
    getStoredStringList('answered-marathon-questions')
  )
  const [showHint, setShowHint] = useState(false)

  const allQuestions = useMemo(
    () => tickets.flatMap((ticket) =>
      ticket.questions.map((question) => ({
        ...question,
        key: getTicketQuestionKey(ticket.ticketNumber, question.number),
        ticketNumber: ticket.ticketNumber,
      }))
    ),
    [tickets]
  )
  const activeQuestion = questions[questionIndex]
  const currentAnswer = activeQuestion ? answersByQuestion[activeQuestion.key] : undefined
  const selectedAnswer = currentAnswer?.selectedAnswer ?? null
  const isChecked = currentAnswer?.isChecked ?? false
  const isCorrect = activeQuestion && selectedAnswer !== null
    ? selectedAnswer === activeQuestion.correctAnswer
    : false
  const checkedAnswers = questions
    .map((question) => ({ question, answer: answersByQuestion[question.key] }))
    .filter((item) => item.answer?.isChecked)
  const correctCount = checkedAnswers.filter(
    (item) => item.answer?.selectedAnswer === item.question.correctAnswer
  ).length
  const wrongCount = checkedAnswers.length - correctCount
  const favoriteQuestions = allQuestions.filter((question) => favoriteQuestionKeys.includes(question.key))
  const isFavoriteQuestion = activeQuestion ? favoriteQuestionKeys.includes(activeQuestion.key) : false

  useEffect(() => {
    localStorage.setItem('favorite-marathon-questions', JSON.stringify(favoriteQuestionKeys))
  }, [favoriteQuestionKeys])

  useEffect(() => {
    localStorage.setItem('answered-marathon-questions', JSON.stringify(answeredQuestionKeys))
  }, [answeredQuestionKeys])

  function startMarathon(nextMode: MarathonMode) {
    const nextQuestions = nextMode === 'favorites'
      ? favoriteQuestions
      : nextMode === 'random'
        ? shuffleQuestions(allQuestions)
        : allQuestions
    setMode(nextMode)
    setQuestions(nextQuestions)
    setQuestionIndex(0)
    setAnswersByQuestion({})
    setShowHint(false)
  }

  function toggleFavoriteQuestion(questionKey: string) {
    setFavoriteQuestionKeys((current) =>
      current.includes(questionKey)
        ? current.filter((key) => key !== questionKey)
        : [...current, questionKey]
    )
  }

  function goToQuestion(nextIndex: number) {
    setQuestionIndex(Math.min(Math.max(nextIndex, 0), questions.length - 1))
    setShowHint(false)
  }

  if (!mode) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-primary">Марафон</h1>
        <Card>
          <CardHeader>
            <CardTitle>Запуск марафона</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            ) : error ? (
              <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
                Билеты пока не удалось загрузить.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-3">
                <Button variant="outline" onClick={() => startMarathon('ordered')} disabled={allQuestions.length === 0}>
                  По порядку
                </Button>
                <Button variant="outline" onClick={() => startMarathon('random')} disabled={allQuestions.length === 0}>
                  Случайно
                </Button>
                <Button variant="outline" onClick={() => startMarathon('favorites')} disabled={favoriteQuestions.length === 0}>
                  По избранному
                </Button>
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              Всего вопросов: {allQuestions.length}. В избранном: {favoriteQuestions.length}
            </p>
            <Link
              to="/student/theory"
              className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-white px-4 text-base font-medium text-primary transition-colors hover:bg-muted"
            >
              Назад
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!activeQuestion) {
    return <TheoryPlaceholder title="Марафон" description="Вопросы не найдены." />
  }

  const progressText = `${questionIndex + 1} из ${questions.length}`

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-primary">Марафон</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === 'ordered' ? 'По порядку' : mode === 'random' ? 'Случайно' : 'По избранному'} · Вопрос {progressText}
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-sm font-medium">
            <span className="rounded-lg border border-green-200 bg-green-50 px-3 py-1 text-primary">
              Верно: {correctCount}
            </span>
            <span className="rounded-lg bg-danger/10 px-3 py-1 text-danger">
              Ошибки: {wrongCount}
            </span>
            <span className="rounded-lg border border-border bg-white px-3 py-1 text-muted-foreground">
              Отвечено: {checkedAnswers.length}
            </span>
          </div>
        </div>
        <Button variant="outline" onClick={() => setMode(null)}>
          Завершить
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="relative">
            <CardTitle className="space-y-2 px-10 text-center text-base sm:text-lg">
              <span className="block text-sm font-medium text-muted-foreground">
                Билет {activeQuestion.ticketNumber}, вопрос {activeQuestion.number}
              </span>
              <span className="block text-primary">{activeQuestion.text}</span>
            </CardTitle>
            <button
              type="button"
              onClick={() => toggleFavoriteQuestion(activeQuestion.key)}
              className="absolute right-0 top-0 rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={isFavoriteQuestion ? 'Убрать из избранного' : 'Добавить в избранное'}
            >
              <Heart className={cn('h-5 w-5', isFavoriteQuestion && 'fill-danger text-danger')} />
            </button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {activeQuestion.image ? (
            <img
              src={getTicketImageSrc(activeQuestion.image)}
              alt={`Билет ${activeQuestion.ticketNumber}, вопрос ${activeQuestion.number}`}
              className="max-h-96 w-full rounded-lg border border-border object-contain"
            />
          ) : null}

          {showHint && activeQuestion.hint ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-primary">
              {activeQuestion.hint}
            </div>
          ) : null}

          <div className="space-y-2">
            {activeQuestion.answers.map((answer) => {
              const isSelected = selectedAnswer === answer.number
              const isRightAnswer = activeQuestion.correctAnswer === answer.number
              const showCorrect = isChecked && isRightAnswer
              const showWrong = isChecked && isSelected && !isRightAnswer

              return (
                <button
                  key={answer.number}
                  type="button"
                  disabled={isChecked}
                  onClick={() => {
                    setAnswersByQuestion((current) => ({
                      ...current,
                      [activeQuestion.key]: {
                        selectedAnswer: answer.number,
                        isChecked: true,
                      },
                    }))
                    setAnsweredQuestionKeys((current) =>
                      current.includes(activeQuestion.key) ? current : [...current, activeQuestion.key]
                    )
                  }}
                  className={cn(
                    'flex min-h-12 w-full items-start gap-3 rounded-lg border border-border bg-white p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default',
                    isSelected && 'border-secondary bg-sky-50',
                    showCorrect && 'border-green-300 bg-green-50',
                    showWrong && 'border-danger bg-danger/10'
                  )}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-primary">
                    {answer.number}
                  </span>
                  <span className="flex-1 text-primary">{answer.text}</span>
                  {showCorrect ? <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" /> : null}
                  {showWrong ? <XCircle className="h-5 w-5 shrink-0 text-danger" /> : null}
                </button>
              )
            })}
          </div>

          {isChecked ? (
            <div
              className={cn(
                'rounded-lg px-3 py-2 text-sm font-medium',
                isCorrect
                  ? 'border border-green-200 bg-green-50 text-primary'
                  : 'bg-danger/10 text-danger'
              )}
            >
              {isCorrect ? 'Верно.' : 'Неверно. Посмотрите правильный вариант и подсказку.'}
            </div>
          ) : null}

          <Button
            variant="outline"
            onClick={() => setShowHint((value) => !value)}
            disabled={!activeQuestion.hint}
          >
            <Lightbulb className="mr-1.5 h-4 w-4" />
            Подсказка
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 items-center gap-3">
        <Button
          variant="outline"
          onClick={() => goToQuestion(questionIndex - 1)}
          disabled={questionIndex === 0}
          className="justify-self-start"
        >
          <ChevronLeft className="mr-1.5 h-4 w-4" />
          Назад
        </Button>
        <Link
          to="/student/theory"
          className="justify-self-center inline-flex h-10 items-center justify-center rounded-lg border border-border bg-white px-4 text-base font-medium text-primary transition-colors hover:bg-muted"
        >
          Назад
        </Link>
        <Button
          variant="outline"
          onClick={() => goToQuestion(questionIndex + 1)}
          disabled={questionIndex === questions.length - 1}
          className="justify-self-end"
        >
          Далее
          <ChevronRight className="ml-1.5 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

type ExamStatus = 'idle' | 'running' | 'passed' | 'failed'

const EXAM_TIME_SECONDS = 20 * 60
const MAX_EXAM_WRONG_ANSWERS = 2

export function StudentTheoryExamPage() {
  const { data: tickets = [], isLoading, error } = useTickets()
  const [examTicketNumber, setExamTicketNumber] = useState<number | null>(null)
  const [questionIndex, setQuestionIndex] = useState(0)
  const [answersByQuestion, setAnswersByQuestion] = useState<Record<number, { selectedAnswer: number; isChecked: boolean }>>({})
  const [favoriteQuestionKeys, setFavoriteQuestionKeys] = useState<string[]>(() =>
    getStoredStringList('favorite-marathon-questions')
  )
  const [showHint, setShowHint] = useState(false)
  const [status, setStatus] = useState<ExamStatus>('idle')
  const [timeLeft, setTimeLeft] = useState(EXAM_TIME_SECONDS)

  const activeTicket = useMemo(() => {
    if (examTicketNumber === null) return null
    return tickets.find((ticket) => ticket.ticketNumber === examTicketNumber) ?? null
  }, [examTicketNumber, tickets])
  const activeQuestion = activeTicket?.questions[questionIndex]
  const currentAnswer = activeQuestion ? answersByQuestion[activeQuestion.number] : undefined
  const selectedAnswer = currentAnswer?.selectedAnswer ?? null
  const isChecked = currentAnswer?.isChecked ?? false
  const checkedAnswers = activeTicket
    ? activeTicket.questions
        .map((question) => ({ question, answer: answersByQuestion[question.number] }))
        .filter((item) => item.answer?.isChecked)
    : []
  const correctCount = checkedAnswers.filter(
    (item) => item.answer?.selectedAnswer === item.question.correctAnswer
  ).length
  const wrongCount = checkedAnswers.length - correctCount
  const isCorrect = activeQuestion && selectedAnswer !== null
    ? selectedAnswer === activeQuestion.correctAnswer
    : false
  const activeQuestionKey = activeTicket && activeQuestion
    ? getTicketQuestionKey(activeTicket.ticketNumber, activeQuestion.number)
    : null
  const isFavoriteQuestion = activeQuestionKey
    ? favoriteQuestionKeys.includes(activeQuestionKey)
    : false

  useEffect(() => {
    localStorage.setItem('favorite-marathon-questions', JSON.stringify(favoriteQuestionKeys))
  }, [favoriteQuestionKeys])

  useEffect(() => {
    if (status !== 'running') return

    const timer = window.setInterval(() => {
      setTimeLeft((current) => {
        if (current <= 1) {
          setStatus('failed')
          return 0
        }

        return current - 1
      })
    }, 1000)

    return () => window.clearInterval(timer)
  }, [status])

  function toggleFavoriteQuestion(questionKey: string) {
    setFavoriteQuestionKeys((current) =>
      current.includes(questionKey)
        ? current.filter((key) => key !== questionKey)
        : [...current, questionKey]
    )
  }

  function startExam() {
    const availableTickets = tickets.filter((ticket) => ticket.questions.length > 0)
    const ticket = availableTickets[Math.floor(Math.random() * availableTickets.length)]

    if (!ticket) return

    setExamTicketNumber(ticket.ticketNumber)
    setQuestionIndex(0)
    setAnswersByQuestion({})
    setShowHint(false)
    setTimeLeft(EXAM_TIME_SECONDS)
    setStatus('running')
  }

  function finishExam(nextAnswers: Record<number, { selectedAnswer: number; isChecked: boolean }>) {
    if (!activeTicket) return

    const checked = activeTicket.questions
      .map((question) => ({ question, answer: nextAnswers[question.number] }))
      .filter((item) => item.answer?.isChecked)
    const correct = checked.filter(
      (item) => item.answer?.selectedAnswer === item.question.correctAnswer
    ).length
    const wrong = checked.length - correct

    if (wrong >= MAX_EXAM_WRONG_ANSWERS) {
      setStatus('failed')
      return
    }

    if (checked.length === activeTicket.questions.length) {
      setStatus('passed')
    }
  }

  function answerQuestion(answerNumber: number) {
    if (!activeQuestion || status !== 'running' || isChecked) return

    setAnswersByQuestion((current) => {
      const nextAnswers = {
        ...current,
        [activeQuestion.number]: {
          selectedAnswer: answerNumber,
          isChecked: true,
        },
      }
      finishExam(nextAnswers)
      return nextAnswers
    })
  }

  function goToQuestion(nextIndex: number) {
    if (!activeTicket) return

    setQuestionIndex(
      Math.min(Math.max(nextIndex, 0), activeTicket.questions.length - 1)
    )
    setShowHint(false)
  }

  if (status === 'idle') {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-primary">Экзамен как в ГИБДД</h1>
        <Card>
          <CardHeader>
            <CardTitle>Запуск экзамена</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            ) : error ? (
              <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
                Билеты пока не удалось загрузить.
              </p>
            ) : (
              <Button variant="outline" onClick={startExam} disabled={tickets.length === 0}>
                Начать экзамен
              </Button>
            )}
            <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
              <span className="rounded-lg border border-border bg-white px-3 py-1">20 минут</span>
              <span className="rounded-lg border border-border bg-white px-3 py-1">Случайный билет</span>
              <span className="rounded-lg border border-border bg-white px-3 py-1">2 ошибки — не сдан</span>
            </div>
            <Link
              to="/student/theory"
              className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-white px-4 text-base font-medium text-primary transition-colors hover:bg-muted"
            >
              Назад
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!activeTicket || !activeQuestion) {
    return <TheoryPlaceholder title="Экзамен как в ГИБДД" description="Билет не найден." />
  }

  const isFinished = status === 'passed' || status === 'failed'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-primary">Экзамен как в ГИБДД</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Билет {activeTicket.ticketNumber}
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-sm font-medium">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1 text-primary">
              <Clock className="h-4 w-4" />
              {formatExamTime(timeLeft)}
            </span>
            <span className="rounded-lg border border-green-200 bg-green-50 px-3 py-1 text-primary">
              Верно: {correctCount}
            </span>
            <span className="rounded-lg bg-danger/10 px-3 py-1 text-danger">
              Ошибки: {wrongCount}
            </span>
            <span className="rounded-lg border border-border bg-white px-3 py-1 text-muted-foreground">
              Отвечено: {checkedAnswers.length}
            </span>
          </div>
        </div>
        <Button variant="outline" onClick={startExam}>
          <RotateCcw className="mr-1.5 h-4 w-4" />
          Новый билет
        </Button>
      </div>

      {isFinished ? (
        <div
          className={cn(
            'rounded-lg px-4 py-3 text-base font-semibold',
            status === 'passed'
              ? 'border border-green-200 bg-green-50 text-primary'
              : 'bg-danger/10 text-danger'
          )}
        >
          {status === 'passed' ? 'Экзамен сдан.' : 'Экзамен не сдан.'}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <div className="relative">
            <CardTitle className="space-y-2 px-10 text-center text-base sm:text-lg">
              <span className="block text-sm font-medium text-muted-foreground">
                Билет {activeTicket.ticketNumber}, вопрос {activeQuestion.number}
              </span>
              <span className="block text-primary">{activeQuestion.text}</span>
            </CardTitle>
            {activeQuestionKey ? (
              <button
                type="button"
                onClick={() => toggleFavoriteQuestion(activeQuestionKey)}
                className="absolute right-0 top-0 rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={isFavoriteQuestion ? 'Убрать из избранного' : 'Добавить в избранное'}
              >
                <Heart className={cn('h-5 w-5', isFavoriteQuestion && 'fill-danger text-danger')} />
              </button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {activeQuestion.image ? (
            <img
              src={getTicketImageSrc(activeQuestion.image)}
              alt={`Билет ${activeTicket.ticketNumber}, вопрос ${activeQuestion.number}`}
              className="max-h-96 w-full rounded-lg border border-border object-contain"
            />
          ) : null}

          {showHint && activeQuestion.hint ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-primary">
              {activeQuestion.hint}
            </div>
          ) : null}

          <div className="space-y-2">
            {activeQuestion.answers.map((answer) => {
              const isSelected = selectedAnswer === answer.number
              const isRightAnswer = activeQuestion.correctAnswer === answer.number
              const showCorrect = isChecked && isRightAnswer
              const showWrong = isChecked && isSelected && !isRightAnswer

              return (
                <button
                  key={answer.number}
                  type="button"
                  disabled={isChecked || isFinished}
                  onClick={() => answerQuestion(answer.number)}
                  className={cn(
                    'flex min-h-12 w-full items-start gap-3 rounded-lg border border-border bg-white p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default',
                    isSelected && 'border-secondary bg-sky-50',
                    showCorrect && 'border-green-300 bg-green-50',
                    showWrong && 'border-danger bg-danger/10'
                  )}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-primary">
                    {answer.number}
                  </span>
                  <span className="flex-1 text-primary">{answer.text}</span>
                  {showCorrect ? <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" /> : null}
                  {showWrong ? <XCircle className="h-5 w-5 shrink-0 text-danger" /> : null}
                </button>
              )
            })}
          </div>

          {isChecked ? (
            <div
              className={cn(
                'rounded-lg px-3 py-2 text-sm font-medium',
                isCorrect
                  ? 'border border-green-200 bg-green-50 text-primary'
                  : 'bg-danger/10 text-danger'
              )}
            >
              {isCorrect ? 'Верно.' : 'Неверно. Посмотрите правильный вариант и подсказку.'}
            </div>
          ) : null}

          <Button
            variant="outline"
            onClick={() => setShowHint((value) => !value)}
            disabled={!activeQuestion.hint}
          >
            <Lightbulb className="mr-1.5 h-4 w-4" />
            Подсказка
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 items-center gap-3">
        <span />
        <Link
          to="/student/theory"
          className="justify-self-center inline-flex h-10 items-center justify-center rounded-lg border border-border bg-white px-4 text-base font-medium text-primary transition-colors hover:bg-muted"
        >
          Назад
        </Link>
        <Button
          variant="outline"
          onClick={() => goToQuestion(questionIndex + 1)}
          disabled={questionIndex === activeTicket.questions.length - 1 || isFinished}
          className="justify-self-end"
        >
          Далее
          <ChevronRight className="ml-1.5 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function TheoryPlaceholder({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-primary">{title}</h1>
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">{description}</p>
          <Link
            to="/student/theory"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-white px-4 text-base font-medium text-primary transition-colors hover:bg-muted"
          >
            Назад
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}























