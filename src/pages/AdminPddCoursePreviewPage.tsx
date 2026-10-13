import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { PddDraftEditor } from '@/components/PddDraftEditor'

type Question = { q: string; options: string[]; correct: number; explain?: string }
type Block = {
  type: string; text?: string; title?: string; src?: string; w?: number; h?: number
  term?: string; def?: string; good?: boolean; intro?: string; questions?: Question[]; url?: string; label?: string
}
type Section = { id: string; title: string; blocks: Block[] }
type Course = { title: string; subtitle?: string; sections: Section[] }

// This page is admin-only. It reads the staged snapshot, not live pdd_articles.
// Images are intentionally displayed from the pinned source repository until
// the separately prepared media archive is installed and verified.
const SOURCE_MEDIA = 'https://raw.githubusercontent.com/motostrelok1/edu.dvizh-teory/d431cc760d8ba4ebdee2824e595436dc8cc56bd2/public/'

function PreviewQuiz({ block }: { block: Block }) {
  const [answers, setAnswers] = useState<Record<number, number>>({})
  return (
    <section className="space-y-4 rounded-xl border border-sky-200 bg-sky-50 p-4">
      <h3 className="font-semibold">Проверьте себя</h3>
      {block.intro && <p className="text-sm">{block.intro}</p>}
      {(block.questions ?? []).map((q, index) => {
        const selected = answers[index]
        return (
          <fieldset className="space-y-2 rounded-lg border bg-white p-3" key={index}>
            <legend className="font-medium">{index + 1}. {q.q}</legend>
            {q.options.map((answer, ai) => (
              <label key={ai} className="flex cursor-pointer items-start gap-2 text-sm">
                <input type="radio" name={`preview-${index}`} checked={selected === ai}
                  onChange={() => setAnswers(prev => ({ ...prev, [index]: ai }))} />
                {answer}
              </label>
            ))}
            {selected !== undefined && (
              <p className={`text-sm ${selected === q.correct ? 'text-green-700' : 'text-red-700'}`}>
                {selected === q.correct ? 'Верно.' : 'Неверно.'} {q.explain}
              </p>
            )}
          </fieldset>
        )
      })}
      <p className="text-xs text-muted-foreground">Только предпросмотр. Ответы не записываются в профиль курсанта.</p>
    </section>
  )
}

function PreviewBlock({ block }: { block: Block }) {
  switch (block.type) {
    case 'topic': case 'h2':
      return <h2 className="mt-6 text-xl font-semibold">{block.text}</h2>
    case 'motivation':
      return <aside className="rounded-xl border-l-4 border-sky-500 bg-sky-50 p-4 whitespace-pre-line">{block.text}</aside>
    case 'lead':
      return <p className="rounded-lg bg-slate-50 p-3 whitespace-pre-line">{block.text}</p>
    case 'quote':
      return <blockquote className="border-l-4 border-slate-400 pl-4 whitespace-pre-line italic">{block.text}</blockquote>
    case 'term':
      return <div className="rounded-lg border p-3"><strong>{block.term}</strong><p className="mt-1 whitespace-pre-line">{block.def}</p></div>
    case 'example':
      return <div className={`rounded-lg border p-3 ${block.good ? 'bg-green-50' : 'bg-amber-50'}`}>
        <h3 className="font-semibold">{block.title}</h3><p className="mt-2 whitespace-pre-line">{block.text}</p>
      </div>
    case 'img': {
      const valid = /^img\/[a-zA-Z0-9_-]+\.png$/.test(block.src ?? '')
      const stored = /^https:\/\/[^\s]+\/storage\/v1\/object\/public\/pdd-course-media\/uploads\/[a-zA-Z0-9_-]+\.(png|jpg|webp)$/.test(block.src ?? '')
      return <figure className="my-4 text-center">
        {valid || stored
          ? <img loading="lazy" className="mx-auto h-auto max-w-full rounded" width={block.w} height={block.h}
              src={valid ? SOURCE_MEDIA + block.src : block.src} alt="Иллюстрация к лекции ПДД" />
          : <p className="text-red-600">Неподдерживаемый путь изображения</p>}
        <figcaption className="text-xs text-muted-foreground">Предпросмотр: изображение из исходного репозитория</figcaption>
      </figure>
    }
    case 'link': {
      const internal = /^\/admin\/pdd\/preview\?section=(s(?:[1-9]|1[0-9]|2[0-6])|signs|markup|dopusk|neispravnosti)$/.test(block.url ?? '')
      const safe = /^https:\/\/[^\s]+$/.test(block.url ?? '') || internal
      return safe
        ? <p><a className="text-sky-700 underline" href={block.url} rel="noopener noreferrer" target={internal ? "_self" : "_blank"}>{block.label || block.url}</a></p>
        : <p className="text-amber-700">Укажите корректную HTTPS-ссылку.</p>
    }
    case 'quiz':
      return <PreviewQuiz block={block} />
    case 'p':
      return <p className="whitespace-pre-line">{block.text}</p>
    default:
      return <p className="text-red-700">Неизвестный блок: {block.type}</p>
  }
}

