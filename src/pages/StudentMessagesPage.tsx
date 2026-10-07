import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCircle2, MessageCircle, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/hooks/useAuth'

interface MyMessageRpcRow {
  recipient_id: string
  message_id: string
  delivery_status: string
  created_at: string
  opened_at: string | null
  body: string
  message_created_at: string
  subject: string | null
  thread_id: string | null
  message_type: 'notification' | 'message'
  allow_reply: boolean
  sender_id: string | null
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
    thread_id: string | null
    message_type: 'notification' | 'message'
    allow_reply: boolean
  }
}

interface ConversationRow {
  message_id: string
  sender_id: string | null
  body: string
  created_at: string
  allow_reply: boolean
}

export function StudentMessagesPage() {
  const initialTab = new URLSearchParams(window.location.search).get('tab') === 'message' ? 'message' : 'notification'
  const [tab, setTab] = useState<'notification' | 'message'>(initialTab)
  const [activeThread, setActiveThread] = useState<{ id: string; subject: string } | null>(null)
  const [replyBody, setReplyBody] = useState('')
  const [replyError, setReplyError] = useState<string | null>(null)
  const [isReplying, setIsReplying] = useState(false)
  const conversationEndRef = useRef<HTMLDivElement | null>(null)
  const queryClient = useQueryClient()
  const { user } = useAuth()

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
          thread_id: item.thread_id,
          message_type: item.message_type,
          allow_reply: item.allow_reply,
        },
      }))
    },
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  })

  const { data: conversation = [], isLoading: conversationLoading, refetch: refetchConversation } = useQuery({
    queryKey: ['my-conversation', activeThread?.id],
    queryFn: async () => {
      if (!activeThread?.id) return []
      const { data, error } = await supabase.rpc('get_my_conversation', { target_thread_id: activeThread.id })
      if (error) throw error
      return (data ?? []) as ConversationRow[]
    },
    enabled: !!activeThread?.id,
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

  const notificationMessages = messages.filter((item) => item.messages.message_type === 'notification')
  const chatThreads = useMemo(() => {
    const map = new Map<string, StudentMessageItem>()
    messages
      .filter((item) => item.messages.message_type === 'message' && item.messages.thread_id)
      .forEach((item) => {
        const threadId = item.messages.thread_id as string
        const current = map.get(threadId)
        if (!current || new Date(item.messages.created_at).getTime() > new Date(current.messages.created_at).getTime()) {
          map.set(threadId, item)
        }
      })
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.messages.created_at).getTime() - new Date(a.messages.created_at).getTime()
    )
  }, [messages])

  useEffect(() => {
    if (tab !== 'message' || chatThreads.length === 0 || activeThread) return
    const threadId = new URLSearchParams(window.location.search).get('thread')
    if (!threadId) return

    const target = chatThreads.find((item) => item.messages.thread_id === threadId)
    if (!target) return

    void openChat(target)
    const url = new URL(window.location.href)
    url.searchParams.delete('thread')
    window.history.replaceState({}, '', url)
  }, [tab, chatThreads, activeThread])

  async function openChat(item: StudentMessageItem) {
    if (!item.messages.thread_id) return
    setActiveThread({
      id: item.messages.thread_id,
      subject: item.messages.message_threads.subject || 'Переписка с автошколой',
    })
    setReplyBody('')
    setReplyError(null)
    if (!item.opened_at) {
      await markOpened.mutateAsync(item.message_id).catch(() => undefined)
    }
  }

  useEffect(() => {
    if (!activeThread || conversationLoading) return
    requestAnimationFrame(() => {
      conversationEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    })
  }, [activeThread, conversation, conversationLoading])

  async function handleReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!activeThread?.id || !replyBody.trim() || isReplying) return

    setReplyError(null)
    setIsReplying(true)
    const { error } = await supabase.functions.invoke('send-push-notification', {
      body: {
        action: 'reply',
        threadId: activeThread.id,
        message: replyBody.trim(),
      },
    })
    setIsReplying(false)

    if (error) {
      setReplyError(error.message || 'Не удалось отправить ответ.')
      return
    }

    setReplyBody('')
    await refetchConversation()
    await queryClient.invalidateQueries({ queryKey: ['my-messages'] })
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Загрузка сообщений...</p>
  if (error) return <p className="text-sm text-red-600">Не удалось загрузить сообщения.</p>

  return <div className="space-y-4">
    <div>
      <h1 className="text-2xl font-bold text-primary">Сообщения</h1>
      <p className="mt-1 text-sm text-muted-foreground">Уведомления и переписка с автошколой.</p>
    </div>

    <div className="flex gap-2">
      <Button variant={tab === 'notification' ? 'primary' : 'outline'} onClick={() => setTab('notification')}>Уведомления</Button>
      <Button variant={tab === 'message' ? 'primary' : 'outline'} onClick={() => setTab('message')}>Переписка</Button>
    </div>

    {tab === 'notification' ? (
      notificationMessages.length === 0
        ? <div className="rounded-xl border border-border bg-white p-6 text-center text-muted-foreground"><Bell className="mx-auto mb-2 h-6 w-6" />Уведомлений пока нет.</div>
        : <div className="space-y-3">{notificationMessages.map((item) => <article key={item.id} className="rounded-xl border border-border bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-primary">{item.messages.message_threads.subject || 'Без заголовка'}</h2>
                <p className="mt-1 text-xs text-muted-foreground">{new Date(item.messages.created_at || item.created_at).toLocaleString('ru-RU')}</p>
              </div>
              {item.opened_at
                ? <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><CheckCircle2 className="h-3.5 w-3.5" />Прочитано</span>
                : <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700">Новое</span>}
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm">{item.messages.body || 'Текст сообщения недоступен'}</p>
            {!item.opened_at && item.message_id ? <div className="mt-3"><Button size="sm" variant="outline" onClick={() => markOpened.mutate(item.message_id)} isLoading={markOpened.isPending}>Отметить прочитанным</Button></div> : null}
          </article>)}</div>
    ) : (
      chatThreads.length === 0
        ? <div className="rounded-xl border border-border bg-white p-6 text-center text-muted-foreground"><MessageCircle className="mx-auto mb-2 h-6 w-6" />Переписки пока нет.</div>
        : <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
            {chatThreads.map((item, index) => <button
              key={item.messages.thread_id}
              onClick={() => void openChat(item)}
              className={`flex w-full items-center gap-3 p-4 text-left transition hover:bg-slate-50 ${index ? 'border-t border-border' : ''}`}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100"><MessageCircle className="h-5 w-5" /></div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <strong className="truncate">{item.messages.message_threads.subject || 'Переписка с автошколой'}</strong>
                  <span className="shrink-0 text-xs text-muted-foreground">{new Date(item.messages.created_at).toLocaleString('ru-RU')}</span>
                </div>
                <p className="mt-1 truncate text-sm text-muted-foreground">{item.messages.body}</p>
              </div>
              {!item.opened_at ? <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-500" /> : null}
            </button>)}
          </div>
    )}

    {activeThread ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-2 sm:p-4">
      <div className="flex h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate font-semibold text-primary">{activeThread.subject}</h2>
            <p className="text-xs text-muted-foreground">Переписка с автошколой</p>
          </div>
          <button onClick={() => setActiveThread(null)} aria-label="Закрыть"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto bg-slate-50 p-4">
          {conversationLoading ? <p className="text-sm text-muted-foreground">Загрузка переписки...</p> : conversation.map((item) => {
            const mine = item.sender_id === user?.id
            return <div key={item.message_id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[82%] rounded-2xl px-4 py-2 shadow-sm ${mine ? 'bg-primary text-white' : 'border border-border bg-white text-primary'}`}>
                <p className="whitespace-pre-wrap text-sm">{item.body}</p>
                <p className={`mt-1 text-[11px] ${mine ? 'text-white/70' : 'text-muted-foreground'}`}>{new Date(item.created_at).toLocaleString('ru-RU')}</p>
              </div>
            </div>
          })}
          <div ref={conversationEndRef} />
        </div>

        <form onSubmit={handleReply} className="border-t border-border bg-white p-3">
          {replyError ? <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{replyError}</p> : null}
          <div className="flex items-end gap-2">
            <textarea
              className="min-h-11 max-h-32 flex-1 resize-y rounded-xl border border-border px-3 py-2"
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              placeholder="Сообщение..."
              required
            />
            <Button type="submit" isLoading={isReplying} disabled={!replyBody.trim()}>Отправить</Button>
          </div>
        </form>
      </div>
    </div> : null}
  </div>
}
