import { useState } from 'react'
import { supabase } from '@/lib/supabase'

type Publication = { section_id: string; revision_id: number | null }
type Revision = { id: number; section_id: string; blocks: unknown }
type AuditResult = { checked: number; total: number; issues: string[]; blocks: number; questions: number; images: number }
const EXPECTED = new Set([...Array.from({ length: 26 }, (_, i) => 's' + (i + 1)), 'signs', 'markup', 'dopusk', 'neispravnosti'])
const TYPES = new Set(['p', 'h2', 'img', 'motivation', 'topic', 'lead', 'quote', 'term', 'example', 'quiz', 'link'])
const LOCAL_IMAGE = /^img\/[a-zA-Z0-9_-]+\.png$/
const STORAGE_IMAGE = /^https:\/\/[^\s]+\/storage\/v1\/object\/public\/pdd-course-media\/uploads\/[a-zA-Z0-9_-]+\.(png|jpg|webp)$/
const LINK = /^https:\/\/[^\s]+$|^\/admin\/pdd\/preview\?section=(s(?:[1-9]|1\d|2[0-6])|signs|markup|dopusk|neispravnosti)$/

function auditSection(id: string, blocks: unknown, issues: string[], metrics: AuditResult) {
  if (!Array.isArray(blocks) || blocks.length === 0) {
    issues.push(id + ': пустая или некорректная публикация')
    return
  }
  metrics.blocks += blocks.length
  for (const [i, value] of blocks.entries()) {
    const at = id + ', блок ' + (i + 1)
    if (!value || typeof value !== 'object' || Array.isArray(value)) { issues.push(at + ': неверный блок'); continue }
    const block = value as Record<string, unknown>
    if (typeof block.type !== 'string' || !TYPES.has(block.type)) { issues.push(at + ': неизвестный тип'); continue }
    if (block.type === 'img') {
      metrics.images++
      if (typeof block.src !== 'string' || !(LOCAL_IMAGE.test(block.src) || STORAGE_IMAGE.test(block.src)))
        issues.push(at + ': неверный адрес картинки')
    }
    if (block.type === 'link' && (typeof block.url !== 'string' || !LINK.test(block.url)))
      issues.push(at + ': неверная ссылка')
    if (block.type === 'quiz') {
      if (!Array.isArray(block.questions) || block.questions.length === 0) { issues.push(at + ': нет вопросов'); continue }
      for (const [j, item] of block.questions.entries()) {
        metrics.questions++
        if (!item || typeof item !== 'object' || Array.isArray(item)) { issues.push(at + ': неверный вопрос ' + (j + 1)); continue }
        const q = item as Record<string, unknown>
        if (typeof q.q !== 'string' || !q.q.trim() ||
          !Array.isArray(q.options) || q.options.length < 2 ||
          !q.options.every(o => typeof o === 'string' && o.trim()) ||
          typeof q.correct !== 'number' || !Number.isInteger(q.correct) ||
          q.correct < 0 || q.correct >= q.options.length) {
          issues.push(at + ': ошибка в вопросе ' + (j + 1))
        }
      }
    }
  }
}

export function PddPublishedAudit() {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<AuditResult | null>(null)

  async function runAudit() {
    setBusy(true)
    setResult(null)
    try {
      const { data: pointers, error: pointerError } = await supabase.from('pdd_course_publications')
        .select('section_id,revision_id')
      if (pointerError) throw pointerError
      const pubs = (pointers ?? []) as Publication[]
      const ids = pubs.map(p => p.section_id)
      const issues: string[] = []
      const metrics: AuditResult = { checked: 0, total: EXPECTED.size, issues, blocks: 0, questions: 0, images: 0 }
      for (const id of EXPECTED) if (!ids.includes(id)) issues.push(id + ': нет опубликованной версии')
      for (const id of ids) if (!EXPECTED.has(id)) issues.push(id + ': неожиданный раздел')
      const revisionIds = pubs.map(p => p.revision_id).filter((x): x is number => typeof x === 'number')
      const { data: revisions, error: revisionError } = revisionIds.length
        ? await supabase.from('pdd_course_published_revisions').select('id,section_id,blocks').in('id', revisionIds)
        : { data: [] as Revision[], error: null }
      if (revisionError) throw revisionError
      const byId = new Map(((revisions ?? []) as Revision[]).map(r => [r.id, r]))
      for (const pub of pubs) {
        if (!EXPECTED.has(pub.section_id)) continue
        const rev = pub.revision_id === null ? undefined : byId.get(pub.revision_id)
        if (!rev || rev.section_id !== pub.section_id) {
          issues.push(pub.section_id + ': версия публикации не найдена')
          continue
        }
        metrics.checked++
        auditSection(pub.section_id, rev.blocks, issues, metrics)
      }
      setResult(metrics)
    } catch (error) {
      setResult({ checked: 0, total: EXPECTED.size, issues: [
        'Ошибка чтения Supabase: ' + (error instanceof Error ? error.message : String(error))
      ], blocks: 0, questions: 0, images: 0 })
    } finally {
      setBusy(false)
    }
  }

  return <section className="rounded-xl border bg-white p-4 space-y-3">
    <h2 className="font-semibold">Проверка опубликованного курса</h2>
    <p className="text-sm text-muted-foreground">Проверяются только текущие опубликованные версии 30 разделов в Supabase. Данные не изменяются.</p>
    <button type="button" className="rounded bg-sky-700 px-3 py-2 text-sm text-white" disabled={busy}
      onClick={() => void runAudit()}>{busy ? 'Проверяем...' : 'Проверить 30 публикаций'}</button>
    {result && <div role="status" className="space-y-2 text-sm">
      <p><strong>{result.issues.length ? 'Есть проблемы' : 'Структура публикаций проверена'}</strong> — {result.checked}/{result.total} разделов; {result.blocks} блоков; {result.questions} вопросов; {result.images} изображений.</p>
      {result.issues.length > 0 && <ul className="list-disc space-y-1 pl-5 text-red-700">
        {result.issues.slice(0, 50).map((issue, i) => <li key={i}>{issue}</li>)}
        {result.issues.length > 50 && <li>И ещё {result.issues.length - 50} ошибок</li>}
      </ul>}
      <p className="text-muted-foreground">Проверка не подтверждает HTTP-доступность всех файлов, юридическую актуальность ПДД и готовность ученического интерфейса.</p>
    </div>}
  </section>
}
