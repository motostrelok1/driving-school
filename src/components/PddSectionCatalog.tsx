import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export type CatalogEntry = { section_id: string; title: string; sort_order: number; is_archived: boolean }

export function PddSectionCatalog({ entries, onChange }: {
  entries: CatalogEntry[]; onChange: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [titles, setTitles] = useState<Record<string, string>>({})

  useEffect(() => {
    setTitles(Object.fromEntries(entries.map(item => [item.section_id, item.title])))
  }, [entries])

  async function changeEntry(section_id: string, changes: Partial<CatalogEntry>) {
    setBusy(true); setError('')
    const { error: updateError } = await supabase.from('pdd_course_catalog')
      .update(changes).eq('section_id', section_id)
    if (updateError) setError(updateError.message)
    else onChange()
    setBusy(false)
  }

  async function addSection() {
    const title = newTitle.trim()
    if (!title || title.length > 180) { setError('Укажите название длиной до 180 символов'); return }
    setBusy(true); setError('')
    const section_id = 'custom_' + crypto.randomUUID().replaceAll('-', '')
    const order = Math.max(0, ...entries.map(item => item.sort_order)) + 1
    const { error: insertError } = await supabase.from('pdd_course_catalog')
      .insert({ section_id, title, sort_order: order })
    if (insertError) setError(insertError.message)
    else { setNewTitle(''); onChange() }
    setBusy(false)
  }

  async function shift(entry: CatalogEntry, direction: -1 | 1) {
    const active = entries.filter(item => !item.is_archived)
    const i = active.findIndex(item => item.section_id === entry.section_id)
    const neighbor = active[i + direction]
    if (!neighbor) return
    setBusy(true); setError('')
    const first = await supabase.from('pdd_course_catalog')
      .update({ sort_order: neighbor.sort_order }).eq('section_id', entry.section_id)
    if (first.error) { setError(first.error.message); setBusy(false); return }
    const second = await supabase.from('pdd_course_catalog')
      .update({ sort_order: entry.sort_order }).eq('section_id', neighbor.section_id)
    if (second.error) setError('Не удалось завершить перестановку: ' + second.error.message)
    onChange(); setBusy(false)
  }

  return <section className="rounded-xl border bg-white p-4 space-y-3">
    <button type="button" className="font-semibold" aria-expanded={expanded}
      onClick={() => setExpanded(value => !value)}>
      {expanded ? '▾' : '▸'} Управление разделами
    </button>
    {expanded && <>
      <p className="text-sm text-muted-foreground">
        Переименуйте или переставьте темы, либо отправьте ненужную в архив. История публикаций сохраняется.
        Новый порядок пока действует только в административном каталоге, не в кабинете ученика.
      </p>
      <div className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-3">
        <input className="min-w-48 flex-1 rounded border p-2 text-sm" placeholder="Название нового раздела"
          aria-label="Название нового раздела" value={newTitle}
          onChange={event => setNewTitle(event.target.value)} maxLength={180}/>
        <button type="button" disabled={busy || !newTitle.trim()} className="rounded bg-sky-700 px-3 py-2 text-sm text-white"
          onClick={() => void addSection()}>+ Добавить раздел</button>
      </div>
      {entries.map(item => <div key={item.section_id} className="grid min-w-0 gap-2 border-b py-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="min-w-0 space-y-1">
          <span className="block truncate text-xs text-muted-foreground" title={item.section_id}>{item.section_id}</span>
          <input className="block w-full min-w-0 rounded border p-2 text-sm" aria-label={'Название ' + item.section_id}
          value={titles[item.section_id] ?? item.title}
          onChange={event => setTitles(prev => ({ ...prev, [item.section_id]: event.target.value }))}/>
        </div>
        <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={busy || !titles[item.section_id]?.trim()}
          className="rounded border px-2 py-1 text-sm"
          onClick={() => void changeEntry(item.section_id, { title: titles[item.section_id] })}>Сохранить название</button>
        {!item.is_archived && <>
          <button type="button" disabled={busy} className="rounded border px-2 py-1 text-sm"
            onClick={() => void shift(item, -1)}>↑</button>
          <button type="button" disabled={busy} className="rounded border px-2 py-1 text-sm"
            onClick={() => void shift(item, 1)}>↓</button>
        </>}
        <button type="button" disabled={busy} className="rounded border px-2 py-1 text-sm"
          onClick={() => {
            if (item.is_archived || window.confirm('Архивировать раздел? История сохранится.')) {
              void changeEntry(item.section_id, { is_archived: !item.is_archived })
            }
          }}>{item.is_archived ? 'Восстановить' : 'В архив'}</button>
        </div>
      </div>)}
      {error && <p role="alert" className="text-red-700 text-sm">{error}</p>}
      <p className="text-sm text-muted-foreground">Новые разделы начинают с пустого черновика. Публикация новых разделов будет включена отдельным этапом.</p>
    </>}
  </section>
}
