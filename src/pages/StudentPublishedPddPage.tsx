import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

export type PddBlock = { type: string; text?: string; title?: string; term?: string; def?: string; good?: boolean; src?: string; w?: number; h?: number; caption?: string; align?: string; url?: string; label?: string; intro?: string; questions?: { q: string; options: string[]; correct: number; explain?: string }[] }
export type PddSection = { id: string; title: string; blocks: PddBlock[]; revision_id: number }
export function usePublishedPdd() {
  const [sections, setSections] = useState<PddSection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    void (async () => {
      const { data, error: readError } = await supabase.rpc('get_student_pdd_course')
      if (!active) return
      if (readError || !Array.isArray(data)) setError(readError?.message ?? 'Не удалось получить опубликованный курс')
      else setSections(data as PddSection[])
      setLoading(false)
    })()
    return () => { active = false }
  }, [])
  return { sections, loading, error }
}
const READ_KEY = 'read-pdd-published'
export function getReadPddIds() {
  try { const ids: unknown = JSON.parse(localStorage.getItem(READ_KEY) ?? '[]'); return Array.isArray(ids) ? ids.filter(x => typeof x === 'string') as string[] : [] }
  catch { return [] }
}
export function PddPublishedList({ sections }: { sections: PddSection[] }) {
  const read = getReadPddIds()
  return <div className="space-y-2">{sections.map((s, i) =>
    <Link key={s.id} to={'/student/theory/course/pdd/' + s.id}
      className="flex rounded-lg border bg-white p-3 text-sm hover:bg-slate-50">
      <span className="flex-1">{i + 1}. {s.title}</span>
      {read.includes(s.id) && <span className="text-green-700">✓ Прочитано</span>}
    </Link>)}</div>
}
function Quiz({ block }: { block: PddBlock }) {
  const [answers, setAnswers] = useState<Record<number, number>>({})
  return <section className="space-y-3 rounded-lg border bg-sky-50 p-4">
    <h3 className="font-semibold">Проверьте себя</h3>
    {block.intro && <p>{block.intro}</p>}
    {(block.questions ?? []).map((q, i) => <fieldset key={i} className="rounded border bg-white p-3">
      <legend>{i + 1}. {q.q}</legend>
      {q.options.map((answer, j) => <label key={j} className="block cursor-pointer py-1 text-sm">
        <input type="radio" name={'q-' + i} checked={answers[i] === j}
          onChange={() => setAnswers(a => ({ ...a, [i]: j }))}/> {answer}
      </label>)}
      {answers[i] !== undefined && <p className="text-sm">{answers[i] === q.correct ? 'Верно.' : 'Неверно.'} {q.explain}</p>}
    </fieldset>)}
    <p className="text-xs text-slate-500">Тренировочные вопросы. Результаты не влияют на экзамен.</p>
  </section>
}
function BlockView({ block }: { block: PddBlock }) {
  switch (block.type) {
    case 'topic': case 'h2': return <h2 className="text-xl font-semibold">{block.text}</h2>
    case 'p': return <p className="whitespace-pre-line">{block.text}</p>
    case 'lead': case 'motivation': return <p className="rounded bg-sky-50 p-3 whitespace-pre-line">{block.text}</p>
    case 'quote': return <blockquote className="border-l-4 pl-3 italic whitespace-pre-line">{block.text}</blockquote>
    case 'term': return <div><strong>{block.term}</strong><p className="whitespace-pre-line">{block.def}</p></div>
    case 'example': return <div className="rounded border p-3"><strong>{block.title}</strong><p className="whitespace-pre-line">{block.text}</p></div>
    case 'quiz': return <Quiz block={block}/>
    case 'img': {
      const local = /^img\/[A-Za-z0-9_-]+\.png$/.test(block.src ?? '')
      const stored = /^https:\/\/[^\s]+\/storage\/v1\/object\/public\/pdd-course-media\/uploads\/[A-Za-z0-9_-]+\.(png|jpg|webp)$/.test(block.src ?? '')
      return local || stored ? <figure className={'flex flex-col ' + (block.align === 'left' ? 'items-start' : block.align === 'right' ? 'items-end' : 'items-center')}>
        <img src={local ? '/course-import/' + block.src : block.src} alt={block.caption || 'Иллюстрация к ПДД'}
          width={block.w} height={block.h} loading="lazy" className="h-auto max-w-full rounded"/>
        {block.caption && <figcaption className="text-center text-sm text-slate-500">{block.caption}</figcaption>}
      </figure> : <p className="text-red-700">Изображение недоступно</p>
    }
    case 'link': {
      const internal = /^\/admin\/pdd\/preview\?section=(s(?:[1-9]|1[0-9]|2[0-6])|signs|markup|dopusk|neispravnosti|custom_[0-9a-f]{32})$/.exec(block.url ?? '')
      return internal ? <Link className="text-sky-700 underline" to={'/student/theory/course/pdd/' + internal[1]}>{block.label || 'Открыть раздел'}</Link>
        : block.url && /^https:\/\//.test(block.url)
          ? <a href={block.url} target="_blank" rel="noopener noreferrer" className="text-sky-700 underline">{block.label || block.url}</a>
          : <span>{block.label || 'Ссылка недоступна'}</span>
    }
    default: return null
  }
}
export function StudentPublishedPddPage() {
  const { sections, loading, error } = usePublishedPdd()
  return <div className="space-y-5">
    <h1 className="text-2xl font-bold">Правила дорожного движения</h1>
    {loading && <p>Загрузка учебника...</p>}
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {!loading && !error && <PddPublishedList sections={sections}/>}
    <Link to="/student/theory/course" className="text-sky-700 underline">Назад к курсу</Link>
  </div>
}
export function StudentPublishedPddTopicPage() {
  const { topicId } = useParams()
  const { sections, loading, error } = usePublishedPdd()
  const section = sections.find(s => s.id === topicId)
  useEffect(() => {
    if (!section) return
    const onScroll = () => {
      if (window.scrollY + window.innerHeight < document.documentElement.scrollHeight - 24) return
      const current = getReadPddIds()
      if (!current.includes(section.id)) {
        localStorage.setItem(READ_KEY, JSON.stringify([...current, section.id]))
        window.dispatchEvent(new Event('storage'))
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [section])
  return <div className="space-y-5">
    {loading && <p>Загрузка...</p>}
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {!loading && !error && !section && <p>Раздел не опубликован или находится в архиве.</p>}
    {section && <>
      <h1 className="text-2xl font-bold">{section.title}</h1>
      <article className="space-y-5 rounded-xl border bg-white p-4">
        {section.blocks.map((block, i) => <BlockView key={i} block={block}/>)}
      </article>
    </>}
    <Link to="/student/theory/course/pdd" className="text-sky-700 underline">Назад к разделам ПДД</Link>
  </div>
}
