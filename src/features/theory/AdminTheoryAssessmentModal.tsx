import { useEffect, useRef, useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { pddTopics } from '@/pages/pddTopics'
import type { Profile, TheoryAssessmentKind } from '@/types'
import {
  assessmentKindLabels, formatAssessmentDate, getAssessmentError, INTERNAL_EXAM_RULES,
  moscowInputToIso, toMoscowDateTimeInput,
} from './assessments'
import {
  useAssignTheoryAssessment, useCancelTheoryAssessment,
  useTheoryAssessments, useTheoryAssessmentAttempts,
} from './useTheoryAssessments'

export function AdminTheoryAssessmentModal({ student, onClose }: { student: Profile; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const submitting = useRef(false)
  const assignmentId = useRef(crypto.randomUUID())
  const { data: assessments = [], isLoading, error: loadError, refetch } = useTheoryAssessments(student.id)
  const { data: attempts = [], isLoading: attemptsLoading, error: attemptsError, refetch: refetchAttempts } = useTheoryAssessmentAttempts(student.id)
  const assign = useAssignTheoryAssessment()
  const cancel = useCancelTheoryAssessment(student.id)
  const [kind, setKind] = useState<TheoryAssessmentKind | null>(null)
  const [topicIds, setTopicIds] = useState<string[]>([])
  const [questionCount, setQuestionCount] = useState('20')
  const [timeLimit, setTimeLimit] = useState('20')
  const [maxErrors, setMaxErrors] = useState('2')
  const [opensAt, setOpensAt] = useState(() => toMoscowDateTimeInput(new Date()))
  const [deadlineAt, setDeadlineAt] = useState(() => toMoscowDateTimeInput(new Date(Date.now() + 7 * 86400_000)))
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [cancelId, setCancelId] = useState<string | null>(null)
  const busy = assign.isPending || cancel.isPending
  const loading = isLoading || attemptsLoading
  const queryError = loadError || attemptsError

  useEffect(() => {
    const dialog = dialogRef.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!kind || submitting.current || busy) return
    setError(null)
    setSuccess(null)
    const rules = kind === 'internal_exam' ? INTERNAL_EXAM_RULES : {
      questionCount: Number(questionCount), timeLimitMinutes: Number(timeLimit), maxErrors: Number(maxErrors),
    }
    if (kind === 'credit' && topicIds.length === 0) {
      setError('Выберите хотя бы одну тему зачёта.')
      return
    }
    if (!Number.isInteger(rules.questionCount) || rules.questionCount < 1 || rules.questionCount > 800
      || !Number.isInteger(rules.timeLimitMinutes) || rules.timeLimitMinutes < 1 || rules.timeLimitMinutes > 180
      || !Number.isInteger(rules.maxErrors) || rules.maxErrors < 0 || rules.maxErrors >= rules.questionCount) {
      setError('Проверьте параметры: 1–800 вопросов, 1–180 минут, ошибок меньше количества вопросов.')
      return
    }
    submitting.current = true
    try {
      const opensAtIso = moscowInputToIso(opensAt)
      const deadlineAtIso = moscowInputToIso(deadlineAt)
      if (deadlineAtIso <= opensAtIso || new Date(deadlineAtIso).getTime() <= Date.now()) {
        setError('Крайний срок должен быть позже открытия и текущего времени.')
        return
      }
      await assign.mutateAsync({
        id: assignmentId.current, studentId: student.id, kind,
        topicIds: kind === 'credit' ? topicIds : [], ...rules,
        opensAt: opensAtIso, deadlineAt: deadlineAtIso,
      })
      assignmentId.current = crypto.randomUUID()
      setKind(null)
      setSuccess('Тестирование назначено. Настройки и сроки сохранены.')
    } catch (cause) {
      setError(getAssessmentError(cause))
    } finally {
      submitting.current = false
    }
  }

  async function confirmCancel(id: string) {
    if (submitting.current || busy) return
    submitting.current = true
    setError(null)
    setSuccess(null)
    try {
      await cancel.mutateAsync(id)
      setCancelId(null)
      setSuccess('Назначение отменено. Запись сохранена в истории.')
    } catch (cause) {
      setError(getAssessmentError(cause))
    } finally {
      submitting.current = false
    }
  }

  return (
    <dialog ref={dialogRef} aria-labelledby="theory-assessment-title"
      onCancel={(event) => { event.preventDefault(); if (!busy) onClose() }}
      className="m-auto max-h-[92vh] w-[calc(100%-1.5rem)] max-w-2xl overflow-y-auto rounded-lg bg-white p-4 text-primary shadow-lg backdrop:bg-black/40 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="theory-assessment-title" className="text-lg font-semibold">Тестирование</h2>
          <p className="mt-1 break-words text-sm text-muted-foreground">{student.full_name || 'Без имени'}</p>
        </div>
        <Button variant="ghost" size="sm" className="h-8 w-8 shrink-0 px-0" aria-label="Закрыть тестирование" disabled={busy} onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {queryError ? (
        <div role="alert" className="mt-4 rounded-lg bg-danger/10 p-3 text-sm text-danger">
          {getAssessmentError(queryError)}
          <Button variant="outline" size="sm" className="mt-2 block" onClick={() => { void refetch(); void refetchAttempts() }}>Повторить загрузку</Button>
        </div>
      ) : null}
      {error ? <p role="alert" className="mt-4 rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</p> : null}
      {success ? <p role="status" className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm">{success}</p> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {(['credit', 'internal_exam'] as const).map((value) => (
          <Button key={value} variant={kind === value ? 'primary' : 'outline'} size="sm" disabled={busy || loading || !!queryError}
            onClick={() => { setKind(value); setError(null); setSuccess(null) }}>
            Назначить {value === 'credit' ? 'зачёт' : 'экзамен'}
          </Button>
        ))}
      </div>

      {kind ? (
        <form onSubmit={(event) => void handleSubmit(event)} className="mt-4 space-y-4 rounded-lg border border-border p-3">
          <h3 className="font-medium">{assessmentKindLabels[kind]}</h3>
          <fieldset disabled={busy} className="min-w-0 space-y-4">
            {kind === 'credit' ? (
              <>
                <div>
                  <p className="mb-2 text-sm font-medium">Темы зачёта ({topicIds.length})</p>
                  <div className="mb-2 flex gap-3">
                    <button type="button" className="text-sm text-secondary hover:underline" onClick={() => setTopicIds(pddTopics.map((topic) => topic.id))}>Выбрать все</button>
                    <button type="button" className="text-sm text-muted-foreground hover:underline" onClick={() => setTopicIds([])}>Снять выбор</button>
                  </div>
                  <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-border p-2">
                    {pddTopics.map((topic) => (
                      <label key={topic.id} className="flex items-start gap-2 text-sm">
                        <input type="checkbox" className="mt-1 shrink-0" checked={topicIds.includes(topic.id)}
                          onChange={(event) => setTopicIds((current) => event.target.checked ? [...current, topic.id] : current.filter((id) => id !== topic.id))} />
                        <span>{topic.title}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Input label="Вопросы" aria-label="Количество вопросов" type="number" min="1" max="800" step="1" required value={questionCount} onChange={(event) => setQuestionCount(event.target.value)} />
                  <Input label="Время, мин" aria-label="Время в минутах" type="number" min="1" max="180" step="1" required value={timeLimit} onChange={(event) => setTimeLimit(event.target.value)} />
                  <Input label="Допустимые ошибки" aria-label="Допустимые ошибки" type="number" min="0" max={Math.max(0, Number(questionCount) - 1)} step="1" required value={maxErrors} onChange={(event) => setMaxErrors(event.target.value)} />
                </div>
              </>
            ) : (
              <p className="rounded-lg bg-muted p-3 text-sm">Все темы · 20 вопросов · 20 минут · не более 2 ошибок. Параметры внутреннего экзамена фиксированы.</p>
            )}
            <p className="text-sm text-muted-foreground">Дата и время — по Москве (МСК, UTC+3).</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Открыть с" aria-label="Дата открытия по Москве" type="datetime-local" required value={opensAt} onChange={(event) => setOpensAt(event.target.value)} />
              <Input label="Пройти до" aria-label="Крайний срок по Москве" type="datetime-local" required min={opensAt} value={deadlineAt} onChange={(event) => setDeadlineAt(event.target.value)} />
            </div>
          </fieldset>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={() => { setKind(null); setError(null) }}>Закрыть форму</Button>
            <Button type="submit" isLoading={assign.isPending} disabled={busy || !!queryError}>Сохранить назначение</Button>
          </div>
        </form>
      ) : null}

      <div className="mt-5 space-y-3">
        <h3 className="font-medium">Назначения</h3>
        {loading ? <p className="text-sm text-muted-foreground">Загрузка…</p> : null}
        {!loading && !queryError && assessments.length === 0 ? <p className="text-sm text-muted-foreground">Тестирование ещё не назначено.</p> : null}
        {assessments.map((assessment) => {
          const attempt = attempts.find((item) => item.assessment_id === assessment.id)
          const expired = new Date(assessment.deadline_at).getTime() <= Date.now()
          const status = assessment.cancelled_at ? 'Отменено' : attempt ? 'Попытка создана' : expired ? 'Срок истёк' : new Date(assessment.opens_at).getTime() > Date.now() ? 'Назначено' : 'Открыто по срокам'
          return (
            <div key={assessment.id} className="space-y-2 rounded-lg border border-border p-3 text-sm">
              <div className="flex flex-wrap justify-between gap-2">
                <span className="font-medium">{assessmentKindLabels[assessment.kind]}</span>
                <span className="text-muted-foreground">{status}</span>
              </div>
              <p>{assessment.question_count} вопросов · {assessment.time_limit_minutes} мин · ошибок не более {assessment.max_errors}</p>
              <p className="text-muted-foreground">{formatAssessmentDate(assessment.opens_at)} — {formatAssessmentDate(assessment.deadline_at)} (МСК)</p>
              <details>
                <summary className="cursor-pointer text-muted-foreground">{assessment.kind === 'internal_exam' ? 'Все темы' : `Темы: ${assessment.topic_ids.length}`}</summary>
                <p className="mt-1">{(assessment.kind === 'internal_exam' ? pddTopics : pddTopics.filter((topic) => assessment.topic_ids.includes(topic.id))).map((topic) => topic.title).join('; ')}</p>
              </details>
              {!assessment.cancelled_at && !attempt && !expired && !queryError ? (
                cancelId === assessment.id ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span>Отменить назначение?</span>
                    <Button size="sm" variant="danger" disabled={busy} onClick={() => void confirmCancel(assessment.id)}>Да, отменить</Button>
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => setCancelId(null)}>Нет</Button>
                  </div>
                ) : <Button size="sm" variant="outline" disabled={busy || loading} onClick={() => setCancelId(assessment.id)}>Отменить назначение</Button>
              ) : null}
            </div>
          )
        })}
      </div>
      <div className="mt-5 border-t border-border pt-4">
        <h3 className="font-medium">История попыток</h3>
        {!loading && !queryError && attempts.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Официальных попыток пока нет.</p> : null}
        {attempts.map((attempt) => (
          <p key={attempt.id} className="mt-2 text-sm">
            {formatAssessmentDate(attempt.started_at)} (МСК) · {attempt.status === 'running' ? 'В процессе' : attempt.passed ? 'Сдано' : 'Не сдано'}
            {attempt.error_count !== null ? ` · Ошибок: ${attempt.error_count}` : ''}
          </p>
        ))}
      </div>
    </dialog>
  )
}