export function AdminPddCoursePreviewPage() {
  const [course, setCourse] = useState<Course | null>(null)
  const [sectionId, setSectionId] = useState(() => {
    const requested = new URLSearchParams(window.location.search).get('section')
    return requested && /^(s([1-9]|1[0-9]|2[0-6])|signs|markup|dopusk|neispravnosti)$/.test(requested) ? requested : 's1'
  })
  const [error, setError] = useState('')
  const [drafts, setDrafts] = useState<Record<string, Block[]>>({})
  const [editing, setEditing] = useState(false)
  const [draftStatus, setDraftStatus] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    fetch('/course-import/sections.json', { signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error('Файл курса недоступен')
        return response.json() as Promise<Course>
      })
      .then(data => {
        if (!Array.isArray(data.sections) || data.sections.length !== 30) throw new Error('Ожидалось 30 разделов')
        setCourse(data)
      })
      .catch(err => { if (!controller.signal.aborted) setError(String(err)) })
    return () => controller.abort()
  }, [])
  const sourceSection = course?.sections.find(item => item.id === sectionId)
  const section = sourceSection && (drafts[sectionId]
    ? { ...sourceSection, blocks: drafts[sectionId] }
    : sourceSection)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('pdd-preview-draft-v1:' + sectionId)
      if (!saved) return
      const parsed: unknown = JSON.parse(saved)
      if (Array.isArray(parsed) && parsed.every(item => item && typeof item === 'object' && typeof item.type === 'string')) {
        setDrafts(prev => ({ ...prev, [sectionId]: parsed as Block[] }))
      }
    } catch {
      // Corrupted browser drafts must not interrupt source course preview.
    }
  }, [sectionId])

  function saveDraft() {
    if (!section) return
    try {
      localStorage.setItem('pdd-preview-draft-v1:' + sectionId, JSON.stringify(section.blocks))
      setDraftStatus('Черновик сохранён в этом браузере')
    } catch {
      setDraftStatus('Не удалось сохранить: возможно, недостаточно места в браузере')
    }
  }

  function resetDraft() {
    if (!window.confirm('Удалить локальный черновик текущего раздела?')) return
    localStorage.removeItem('pdd-preview-draft-v1:' + sectionId)
    setDrafts(prev => {
      const next = { ...prev }
      delete next[sectionId]
      return next
    })
    setDraftStatus('Черновик удалён')
  }
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-bold">Предпросмотр нового курса ПДД</h1>
      <Link to="/admin/pdd" className="text-sm text-sky-700 underline">К редактору ПДД</Link>
    </div>
    <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
      Только для администратора. 30 разделов из edu.dvizh-teory. Этот экран не публикует материалы и не меняет данные Supabase.
      Иллюстрации временно загружаются из исходного GitHub до переноса архива изображений на сайт.
    </p>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {!course && !error && <p>Загрузка курса...</p>}
    {course && <>
      <label className="block space-y-1">
        <span className="text-sm font-medium">Раздел ({course.sections.length})</span>
        <select value={sectionId} onChange={event => setSectionId(event.target.value)}
          className="w-full rounded-lg border bg-white p-3">
          {course.sections.map((s, i) => <option key={s.id} value={s.id}>{i + 1}. {s.title}</option>)}
        </select>
      </label>
      {section && <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="rounded border px-3 py-2 text-sm" onClick={() => setEditing(value => !value)}>
          {editing ? 'Скрыть редактор' : 'Редактировать черновик'}
        </button>
        <button type="button" className="rounded bg-sky-700 px-3 py-2 text-sm text-white" onClick={saveDraft}>Сохранить локально</button>
        <button type="button" className="rounded border px-3 py-2 text-sm" onClick={resetDraft}>Сбросить черновик</button>
        <span role="status" className="text-sm text-muted-foreground">{draftStatus}</span>
      </div>}
      {section && editing && <PddDraftEditor key={section.id} blocks={section.blocks}
        onChange={blocks => {
          setDrafts(prev => ({ ...prev, [sectionId]: blocks }))
          setDraftStatus('Есть несохранённые изменения')
        }} />}
      {section && <Card key={section.id}>
        <CardHeader><CardTitle>{section.title}</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          {section.blocks.map((block, index) => <PreviewBlock key={index} block={block} />)}
        </CardContent>
      </Card>}
    </>}
  </div>
}
