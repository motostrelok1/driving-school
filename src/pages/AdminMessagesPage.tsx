import { useState, type FormEvent } from 'react'
import { useAdminMessageRecipients, useAdminUserMessageHistory } from '@/features/admin/useAdmin'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Send, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type Tab = 'notification' | 'message'

export function AdminMessagesPage() {
  const [tab, setTab] = useState<Tab>('notification')
  const [selected, setSelected] = useState<{ id: string; full_name: string | null } | null>(null)
  const [sendTo, setSendTo] = useState<{ id: string; full_name: string | null } | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [sendError, setSendError] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const { data: recipients = [], isLoading } = useAdminMessageRecipients(tab)
  const { data: history = [], isLoading: historyLoading } = useAdminUserMessageHistory(selected?.id)
  const filtered = history.filter((item) => item.messages?.message_type === tab)

  function openSend(person: { id: string; full_name: string | null }) {
    setSendTo(person)
    setTitle('')
    setBody('')
    setSendError(null)
  }

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!sendTo || isSending) return
    if (tab !== 'notification') {
      setSendError('Отправка сообщений с ответом будет добавлена на следующем этапе.')
      return
    }
    if (!title.trim() || !body.trim()) {
      setSendError('Заполните заголовок и текст уведомления.')
      return
    }

    setIsSending(true)
    setSendError(null)
    const { error } = await supabase.functions.invoke('send-push-notification', {
      body: { userId: sendTo.id, title: title.trim(), message: body.trim() },
    })
    setIsSending(false)

    if (error) {
      setSendError(error.message || 'Не удалось отправить уведомление.')
      return
    }

    setSendTo(null)
    setTitle('')
    setBody('')
    setToast('Уведомление отправлено и сохранено в истории.')
  }

  return <div className="space-y-6">
    <h1 className="text-2xl font-bold text-primary">Сообщения</h1>
    <div className="flex gap-2">
      <Button variant={tab === 'notification' ? 'primary' : 'outline'} onClick={() => { setTab('notification'); setSelected(null) }}>Уведомления</Button>
      <Button variant={tab === 'message' ? 'primary' : 'outline'} onClick={() => { setTab('message'); setSelected(null) }}>Сообщения</Button>
    </div>
    <Card>
      <CardHeader><CardTitle>{tab === 'notification' ? 'Получатели уведомлений' : 'Получатели сообщений'}</CardTitle></CardHeader>
      <CardContent>
        {isLoading ? <p>Загрузка...</p> : recipients.length === 0 ? <p className="text-muted-foreground">Пока ничего не отправлялось.</p> :
          <div className="divide-y divide-border">{recipients.map((person) =>
            <div key={person.id} className="flex items-center gap-3 py-3">
              <button onClick={() => setSelected(person)} className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left">
                <span className="truncate font-medium">{person.full_name || person.id}</span>
                <span className="shrink-0 text-sm text-muted-foreground">{new Date(person.last_at).toLocaleString('ru-RU')}</span>
              </button>
              <Button size="sm" variant="outline" onClick={() => openSend(person)}>
                <Send className="mr-1.5 h-4 w-4" />Отправить
              </Button>
            </div>
          )}</div>}
      </CardContent>
    </Card>
    {sendTo ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form onSubmit={handleSend} className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div><h2 className="text-xl font-bold">{tab === 'notification' ? 'Отправить уведомление' : 'Отправить сообщение'}</h2><p className="text-muted-foreground">{sendTo.full_name}</p></div>
          <button type="button" onClick={() => !isSending && setSendTo(null)}><X className="h-5 w-5" /></button>
        </div>
        <div className="mt-4 space-y-3">
          <label className="block text-sm font-medium">Заголовок<input className="mt-1 w-full rounded-lg border border-border px-3 py-2" value={title} onChange={(e) => setTitle(e.target.value)} required /></label>
          <label className="block text-sm font-medium">Текст {tab === 'notification' ? 'уведомления' : 'сообщения'}<textarea className="mt-1 min-h-32 w-full rounded-lg border border-border px-3 py-2" value={body} onChange={(e) => setBody(e.target.value)} required /></label>
        </div>
        {sendError ? <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{sendError}</p> : null}
        <div className="mt-5 flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setSendTo(null)} disabled={isSending}>Отмена</Button><Button type="submit" isLoading={isSending}>Отправить</Button></div>
      </form>
    </div> : null}
    {toast ? <div className="fixed bottom-4 right-4 z-50 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm shadow-lg">{toast}<button className="ml-3" onClick={() => setToast(null)}><X className="h-4 w-4" /></button></div> : null}
    {selected ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex justify-between gap-4">
          <div><h2 className="text-xl font-bold">{tab === 'notification' ? 'Уведомления' : 'Сообщения'}</h2><p className="text-muted-foreground">{selected.full_name}</p></div>
          <button onClick={() => setSelected(null)}><X className="h-5 w-5" /></button>
        </div>
        {historyLoading ? <p>Загрузка...</p> : filtered.length === 0 ? <p>История пуста.</p> :
          <div className="space-y-3">{filtered.map((item) => <div key={item.id} className="rounded-xl border border-border p-4">
            <div className="mb-2 flex justify-between gap-3">
              <strong>{item.messages?.message_threads?.subject || (tab === 'notification' ? 'Уведомление' : 'Сообщение')}</strong>
              <Badge variant={item.delivery_status === 'error' ? 'danger' : 'secondary'}>{item.opened_at ? 'Прочитано' : item.delivery_status === 'sending' ? 'Отправляется' : item.delivery_status === 'sent' ? 'Отправлено' : item.delivery_status === 'delivered' ? 'Доставлено' : 'Ошибка'}</Badge>
            </div>
            <p className="whitespace-pre-wrap">{item.messages?.body}</p>
            <p className="mt-2 text-sm text-muted-foreground">{new Date(item.created_at).toLocaleString('ru-RU')}</p>
          </div>)}</div>}
      </div>
    </div> : null}
  </div>
}
