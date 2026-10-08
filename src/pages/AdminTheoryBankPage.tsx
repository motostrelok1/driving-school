import { useRef, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { useImportTheoryBank, useSaveTheoryQuestion, useTheoryBank } from '@/features/theory/useTheoryBank'
import { getAssessmentError } from '@/features/theory/assessments'
import { pddTopics } from '@/pages/pddTopics'
import type { TheoryBankQuestion } from '@/types'

function BankEditor({ question, onClose }: { question: TheoryBankQuestion; onClose: () => void }) {
  const [text, setText] = useState(question.question_text)
  const [answers, setAnswers] = useState(question.answers)
  const [correct, setCorrect] = useState(question.correct_answer?.toString() ?? '')
  const [topics, setTopics] = useState(question.topic_ids)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const save = useSaveTheoryQuestion()
  const submitting = useRef(false)
  async function submit(event: FormEvent, approve: boolean) {
    event.preventDefault()
    if (submitting.current) return
    submitting.current = true
    setError(null); setSuccess(null)
    try {
      await save.mutateAsync({ id: question.id, text, answers, correctAnswer: correct ? Number(correct) : null, topicIds: topics, approve })
      setSuccess(approve ? 'Вопрос проверен и доступен для официального тестирования.' : 'Черновик сохранён. Вопрос исключён из новых официальных попыток.')
    } catch (cause) { setError(getAssessmentError(cause, '0035_theory_assessment_execution.sql')) }
    finally { submitting.current = false }
  }
  return (
    <Card><CardHeader><CardTitle>Билет {question.ticket_number}, вопрос {question.question_number}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">Сверьте текст, варианты и правильный ответ с учебным материалом. Одобрение разрешает использовать вопрос в официальных попытках.</p>
        {question.image_path ? <img src={question.image_path} alt="Исходный материал вопроса" className="max-h-96 w-full rounded-lg border border-border object-contain" /> : null}
        <form onSubmit={(event) => void submit(event, false)} className="space-y-4">
          <fieldset disabled={save.isPending} className="min-w-0 space-y-4">
            <label className="block text-sm font-medium">Текст вопроса<textarea aria-label="Текст вопроса" required value={text} onChange={(event) => setText(event.target.value)} className="mt-2 min-h-24 w-full rounded-lg border border-border p-3" /></label>
            {answers.map((answer, index) => <div key={answer.number} className="flex items-end gap-2"><Input label={`Ответ ${answer.number}`} aria-label={`Ответ ${answer.number}`} required value={answer.text} onChange={(event) => setAnswers((current) => current.map((item, i) => i === index ? { ...item, text: event.target.value } : item))} /><Button type="button" variant="outline" disabled={answers.length <= 2} onClick={() => { setAnswers((current) => current.filter((item) => item.number !== answer.number)); if (correct === String(answer.number)) setCorrect('') }}>Удалить</Button></div>)}
            <Button type="button" variant="outline" disabled={answers.length >= 10} onClick={() => setAnswers((current) => [...current, { number: Math.max(...current.map((item) => item.number)) + 1, text: '' }])}>Добавить вариант</Button>
            <label className="block text-sm font-medium">Правильный ответ
              <select aria-label="Правильный ответ" value={correct} onChange={(event) => setCorrect(event.target.value)} className="mt-2 h-10 w-full rounded-lg border border-border bg-white px-3">
                <option value="">Не указан</option>{answers.map((answer) => <option key={answer.number} value={answer.number}>{answer.number}. {answer.text}</option>)}
              </select>
            </label>
            <div><p className="mb-2 text-sm font-medium">Темы для промежуточных зачётов</p>
              <p className="mb-2 text-xs text-muted-foreground">Без выбранных тем вопрос доступен только для внутреннего экзамена.</p>
              <div className="max-h-52 space-y-2 overflow-y-auto rounded-lg border border-border p-3">
                {pddTopics.map((topic) => <label key={topic.id} className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={topics.includes(topic.id)} onChange={(event) => setTopics((current) => event.target.checked ? [...current, topic.id] : current.filter((id) => id !== topic.id))} /><span>{topic.title}</span></label>)}
              </div>
            </div>
          </fieldset>
          {error ? <p role="alert" className="rounded-lg bg-danger/10 p-3 text-danger">{error}</p> : null}
          {success ? <p role="status" className="rounded-lg border border-green-200 bg-green-50 p-3">{success}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="outline" disabled={save.isPending}>Сохранить черновик</Button>
            <Button type="button" disabled={save.isPending || !correct || !text.trim() || answers.some((item) => !item.text.trim())} onClick={(event) => void submit(event, true)}>Сохранить и одобрить</Button>
            <Button type="button" variant="outline" disabled={save.isPending} onClick={onClose}>Закрыть</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

export function AdminTheoryBankPage() {
  const { data: questions = [], isLoading, error, refetch } = useTheoryBank()
  const importer = useImportTheoryBank()
  const [filter, setFilter] = useState<'draft' | 'approved' | 'all'>('draft')
  const [ticket, setTicket] = useState('all')
  const [page, setPage] = useState(0)
  const [editing, setEditing] = useState<string | null>(null)
  const [importMessage, setImportMessage] = useState<string | null>(null)
  const importing = useRef(false)
  const selected = questions.find((question) => question.id === editing)
  const approved = questions.filter((question) => question.approved_at).length
  const visible = questions.filter((question) => (filter === 'all' || (filter === 'approved') === !!question.approved_at)
    && (ticket === 'all' || question.ticket_number === Number(ticket)))
  const slice = visible.slice(page * 20, (page + 1) * 20)
  async function importQuestions() {
    if (importing.current) return
    importing.current = true
    setImportMessage(null)
    try {
      const result = await importer.mutateAsync()
      setImportMessage(`Добавлено черновиков: ${result.inserted}. В исходном файле некорректных ключей: ${result.invalid_keys}. Существующие записи сохранены.`)
    } catch (cause) { setImportMessage(getAssessmentError(cause, '0035_theory_assessment_execution.sql')) }
    finally { importing.current = false }
  }
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-primary">Банк вопросов</h1>
      <p className="text-muted-foreground">Для официального тестирования используются только проверенные вопросы. Импорт создаёт черновики; правильные ответы и темы подтверждаются администратором.</p>
      <div className="flex flex-wrap items-center gap-3"><span>Всего: {questions.length} · Одобрено: {approved} · Черновики: {questions.length - approved}</span><Button variant="outline" isLoading={importer.isPending} disabled={!!error || isLoading} onClick={() => void importQuestions()}>Импортировать исходные билеты</Button></div>
      {importMessage ? <p role="status" className="rounded-lg border border-border p-3">{importMessage}</p> : null}
      {error ? <div role="alert" className="space-y-2 text-danger"><p>{getAssessmentError(error, '0035_theory_assessment_execution.sql')}</p><Button variant="outline" onClick={() => void refetch()}>Повторить</Button></div> : null}
      <div className="flex flex-wrap gap-3">
        <select aria-label="Статус вопросов" value={filter} onChange={(event) => { setFilter(event.target.value as typeof filter); setPage(0) }} className="h-10 rounded-lg border border-border bg-white px-3"><option value="draft">Черновики</option><option value="approved">Одобренные</option><option value="all">Все</option></select>
        <select aria-label="Билет" value={ticket} onChange={(event) => { setTicket(event.target.value); setPage(0) }} className="h-10 rounded-lg border border-border bg-white px-3"><option value="all">Все билеты</option>{Array.from({ length: 40 }, (_, index) => <option key={index} value={index + 1}>Билет {index + 1}</option>)}</select>
      </div>
      {selected ? <BankEditor key={selected.id} question={selected} onClose={() => setEditing(null)} /> : null}
      {isLoading ? <p>Загрузка банка…</p> : null}
      <div className="space-y-2">{slice.map((question) => <button key={question.id} type="button" className="block w-full rounded-lg border border-border p-3 text-left hover:bg-muted" onClick={() => setEditing(question.id)}><span className="block text-sm text-muted-foreground">Билет {question.ticket_number}, вопрос {question.question_number} · {question.approved_at ? 'Одобрен' : 'Черновик'}{question.correct_answer === null ? ' · Нет правильного ответа' : ''}</span><span className="block">{question.question_text}</span></button>)}</div>
      {!isLoading && !error && visible.length === 0 ? <p className="text-sm text-muted-foreground">Вопросов в этом списке пока нет.</p> : null}
      <div className="flex items-center justify-between gap-3"><Button variant="outline" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>Назад</Button><span className="text-sm">{page + 1} / {Math.max(1, Math.ceil(visible.length / 20))}</span><Button variant="outline" disabled={(page + 1) * 20 >= visible.length} onClick={() => setPage((value) => value + 1)}>Далее</Button></div>
    </div>
  )
}
