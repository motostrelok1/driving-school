import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { PddDraftEditor } from '@/components/PddDraftEditor'
import { supabase } from '@/lib/supabase'

type Question = { q: string; options: string[]; correct: number; explain?: string }
type Block = {
  type: string; text?: string; title?: string; src?: string; w?: number; h?: number
  term?: string; def?: string; good?: boolean; intro?: string; questions?: Question[]; url?: string; label?: string; caption?: string; align?: 'left' | 'center' | 'right'
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
      return <figure className={`my-4 flex flex-col ${block.align === "left" ? "items-start" : block.align === "right" ? "items-end" : "items-center"}`}>
        {valid || stored
          ? <img loading="lazy" className="h-auto max-w-full rounded" width={block.w} height={block.h}
              src={valid ? SOURCE_MEDIA + block.src : block.src} alt="Иллюстрация к лекции ПДД" />
          : <p className="text-red-600">Неподдерживаемый путь изображения</p>}
        {block.caption?.trim() && <figcaption className="mt-2 max-w-full text-center text-sm text-muted-foreground whitespace-pre-line">{block.caption}</figcaption>}
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
  const [draftLoading, setDraftLoading] = useState(true)
  const [draftSaving, setDraftSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [publishBusy, setPublishBusy] = useState(false)
  const [publishedPreview, setPublishedPreview] = useState<Block[] | null>(null)
  const [publishedVersions, setPublishedVersions] = useState<Array<{ id: number; created_at: string }>>([])
  const [revisions, setRevisions] = useState<Array<{ id: number; saved_at: string; change_kind: string }>>([])
  const [historyLoading, setHistoryLoading] = useState(false)
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
    let active = true
    setDraftLoading(true)
    setDraftStatus('')
    setDirty(false)
    setPublishedPreview(null)
    void (async () => {
      const { data, error: loadError } = await supabase.from('pdd_course_drafts')
        .select('blocks').eq('section_id', sectionId).maybeSingle()
      if (!active) return
      if (loadError) {
        setDraftStatus('Не удалось прочитать серверный черновик: ' + loadError.message)
        setDraftLoading(false)
        return
      }
      if (data && Array.isArray(data.blocks)) {
        setDrafts(prev => ({ ...prev, [sectionId]: data.blocks as Block[] }))
        setDraftStatus('Загружен черновик из Supabase')
      } else {
        try {
          const saved = localStorage.getItem('pdd-preview-draft-v1:' + sectionId)
          const parsed: unknown = saved ? JSON.parse(saved) : null
          if (Array.isArray(parsed) && parsed.every(item =>
            item && typeof item === 'object' && typeof item.type === 'string')) {
            setDrafts(prev => ({ ...prev, [sectionId]: parsed as Block[] }))
            setDraftStatus('Найден старый локальный черновик. Нажмите «Сохранить в Supabase» для переноса.')
          } else {
            setDrafts(prev => { const next = { ...prev }; delete next[sectionId]; return next })
          }
        } catch { setDraftStatus('Локальный черновик повреждён') }
      }
      setDraftLoading(false)
    })()
    return () => { active = false }
  }, [sectionId])

  async function loadHistory() {
    setHistoryLoading(true)
    const { data, error: historyError } = await supabase.from('pdd_course_draft_revisions')
      .select('id,saved_at,change_kind').eq('section_id', sectionId)
      .order('id', { ascending: false }).limit(30)
    if (historyError) setDraftStatus('Не удалось загрузить историю: ' + historyError.message)
    else setRevisions(data ?? [])
    setHistoryLoading(false)
  }

  async function restoreRevision(revisionId: number) {
    if (dirty && !window.confirm('Несохранённые изменения будут заменены версией из истории. Продолжить?')) return
    const { data, error: revisionError } = await supabase.from('pdd_course_draft_revisions')
      .select('blocks').eq('id', revisionId).eq('section_id', sectionId).single()
    if (revisionError || !data || !Array.isArray(data.blocks)) {
      setDraftStatus('Не удалось восстановить версию: ' + (revisionError?.message ?? 'неверные данные'))
      return
    }
    setDrafts(prev => ({ ...prev, [sectionId]: data.blocks as Block[] }))
    setDirty(true)
    setEditing(true)
    setDraftStatus('Версия загружена в редактор. Нажмите «Сохранить в Supabase», чтобы применить.')
  }

  async function loadPublishedVersions() {
    const { data, error: versionError } = await supabase.from('pdd_course_published_revisions')
      .select('id,created_at').eq('section_id', sectionId).order('id', { ascending: false }).limit(30)
    if (versionError) setDraftStatus('Ошибка истории публикаций: ' + versionError.message)
    else setPublishedVersions(data ?? [])
  }

  async function previewPublishedRevision(id: number) {
    const { data, error: previewError } = await supabase.from('pdd_course_published_revisions')
      .select('blocks').eq('section_id', sectionId).eq('id', id).single()
    if (previewError || !data || !Array.isArray(data.blocks)) {
      setDraftStatus('Ошибка просмотра публикации: ' + (previewError?.message ?? 'некорректные блоки'))
      return
    }
    setPublishedPreview(data.blocks as Block[])
    setEditing(false)
    setDraftStatus('Показана опубликованная версия #' + id + '. Черновик не изменён.')
  }

  async function publishDraft() {
    if (dirty) { setDraftStatus('Сначала сохраните изменения в Supabase'); return }
    if (!window.confirm('Опубликовать сохранённый черновик в закрытом хранилище? Ученики пока не увидят эту версию.')) return
    setPublishBusy(true)
    const { error: publishError } = await supabase.rpc('publish_pdd_course_section', { p_section_id: sectionId })
    setDraftStatus(publishError ? 'Ошибка публикации: ' + publishError.message : 'Версия опубликована в закрытом хранилище. Курс ученикам не переключён.')
    if (!publishError) { void loadPublishedVersions(); setPublishedPreview(null) }
    setPublishBusy(false)
  }

  async function rollbackPublished(id: number) {
    if (!window.confirm('Создать новую опубликованную версию на основе выбранной?')) return
    setPublishBusy(true)
    const { error: rollbackError } = await supabase.rpc('rollback_pdd_course_section', {
      p_section_id: sectionId, p_revision_id: id
    })
    setDraftStatus(rollbackError ? 'Ошибка отката: ' + rollbackError.message : 'Опубликованная версия восстановлена. Черновик не менялся.')
    if (!rollbackError) { void loadPublishedVersions(); void previewPublishedRevision(id) }
    setPublishBusy(false)
  }

  async function saveDraft() {
    if (!section || draftSaving || draftLoading) return
    setDraftSaving(true)
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      setDraftStatus('Не удалось определить администратора')
      setDraftSaving(false)
      return
    }
    const { error: saveError } = await supabase.from('pdd_course_drafts').upsert({
      section_id: sectionId, blocks: section.blocks, updated_by: user.id
    }, { onConflict: 'section_id' })
    if (saveError) {
      setDraftStatus('Ошибка сохранения: ' + saveError.message)
    } else {
      localStorage.removeItem('pdd-preview-draft-v1:' + sectionId)
      setDirty(false)
      setDraftStatus('Черновик сохранён в Supabase')
      void loadHistory()
    }
    setDraftSaving(false)
  }

  async function resetDraft() {
    if (!window.confirm('Удалить серверный черновик раздела?')) return
    if (draftSaving || draftLoading) return
    setDraftSaving(true)
    const { error: deleteError } = await supabase.from('pdd_course_drafts')
      .delete().eq('section_id', sectionId)
    if (deleteError) {
      setDraftStatus('Не удалось удалить черновик: ' + deleteError.message)
    } else {
      localStorage.removeItem('pdd-preview-draft-v1:' + sectionId)
      setDrafts(prev => { const next = { ...prev }; delete next[sectionId]; return next })
      setDirty(false)
      setDraftStatus('Черновик удалён, восстановлена исходная лекция')
      void loadHistory()
    }
    setDraftSaving(false)
  }
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-bold">Предпросмотр нового курса ПДД</h1>
      <Link to="/admin/pdd" className="text-sm text-sky-700 underline">К редактору ПДД</Link>
    </div>
    <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
      Только для администратора. 30 разделов из edu.dvizh-teory. Этот экран не публикует материалы для курсантов. Черновики сохраняются в закрытой таблице Supabase.
      Иллюстрации временно загружаются из исходного GitHub до переноса архива изображений на сайт.
    </p>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {!course && !error && <p>Загрузка курса...</p>}
    {course && <>
      <label className="block space-y-1">
        <span className="text-sm font-medium">Раздел ({course.sections.length})</span>
        <select value={sectionId} onChange={event => { if (dirty && !window.confirm('Есть несохранённые изменения. Перейти без сохранения?')) return; setSectionId(event.target.value) }}
          className="w-full rounded-lg border bg-white p-3">
          {course.sections.map((s, i) => <option key={s.id} value={s.id}>{i + 1}. {s.title}</option>)}
        </select>
      </label>
      {section && <div className="flex flex-wrap items-center gap-2">
        <button type="button" aria-expanded={editing} aria-controls="pdd-course-draft-editor"
          className="rounded border px-3 py-2 text-sm"
          onClick={() => { setPublishedPreview(null); setEditing(current => !current) }}>
          {editing ? 'Скрыть редактор' : 'Редактировать черновик'}
        </button>
        {editing && <>
          <button type="button" className="rounded bg-sky-700 px-3 py-2 text-sm text-white" onClick={() => void saveDraft()} disabled={draftSaving || draftLoading}>Сохранить в Supabase</button>
          <button type="button" className="rounded border px-3 py-2 text-sm" onClick={() => void resetDraft()} disabled={draftSaving || draftLoading}>Удалить черновик</button>
        </>}
        <span role="status" className="text-sm text-muted-foreground">{draftStatus}</span>
        {!editing && dirty && <span className="text-sm text-amber-700">Есть несохранённые изменения в черновике</span>}
      </div>}
      {editing && <div id="pdd-course-draft-editor">
        {section && !draftLoading && <PddDraftEditor key={section.id} blocks={section.blocks}
          onChange={blocks => {
            setDrafts(prev => ({ ...prev, [sectionId]: blocks }))
            setDirty(true)
            setDraftStatus('Есть несохранённые изменения')
          }} />}
      </div>}
      {section && <details className="rounded-lg border p-3">
        <summary className="cursor-pointer font-medium" onClick={event => {
          if (!(event.currentTarget.parentElement as HTMLDetailsElement).open) void loadHistory()
        }}>История черновика</summary>
        {historyLoading && <p role="status">Загрузка истории...</p>}
        <div className="mt-3 space-y-2">
          {revisions.length === 0 && !historyLoading && <p className="text-sm text-muted-foreground">Сохранённых версий пока нет.</p>}
          {revisions.map(revision => <div key={revision.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-2 text-sm">
            <span>Версия #{revision.id} — {new Date(revision.saved_at).toLocaleString('ru-RU')} ({revision.change_kind === 'delete' ? 'перед удалением' : 'сохранение'})</span>
            <button type="button" className="rounded border px-3 py-1" onClick={() => void restoreRevision(revision.id)}>Загрузить в редактор</button>
          </div>)}
        </div>
      </details>}
      {section && <details className="rounded-lg border p-3">
        <summary className="cursor-pointer font-medium" onClick={event => {
          if (!(event.currentTarget.parentElement as HTMLDetailsElement).open) void loadPublishedVersions()
        }}>Публикации (пока недоступны курсантам)</summary>
        <div className="mt-3 space-y-3">
          <p className="text-sm text-muted-foreground">Публикация сохраняет отдельную версию в Supabase. Учебник курсантов не изменяется.</p>
          <button type="button" className="rounded bg-sky-700 px-3 py-2 text-sm text-white"
            disabled={publishBusy || draftLoading || draftSaving || dirty}
            onClick={() => void publishDraft()}>Опубликовать сохранённый черновик</button>
          {publishedVersions.map(version => <div key={version.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-2 text-sm">
            <span>Публикация #{version.id} — {new Date(version.created_at).toLocaleString('ru-RU')}</span>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="rounded border px-3 py-1" onClick={() => void previewPublishedRevision(version.id)}>Посмотреть</button>
              <button type="button" className="rounded border px-3 py-1" disabled={publishBusy}
                onClick={() => void rollbackPublished(version.id)}>Вернуть эту версию</button>
            </div>
          </div>)}
        </div>
      </details>}
      {publishedPreview && <div className="flex flex-wrap items-center gap-3 rounded border border-sky-300 bg-sky-50 p-3 text-sm"><strong>Просмотр опубликованной версии (не черновик)</strong><button type="button" className="rounded border bg-white px-3 py-1" onClick={() => setPublishedPreview(null)}>Вернуться к черновику</button></div>}
      {draftLoading && <p role="status">Загрузка черновика...</p>}
      {section && !draftLoading && <Card key={section.id}>
        <CardHeader><CardTitle>{section.title}</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          {(publishedPreview ?? section.blocks).map((block, index) => <PreviewBlock key={index} block={block} />)}
        </CardContent>
      </Card>}
    </>}
  </div>
}
