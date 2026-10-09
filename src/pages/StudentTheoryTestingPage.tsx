import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Clock, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { useAuth } from '@/hooks/useAuth'
import { assessmentKindLabels, formatAssessmentDate } from '@/features/theory/assessments'
import { useMyTheoryAssessments, useMyTheoryAttempt, useTheoryOperation } from '@/features/theory/useTheoryExecution'
import { useServerClock } from '@/features/theory/useServerClock'
import { cn } from '@/utils/cn'
import type { TheoryAssessmentOverview } from '@/types'

function studentError(error: unknown) {
  const value = error as { code?: string; message?: string }
  if (value.code?.startsWith('PGRST') || value.code === '42P01' || value.code === '42883') {
    return 'Раздел временно недоступен. Обратитесь к администратору.'
  }
  return value.message || 'Не удалось сохранить данные. Проверьте соединение и попробуйте ещё раз.'
}

function timeText(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

export function StudentTheoryTestingPage() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const rawAttempt = params.get('attempt')
  const attemptId = rawAttempt && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawAttempt) ? rawAttempt : null
  const overview = useMyTheoryAssessments(user?.id)
  const attemptQuery = useMyTheoryAttempt(user?.id, attemptId)
  const operation = useTheoryOperation(user?.id)
  const payload = attemptQuery.data
  const attempt = payload?.attempt
  const now = useServerClock(attemptId ? payload?.server_time : overview.data?.server_time)
  const [questionIndex, setQuestionIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [confirmFinish, setConfirmFinish] = useState(false)
  const submitting = useRef(false)
  const openedAttempt = useRef<string | null>(null)
  const requestedExpiry = useRef<string | null>(null)
  const seconds = attempt && now !== null ? Math.max(0, Math.ceil((Date.parse(attempt.expires_at) - now) / 1000)) : null

  useEffect(() => {
    if (!payload || openedAttempt.current === payload.attempt.id) return
    openedAttempt.current = payload.attempt.id
    const next = payload.attempt.question_snapshot.findIndex((_, index) => !payload.answers.some((answer) => answer.question_index === index))
    setQuestionIndex(next < 0 ? 0 : next)
    setError(null)
    setConfirmFinish(false)
  }, [payload])

  useEffect(() => {
    if (attempt?.status !== 'running' || seconds !== 0 || requestedExpiry.current === attempt.id) return
    requestedExpiry.current = attempt.id
    void attemptQuery.refetch()
  }, [attempt?.status, attempt?.id, seconds, attemptQuery])

  async function start(assessmentId: string) {
    if (submitting.current) return
    submitting.current = true
    setError(null)
    try {
      const result = await operation.mutateAsync({ action: 'start', assessmentId })
      setParams({ attempt: result.attempt.id })
    } catch (cause) {
      setError(studentError(cause))
      void overview.refetch()
    } finally { submitting.current = false }
  }

  async function answer(answerNumber: number) {
    if (!attempt || submitting.current || seconds === null || seconds <= 0) return
    submitting.current = true
    setError(null)
    try {
      const result = await operation.mutateAsync({ action: 'answer', attemptId: attempt.id, questionIndex, answer: answerNumber })
      const next = result.attempt.question_snapshot.findIndex((_, index) => !result.answers.some((item) => item.question_index === index))
      if (next >= 0) setQuestionIndex(next)
    } catch (cause) {
      // Ответ мог сохраниться до обрыва связи. Восстанавливаем подтверждённое серверное состояние.
      const fresh = await attemptQuery.refetch()
      if (!fresh.data?.answers.some((item) => item.question_index === questionIndex && item.selected_answer === answerNumber)) {
        setError(studentError(cause))
      }
    } finally { submitting.current = false }
  }

  async function finish() {
    if (!attempt || submitting.current) return
    submitting.current = true
    setError(null)
    try {
      await operation.mutateAsync({ action: 'finish', attemptId: attempt.id })
      setConfirmFinish(false)
    } catch (cause) {
      setError(studentError(cause))
      void attemptQuery.refetch()
    } finally { submitting.current = false }
  }

  const goBack = () => { setParams({}); setError(null); void overview.refetch() }
  const errorMessage = error || (attemptId ? attemptQuery.error && studentError(attemptQuery.error) : overview.error && studentError(overview.error))

  if (rawAttempt) {
    const question = attempt?.question_snapshot[questionIndex]
    const saved = payload?.answers.find((item) => item.question_index === questionIndex)
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-primary">Официальное тестирование</h1>
          <Button variant="outline" disabled={operation.isPending} onClick={goBack}>К назначениям</Button>
        </div>
        {!attemptId ? <p role="alert" className="text-danger">Некорректная ссылка на попытку.</p> : null}
        {errorMessage ? <p role="alert" className="rounded-lg bg-danger/10 p-3 text-danger">{errorMessage}</p> : null}
        {attemptQuery.isLoading ? <p>Загрузка попытки…</p> : null}
        {attempt && payload && attempt.status !== 'running' ? (
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2">
              {attempt.passed ? <CheckCircle2 className="h-6 w-6 text-green-600" /> : <XCircle className="h-6 w-6 text-danger" />}
              {attempt.passed ? 'Сдано' : 'Не сдано'}
            </CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {attempt.status === 'expired' ? <p>Время прохождения закончилось.</p> : null}
              <p>Верных ответов: <strong>{attempt.correct_count} из {attempt.question_count}</strong></p>
              <p>Ошибок с учётом вопросов без ответа: <strong>{attempt.error_count}</strong>. Допустимо: {attempt.max_errors}.</p>
              <p>Вопросов без ответа: {attempt.question_count - payload.answers.length}.</p>
              <p>Затраченное время: {timeText(attempt.elapsed_seconds ?? 0)}.</p>
              <p className="text-sm text-muted-foreground">Начало: {formatAssessmentDate(attempt.started_at)} (МСК).</p>
              <p className="text-sm text-muted-foreground">Результат сохранён. Для пересдачи обратитесь к администратору.</p>
            </CardContent>
          </Card>
        ) : null}
        {attempt?.status === 'running' && question && payload ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
              <span>Отвечено: {payload.answers.length} из {attempt.question_count}</span>
              <span className="flex items-center gap-2 font-semibold"><Clock className="h-4 w-4" />{seconds === null ? 'Синхронизация…' : timeText(seconds)}</span>
            </div>
            <p className="text-sm text-muted-foreground">Ответ сохраняется сразу после выбора. Изменить сохранённый ответ нельзя. При закрытии страницы время продолжает идти.</p>
            <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto">
              {attempt.question_snapshot.map((item, index) => (
                <button key={item.key} type="button" disabled={operation.isPending} onClick={() => setQuestionIndex(index)}
                  aria-label={`Вопрос ${index + 1}`} aria-current={index === questionIndex ? 'step' : undefined}
                  className={cn('h-8 min-w-8 rounded-lg border px-2 text-sm', index === questionIndex ? 'border-primary bg-primary text-white' : payload.answers.some((answer) => answer.question_index === index) ? 'border-sky-200 bg-sky-50' : 'border-border')}>
                  {index + 1}
                </button>
              ))}
            </div>
            <Card>
              <CardHeader><CardTitle className="text-base">Вопрос {questionIndex + 1}: {question.text}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {question.image ? <img src={question.image} alt="Иллюстрация вопроса" className="max-h-80 w-full rounded-lg border border-border object-contain" /> : null}
                <div className="space-y-2">
                  {question.answers.map((option) => (
                    <button key={option.number} type="button" disabled={!!saved || operation.isPending || seconds === null || seconds <= 0}
                      aria-pressed={saved?.selected_answer === option.number} onClick={() => void answer(option.number)}
                      className={cn('flex min-h-12 w-full items-start gap-3 rounded-lg border p-3 text-left disabled:cursor-default', saved?.selected_answer === option.number ? 'border-sky-300 bg-sky-50' : 'border-border hover:bg-muted')}>
                      <span className="font-semibold">{option.number}.</span><span>{option.text}</span>
                    </button>
                  ))}
                </div>
                {operation.isPending ? <p role="status" className="text-sm">Сохраняем…</p> : saved ? <p className="text-sm text-muted-foreground">Ответ сохранён.</p> : null}
                {seconds === 0 ? <p role="status">Проверяем завершение на сервере…</p> : null}
              </CardContent>
            </Card>
            <div className="flex flex-wrap justify-between gap-2">
              <Button variant="outline" disabled={questionIndex === 0 || operation.isPending} onClick={() => setQuestionIndex((value) => value - 1)}>Назад</Button>
              <Button variant="outline" disabled={operation.isPending} onClick={() => setConfirmFinish(true)}>Завершить попытку</Button>
              <Button variant="outline" disabled={questionIndex === attempt.question_count - 1 || operation.isPending} onClick={() => setQuestionIndex((value) => value + 1)}>Далее</Button>
            </div>
            {confirmFinish ? <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p>Завершить сейчас? Вопросы без ответа будут засчитаны как ошибки.</p>
              <div className="flex flex-wrap gap-2"><Button disabled={operation.isPending} onClick={() => void finish()}>Да, завершить</Button><Button variant="outline" disabled={operation.isPending} onClick={() => setConfirmFinish(false)}>Продолжить тест</Button></div>
            </div> : null}
          </>
        ) : null}
      </div>
    )
  }

  const items = overview.data?.items ?? []
  const history = items.filter((item) => item.attempt && item.attempt.status !== 'running')
  const current = items.filter((item) => item.attempt?.status === 'running' || (!item.attempt && !item.assessment.cancelled_at && now !== null && Date.parse(item.assessment.deadline_at) > now))
  const available = current.filter((item) => item.attempt?.status === 'running' || (now !== null && Date.parse(item.assessment.opens_at) <= now))
  const scheduled = current.filter((item) => !available.includes(item))
  function assignmentCard(item: TheoryAssessmentOverview['items'][number]) {
    const { assessment, attempt, available_questions: count } = item
    const open = now !== null && Date.parse(assessment.opens_at) <= now
    const sufficient = count >= assessment.question_count
    return (
      <Card key={assessment.id}><CardHeader><CardTitle className="text-base">{assessmentKindLabels[assessment.kind]}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p>{assessment.question_count} вопросов · {assessment.time_limit_minutes} мин · ошибок не более {assessment.max_errors}</p>
          <p className="text-sm text-muted-foreground">{formatAssessmentDate(assessment.opens_at)} — {formatAssessmentDate(assessment.deadline_at)} (МСК)</p>
          <p className="text-sm text-muted-foreground">На прохождение доступно не больше времени, оставшегося до крайнего срока.</p>
          {!attempt && open && !sufficient ? <p className="text-sm">Вопросы для этого теста ещё не подготовлены. Обратитесь к администратору.</p> : null}
          <Button disabled={operation.isPending || now === null || (!attempt && (!open || !sufficient))}
            onClick={() => attempt ? setParams({ attempt: attempt.id }) : void start(assessment.id)}>
            {attempt ? 'Продолжить' : open ? 'Начать' : 'Ожидает открытия'}
          </Button>
        </CardContent>
      </Card>
    )
  }
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-primary">Тестирование</h1>
      <p className="text-muted-foreground">Промежуточные зачёты и внутренние экзамены, назначенные администратором.</p>
      {errorMessage ? <p role="alert" className="rounded-lg bg-danger/10 p-3 text-danger">{errorMessage}</p> : null}
      {overview.isLoading ? <p>Загрузка назначений…</p> : null}
      <section className="space-y-3"><h2 className="text-lg font-semibold">Доступно сейчас</h2>{available.map(assignmentCard)}{!overview.isLoading && available.length === 0 ? <p className="text-sm text-muted-foreground">Нет доступных тестирований.</p> : null}</section>
      <section className="space-y-3"><h2 className="text-lg font-semibold">Назначено</h2>{scheduled.map(assignmentCard)}{!overview.isLoading && scheduled.length === 0 ? <p className="text-sm text-muted-foreground">Нет предстоящих тестирований.</p> : null}</section>
      <section className="space-y-3"><h2 className="text-lg font-semibold">История попыток</h2>
        {history.map(({ assessment, attempt }) => <div key={assessment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
          <div><p className="font-medium">{assessmentKindLabels[assessment.kind]} · {attempt?.passed ? 'Сдано' : 'Не сдано'}</p><p className="text-sm text-muted-foreground">{formatAssessmentDate(attempt!.started_at)} (МСК)</p></div>
          <Button variant="outline" size="sm" onClick={() => setParams({ attempt: attempt!.id })}>Результат</Button>
        </div>)}
        {!overview.isLoading && history.length === 0 ? <p className="text-sm text-muted-foreground">Официальных попыток пока нет.</p> : null}
      </section>
      <Link className="inline-block text-secondary hover:underline" to="/student/theory">Назад к теории</Link>
    </div>
  )
}
