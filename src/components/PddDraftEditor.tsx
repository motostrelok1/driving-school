import { useState, type ChangeEvent } from 'react'
import { supabase } from '@/lib/supabase'

type Block = {
  type: string
  text?: string
  title?: string
  term?: string
  def?: string
  src?: string
  url?: string
  label?: string
  w?: number
  align?: 'left' | 'center' | 'right'
  intro?: string
  good?: boolean
}

export function PddDraftEditor({ blocks, onChange }: {
  blocks: Block[]
  onChange: (next: Block[]) => void
}) {
  const [selected, setSelected] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const index = Math.min(selected, Math.max(0, blocks.length - 1))
  const active = blocks[index]

  function change(fields: Partial<Block>) {
    onChange(blocks.map((block, i) => i === index ? { ...block, ...fields } : block))
  }

  async function uploadImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file || !active || active.type !== 'img') return
    event.target.value = ''
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) {
      setUploadError('Разрешены PNG, JPEG или WebP до 10 МБ')
      return
    }
    setUploading(true)
    setUploadError('')
    try {
      const extension = file.type === 'image/png' ? 'png' : file.type === 'image/jpeg' ? 'jpg' : 'webp'
      const path = `uploads/${crypto.randomUUID()}.${extension}`
      const { error } = await supabase.storage.from('pdd-course-media').upload(path, file, {
        contentType: file.type, upsert: false
      })
      if (error) throw error
      const result = supabase.storage.from('pdd-course-media').getPublicUrl(path)
      change({ src: result.data.publicUrl })
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Не удалось загрузить изображение')
    } finally {
      setUploading(false)
    }
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

  function add(type: 'p' | 'topic' | 'lead' | 'example' | 'img' | 'link') {
    const block: Block = type === 'example'
      ? { type, title: 'Новый пример', text: '', good: true }
      : type === 'img' ? { type, src: '', w: 320, align: 'center' }
      : type === 'link' ? { type, label: 'Название ссылки', url: '' }
      : { type, text: '' }
    onChange([...blocks.slice(0, index + 1), block, ...blocks.slice(index + 1)])
    setSelected(index + 1)
  }

  const names: Record<string, string> = {
    p: 'Текст', topic: 'Заголовок', lead: 'Пояснение',
    example: 'Пример', img: 'Изображение', link: 'Ссылка',
    quote: 'Цитата', term: 'Термин', quiz: 'Вопросы',
    motivation: 'Введение', h2: 'Подзаголовок'
  }

  return <section className="space-y-4 rounded-xl border bg-white p-4">
    <h2 className="text-lg font-semibold">Редактор черновика</h2>
    <p className="text-sm text-muted-foreground">Изменения сохраняются только в этом браузере и не публикуются.</p>
    <div className="grid gap-4 lg:grid-cols-[minmax(190px,1fr)_minmax(0,2fr)]">
      <div className="space-y-2">
        <div className="max-h-80 space-y-1 overflow-auto">
          {blocks.map((block, i) => <button key={i} type="button" onClick={() => setSelected(i)}
            className={`block w-full rounded p-2 text-left text-sm ${i === index ? 'bg-sky-100' : 'hover:bg-slate-100'}`}>
            {i + 1}. {names[block.type] ?? block.type}: {(block.text ?? block.title ?? block.src ?? '').slice(0, 32)}
          </button>)}
        </div>
        <div className="flex flex-wrap gap-2">
          {(['p', 'topic', 'lead', 'example', 'img', 'link'] as const).map(type =>
            <button key={type} type="button" className="rounded border px-2 py-1 text-sm"
              onClick={() => add(type)}>+ {names[type]}</button>)}
        </div>
      </div>
      <div className="space-y-3">
        {!active ? <p>Добавьте блок.</p> : <>
          <p className="font-medium">Блок {index + 1}: {names[active.type] ?? active.type}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="rounded border px-2 py-1" onClick={() => move(-1)} disabled={index === 0}>↑ Выше</button>
            <button type="button" className="rounded border px-2 py-1" onClick={() => move(1)} disabled={index === blocks.length - 1}>↓ Ниже</button>
            <button type="button" className="rounded border border-red-300 px-2 py-1 text-red-700"
              onClick={() => { onChange(blocks.filter((_, i) => i !== index)); setSelected(Math.max(0, index - 1)) }}>Удалить</button>
          </div>
          {(['text', 'title', 'term', 'def', 'intro', 'url', 'label'] as const)
            .filter(field => field in active)
            .map(field => <label key={field} className="block space-y-1 text-sm">
              <span className="font-medium">{{ text: 'Текст', title: 'Название', term: 'Термин', def: 'Определение', intro: 'Вступление', src: 'Путь изображения (img/...)', url: 'Адрес HTTPS', label: 'Текст ссылки' }[field]}</span>
              <textarea className="w-full rounded border p-2" rows={field === 'text' ? 6 : 2}
                value={active[field] ?? ''} onChange={event => change({ [field]: event.target.value })} />
            </label>)}
          {active.type === 'img' && <div className="space-y-3 rounded-lg border p-3">
            <p className="font-medium">Изображение</p>
            {active.src && <div className="rounded-lg bg-slate-50 p-2">
              <img alt="Миниатюра выбранного изображения" className="mx-auto max-h-48 max-w-full object-contain"
                src={/^img\/[a-zA-Z0-9_-]+\.png$/.test(active.src)
                  ? 'https://raw.githubusercontent.com/motostrelok1/edu.dvizh-teory/d431cc760d8ba4ebdee2824e595436dc8cc56bd2/public/' + active.src
                  : active.src} />
            </div>}
            <details className="text-sm"><summary className="cursor-pointer">Дополнительно: адрес изображения</summary>
              <textarea className="mt-2 w-full rounded border p-2" value={active.src ?? ''}
                onChange={event => change({ src: event.target.value })} rows={2} />
            </details>
            <label className="block text-sm font-medium">Загрузить изображение в Supabase Storage
              <input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading}
                onChange={event => void uploadImage(event)} className="mt-2 block w-full text-sm" />
            </label>
            {uploading && <p role="status">Загрузка...</p>}
            {uploadError && <p role="alert" className="text-sm text-red-700">{uploadError}</p>}
          </div>}
          {active.type === 'img' && <label className="block space-y-1 text-sm">
            <span className="font-medium">Ширина картинки (80–1000 пикселей)</span>
            <input className="w-full rounded border p-2" type="number" min={80} max={1000}
              value={active.w ?? 320} onChange={event => change({ w: Math.max(80, Math.min(1000, Number(event.target.value) || 320)) })} />
            <span className="block text-muted-foreground">Ширина применяется в предпросмотре. На мобильном изображение уменьшается автоматически.</span>
          </label>}
          {active.type === 'img' && <label className="block space-y-1 text-sm">
            <span className="font-medium">Выравнивание изображения</span>
            <select className="w-full rounded border bg-white p-2" value={active.align ?? 'center'}
              onChange={event => change({ align: event.target.value as 'left' | 'center' | 'right' })}>
              <option value="left">Слева</option><option value="center">По центру</option><option value="right">Справа</option>
            </select>
          </label>}
          {active.type === 'quiz' && <p className="text-sm text-amber-800">Вопросы пока доступны только для просмотра.</p>}
        </>}
      </div>
    </div>
  </section>
}
