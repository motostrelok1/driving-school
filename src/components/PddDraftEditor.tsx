import { useState } from 'react'

type Block = {
  type: string
  text?: string
  title?: string
  term?: string
  def?: string
  src?: string
  intro?: string
  good?: boolean
}

export function PddDraftEditor({ blocks, onChange }: {
  blocks: Block[]
  onChange: (next: Block[]) => void
}) {
  const [selected, setSelected] = useState(0)
  const index = Math.min(selected, Math.max(0, blocks.length - 1))
  const active = blocks[index]

  function change(fields: Partial<Block>) {
    onChange(blocks.map((block, i) => i === index ? { ...block, ...fields } : block))
  }

  function move(direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= blocks.length) return
    const next = [...blocks]
    const temp = next[index]
    next[index] = next[target]
    next[target] = temp
    onChange(next)
    setSelected(target)
  }

  function add(type: 'p' | 'topic' | 'lead' | 'example') {
    const block: Block = type === 'example'
      ? { type, title: 'Новый пример', text: '', good: true }
      : { type, text: '' }
    onChange([...blocks, block])
    setSelected(blocks.length)
  }

  return <section className="space-y-4 rounded-xl border bg-white p-4">
    <h2 className="text-lg font-semibold">Редактор черновика</h2>
    <p className="text-sm text-muted-foreground">Изменения сохраняются только в этом браузере и не публикуются.</p>
    <div className="grid gap-4 lg:grid-cols-[minmax(190px,1fr)_minmax(0,2fr)]">
      <div className="space-y-2">
        <div className="max-h-80 space-y-1 overflow-auto">
          {blocks.map((block, i) => <button key={i} type="button" onClick={() => setSelected(i)}
            className={`block w-full rounded p-2 text-left text-sm ${i === index ? 'bg-sky-100' : 'hover:bg-slate-100'}`}>
            {i + 1}. {block.type}: {(block.text ?? block.title ?? block.src ?? '').slice(0, 32)}
          </button>)}
        </div>
        <div className="flex flex-wrap gap-2">
          {(['p', 'topic', 'lead', 'example'] as const).map(type =>
            <button key={type} type="button" className="rounded border px-2 py-1 text-sm"
              onClick={() => add(type)}>+ {type}</button>)}
        </div>
      </div>
      <div className="space-y-3">
        {!active ? <p>Добавьте блок.</p> : <>
          <p className="font-medium">Блок {index + 1}: {active.type}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="rounded border px-2 py-1" onClick={() => move(-1)} disabled={index === 0}>↑ Выше</button>
            <button type="button" className="rounded border px-2 py-1" onClick={() => move(1)} disabled={index === blocks.length - 1}>↓ Ниже</button>
            <button type="button" className="rounded border border-red-300 px-2 py-1 text-red-700"
              onClick={() => { onChange(blocks.filter((_, i) => i !== index)); setSelected(Math.max(0, index - 1)) }}>Удалить</button>
          </div>
          {(['text', 'title', 'term', 'def', 'intro', 'src'] as const)
            .filter(field => field in active)
            .map(field => <label key={field} className="block space-y-1 text-sm">
              <span className="font-medium">{field}</span>
              <textarea className="w-full rounded border p-2" rows={field === 'text' ? 6 : 2}
                value={active[field] ?? ''} onChange={event => change({ [field]: event.target.value })} />
            </label>)}
          {active.type === 'quiz' && <p className="text-sm text-amber-800">Вопросы пока доступны только для просмотра.</p>}
        </>}
      </div>
    </div>
  </section>
}
