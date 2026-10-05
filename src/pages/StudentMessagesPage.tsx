import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCircle2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'

interface MyMessageRpcRow {
  recipient_id: string
  message_id: string
  delivery_status: string
  created_at: string
  opened_at: string | null
  body: string
  message_created_at: string
  subject: string | null
}

interface StudentMessageItem {
  id: string
  message_id: string
  delivery_status: string
  created_at: string
  opened_at: string | null
  messages: {
    id: string
    body: string
    created_at: string
    message_threads: { subject: string | null }
  }
}

export function StudentMessagesPage() {
  const queryClient = useQueryClient()
  const { data: messages = [], isLoading, error } = useQuery({
    queryKey: ['my-messages'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_my_messages')
      if (error) throw error
      return ((data ?? []) as MyMessageRpcRow[]).map((item): StudentMessageItem => ({
        id: item.recipient_id,
        message_id: item.message_id,
        delivery_status: item.delivery_status,
        created_at: item.created_at,
        opened_at: item.opened_at,
        messages: {
          id: item.message_id,
          body: item.body,
          created_at: item.message_created_at,
          message_threads: { subject: item.subject },
        },
      }))
    },
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  })

  const markOpened = useMutation({
    mutationFn: async (messageId: string) => {
      const { error } = await supabase.rpc('mark_message_opened', { target_message_id: messageId })
      if (error) throw error
    },
    onSuccess: (_data, messageId) => {
      queryClient.setQueryData<any[]>(['my-messages'], (current = []) =>
        current.map((item) =>
          item.message_id === messageId
            ? { ...item, opened_at: item.opened_at ?? new Date().toISOString() }
            : item
        )
      )
      queryClient.setQueryData<number>(['unread-message-count'], (current = 0) => Math.max(0, current - 1))
      void queryClient.invalidateQueries({ queryKey: ['unread-message-count'] })
      void queryClient.invalidateQueries({ queryKey: ['my-messages'], refetchType: 'none' })
    },
  })

  if (isLoading) return <p className="text-sm text-muted-foreground">Загрузка сообщений...</p>
  if (error) return <p className="text-sm text-red-600">Не удалось загрузить сообщения.</p>

  return <div className="space-y-4">
    <div><h1 className="text-2xl font-bold text-primary">Сообщения</h1><p className="mt-1 text-sm text-muted-foreground">Уведомления и сообщения от автошколы.</p></div>
    {messages.length === 0 ? <div className="rounded-xl border border-border bg-white p-6 text-center text-muted-foreground"><Bell className="mx-auto mb-2 h-6 w-6" />Сообщений пока нет.</div> :
      <div className="space-y-3">{messages.map((item) => <article key={item.id} className="rounded-xl border border-border bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold text-primary">{item.messages?.message_threads?.subject || 'Без заголовка'}</h2><p className="mt-1 text-xs text-muted-foreground">{new Date(item.messages?.created_at || item.created_at).toLocaleString('ru-RU')}</p></div>
        {item.opened_at ? <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><CheckCircle2 className="h-3.5 w-3.5" />Прочитано</span> : <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700">Новое</span>}</div>
        <p className="mt-3 whitespace-pre-wrap text-sm">{item.messages?.body || 'Текст сообщения недоступен'}</p>
        {!item.opened_at && item.message_id ? <Button className="mt-3" size="sm" variant="outline" onClick={() => markOpened.mutate(item.message_id)} isLoading={markOpened.isPending}>Отметить прочитанным</Button> : null}
      </article>)}</div>}
  </div>
}
