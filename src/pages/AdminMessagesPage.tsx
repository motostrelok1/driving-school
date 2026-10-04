import { useState } from 'react'
import { useAdminMessageRecipients, useAdminUserMessageHistory } from '@/features/admin/useAdmin'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { X } from 'lucide-react'

type Tab = 'notification' | 'message'

export function AdminMessagesPage() {
  const [tab, setTab] = useState<Tab>('notification')
  const [selected, setSelected] = useState<{ id: string; full_name: string | null } | null>(null)
  const { data: recipients = [], isLoading } = useAdminMessageRecipients(tab)
  const { data: history = [], isLoading: historyLoading } = useAdminUserMessageHistory(selected?.id)
  const filtered = history.filter((item) => item.messages?.message_type === tab)

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
            <button key={person.id} onClick={() => setSelected(person)} className="flex w-full items-center justify-between py-3 text-left">
              <span className="font-medium">{person.full_name || person.id}</span>
              <span className="text-sm text-muted-foreground">{new Date(person.last_at).toLocaleString('ru-RU')}</span>
            </button>
          )}</div>}
      </CardContent>
    </Card>
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
