import { useEffect, useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAdminUserMessageHistory, useAllUsers } from '@/features/admin/useAdmin'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { MessageCircle, Plus, Send, Users, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

type Tab = 'notification' | 'message'

interface ChatThread {
  thread_id: string
  subject: string | null
  is_group: boolean
  participant_ids: string[]
  participant_names: string[]
  last_message: string | null
  last_at: string | null
  unread_count: number
}

interface NotificationThread {
  thread_id: string
  subject: string | null
  is_group: boolean
  recipient_ids: string[]
  recipient_names: string[]
  body: string
  created_at: string
  recipient_count: number
}

interface ConversationItem {
  message_id: string
  sender_id: string | null
  sender_name: string | null
  body: string
  created_at: string
  allow_reply: boolean
}

export function AdminMessagesPage() {
  const initialTab = new URLSearchParams(window.location.search).get('tab') === 'message' ? 'message' : 'notification'
  const [tab, setTab] = useState<Tab>(initialTab)
  const [selectedNotificationUser, setSelectedNotificationUser] = useState<{ id: string; full_name: string | null } | null>(null)
  const [activeNotification, setActiveNotification] = useState<NotificationThread | null>(null)
  const [sendTo, setSendTo] = useState<{ id: string; full_name: string | null } | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [sendError, setSendError] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const [activeChat, setActiveChat] = useState<ChatThread | null>(null)
  const [conversation, setConversation] = useState<ConversationItem[]>([])
  const [conversationLoading, setConversationLoading] = useState(false)
  const [adminReply, setAdminReply] = useState('')
  const [showGroupParticipants, setShowGroupParticipants] = useState(false)

  const [newChatOpen, setNewChatOpen] = useState(false)
  const [newChatSearch, setNewChatSearch] = useState('')
  const [newNotificationOpen, setNewNotificationOpen] = useState(false)
  const [newNotificationMode, setNewNotificationMode] = useState<'personal' | 'group'>('personal')
  const [newNotificationUsers, setNewNotificationUsers] = useState<string[]>([])
  const [newNotificationSearch, setNewNotificationSearch] = useState('')
  const [newNotificationTitle, setNewNotificationTitle] = useState('')
  const [newNotificationBody, setNewNotificationBody] = useState('')
  const [newNotificationError, setNewNotificationError] = useState<string | null>(null)
  const [creatingNotification, setCreatingNotification] = useState(false)
  const [newChatMode, setNewChatMode] = useState<'personal' | 'group'>('personal')
  const [newChatUsers, setNewChatUsers] = useState<string[]>([])
  const [newChatTitle, setNewChatTitle] = useState('')
  const [newChatBody, setNewChatBody] = useState('')
  const [newChatError, setNewChatError] = useState<string | null>(null)
  const [creatingChat, setCreatingChat] = useState(false)

  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { data: allUsers = [] } = useAllUsers()
  const { data: notificationHistory = [], isLoading: notificationHistoryLoading } = useAdminUserMessageHistory(selectedNotificationUser?.id)

  const { data: notificationThreads = [], isLoading: notificationThreadsLoading, refetch: refetchNotificationThreads } = useQuery({
    queryKey: ['admin-notification-threads'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_admin_notification_threads')
      if (error) throw error
      return ((data ?? []) as NotificationThread[]).map((item) => ({
        ...item,
        recipient_ids: item.recipient_ids ?? [],
        recipient_names: item.recipient_names ?? [],
        recipient_count: Number(item.recipient_count ?? 0),
      }))
    },
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  })

  const { data: chats = [], isLoading: chatsLoading, refetch: refetchChats } = useQuery({
    queryKey: ['admin-chat-threads'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_admin_chat_threads')
      if (error) throw error
      return ((data ?? []) as ChatThread[]).map((item) => ({
        ...item,
        participant_ids: item.participant_ids ?? [],
        participant_names: item.participant_names ?? [],
        unread_count: Number(item.unread_count ?? 0),
      }))
    },
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: 5000,
  })

  const availableUsers = allUsers
    .filter((person) => person.role !== 'admin')
    .sort((a, b) => (a.full_name || a.email || '').localeCompare(b.full_name || b.email || '', 'ru'))

  const filteredNewChatUsers = availableUsers.filter((person) =>
    (person.full_name || person.email || '').toLocaleLowerCase('ru').includes(newChatSearch.trim().toLocaleLowerCase('ru'))
  )

  const filteredNewNotificationUsers = availableUsers.filter((person) =>
    (person.full_name || person.email || '').toLocaleLowerCase('ru').includes(newNotificationSearch.trim().toLocaleLowerCase('ru'))
  )


  function changeTab(next: Tab) {
    setTab(next)
    setSelectedNotificationUser(null)
    setActiveChat(null)
    const url = new URL(window.location.href)
    if (next === 'message') url.searchParams.set('tab', 'message')
    else url.searchParams.delete('tab')
    window.history.replaceState({}, '', url)
  }

  useEffect(() => {
    if (tab !== 'message' || chats.length === 0 || activeChat) return
    const threadId = new URLSearchParams(window.location.search).get('thread')
    if (!threadId) return

    const target = chats.find((chat) => chat.thread_id === threadId)
    if (!target) return

    void openChat(target)
    const url = new URL(window.location.href)
    url.searchParams.delete('thread')
    window.history.replaceState({}, '', url)
  }, [tab, chats, activeChat])

  async function openChat(chat: ChatThread) {
    setActiveChat(chat)
    setConversationLoading(true)
    setAdminReply('')
    setShowGroupParticipants(false)

    if (chat.is_group) {
      const { error: openedError } = await supabase.rpc('mark_thread_opened', { target_thread_id: chat.thread_id })
      if (!openedError) {
        void queryClient.invalidateQueries({ queryKey: ['unread-message-count'] })
        void refetchChats()
      }
      const { data, error } = await supabase.rpc('get_admin_conversation', { target_thread_id: chat.thread_id })
      setConversation(error ? [] : ((data ?? []) as ConversationItem[]))
    } else {
      const participantId = chat.participant_ids[0]
      if (!participantId) {
        setConversation([])
        setConversationLoading(false)
        return
      }

      const { error: openedError } = await supabase.rpc('mark_admin_personal_chat_opened', {
        target_user_id: participantId,
      })
      if (!openedError) {
        void queryClient.invalidateQueries({ queryKey: ['unread-message-count'] })
        void refetchChats()
      }

      const { data, error } = await supabase.rpc('get_admin_personal_conversation', {
        target_user_id: participantId,
      })
      setConversation(error ? [] : ((data ?? []) as ConversationItem[]))
    }

    setConversationLoading(false)
  }

  async function sendAdminReply() {
    if (!activeChat || !adminReply.trim() || isSending) return
    setIsSending(true)
    const { error } = await supabase.functions.invoke('send-push-notification', {
      body: {
        userIds: activeChat.participant_ids,
        title: activeChat.subject || (activeChat.is_group ? 'Групповой чат' : 'Переписка'),
        message: adminReply.trim(),
        messageType: 'message',
        allowReply: true,
        threadId: activeChat.thread_id,
      },
    })
    setIsSending(false)
    if (error) {
      setToast(error.message)
      return
    }
    setAdminReply('')
    await openChat(activeChat)
    await refetchChats()
  }


  async function handleNotificationSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!sendTo || isSending || !title.trim() || !body.trim()) return
    setIsSending(true)
    setSendError(null)
    const { error } = await supabase.functions.invoke('send-push-notification', {
      body: {
        userId: sendTo.id,
        title: title.trim(),
        message: body.trim(),
        messageType: 'notification',
        allowReply: false,
        isGroup: newNotificationMode === 'group',
      },
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

  function toggleNewNotificationUser(userId: string) {
    if (newNotificationMode === 'personal') {
      setNewNotificationUsers([userId])
      return
    }
    setNewNotificationUsers((current) => current.includes(userId)
      ? current.filter((id) => id !== userId)
      : [...current, userId])
  }

  async function createNotification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const minUsers = newNotificationMode === 'group' ? 2 : 1
    if (newNotificationUsers.length < minUsers || !newNotificationTitle.trim() || !newNotificationBody.trim()) {
      setNewNotificationError(newNotificationMode === 'group'
        ? 'Выберите минимум двух получателей и заполните заголовок и текст.'
        : 'Выберите пользователя и заполните заголовок и текст.')
      return
    }

    setCreatingNotification(true)
    setNewNotificationError(null)
    const { error } = await supabase.functions.invoke('send-push-notification', {
      body: {
        userIds: newNotificationUsers,
        title: newNotificationTitle.trim(),
        message: newNotificationBody.trim(),
        messageType: 'notification',
        allowReply: false,
      },
    })
    setCreatingNotification(false)

    if (error) {
      setNewNotificationError(error.message || 'Не удалось отправить уведомление.')
      return
    }

    setNewNotificationOpen(false)
    setNewNotificationUsers([])
    setNewNotificationSearch('')
    setNewNotificationTitle('')
    setNewNotificationBody('')
    setToast('Уведомление отправлено.')
    void queryClient.invalidateQueries({ queryKey: ['admin-message-recipients', 'notification'] })
    await refetchNotificationThreads()
  }

  function toggleNewChatUser(userId: string) {
    if (newChatMode === 'personal') {
      setNewChatUsers([userId])
      return
    }
    setNewChatUsers((current) => current.includes(userId)
      ? current.filter((id) => id !== userId)
      : [...current, userId])
  }

  async function createChat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const minUsers = newChatMode === 'group' ? 2 : 1
    if (newChatUsers.length < minUsers || !newChatTitle.trim() || !newChatBody.trim()) {
      setNewChatError(newChatMode === 'group'
        ? 'Выберите минимум двух участников и заполните название и первое сообщение.'
        : 'Выберите пользователя и заполните название и первое сообщение.')
      return
    }

    setCreatingChat(true)
    setNewChatError(null)
    const { error } = await supabase.functions.invoke('send-push-notification', {
      body: {
        userIds: newChatUsers,
        title: newChatTitle.trim(),
        message: newChatBody.trim(),
        messageType: 'message',
        allowReply: true,
        isGroup: newChatMode === 'group',
      },
    })
    setCreatingChat(false)

    if (error) {
      setNewChatError(error.message || 'Не удалось создать чат.')
      return
    }

    setNewChatOpen(false)
    setNewChatUsers([])
    setNewChatTitle('')
    setNewChatBody('')
    await refetchChats()
  }

  const filteredNotificationHistory = notificationHistory.filter((item) => item.messages?.message_type === 'notification')

  return <div className="space-y-6">
    <div className="flex items-center justify-between gap-3">
      <h1 className="text-2xl font-bold text-primary">Переписка</h1>
      {tab === 'notification' ? <Button size="sm" onClick={() => {
        setNewNotificationMode('personal')
        setNewNotificationUsers([])
        setNewNotificationSearch('')
        setNewNotificationTitle('')
        setNewNotificationBody('')
        setNewNotificationError(null)
        setNewNotificationOpen(true)
      }}><Plus className="mr-1.5 h-4 w-4" />Новое уведомление</Button> : <Button size="sm" onClick={() => {
        setNewChatMode('personal')
        setNewChatUsers([])
        setNewChatSearch('')
        setNewChatTitle('')
        setNewChatBody('')
        setNewChatError(null)
        setNewChatOpen(true)
      }}><Plus className="mr-1.5 h-4 w-4" />Новый чат</Button>}
    </div>

    <div className="flex gap-2">
      <Button variant={tab === 'notification' ? 'primary' : 'outline'} onClick={() => changeTab('notification')}>Уведомления</Button>
      <Button variant={tab === 'message' ? 'primary' : 'outline'} onClick={() => changeTab('message')}>Переписка</Button>
    </div>

    {tab === 'notification' ? <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Уведомления</CardTitle>
          <span className="text-sm text-muted-foreground">{notificationThreads.length}</span>
        </div>
      </CardHeader>
      <CardContent>
        {notificationThreadsLoading ? <p>Загрузка...</p> : notificationThreads.length === 0 ? <div className="py-8 text-center text-muted-foreground">
          <p>Уведомлений пока нет.</p>
          <p className="mt-1 text-sm">Нажмите «Новое уведомление», чтобы отправить первое.</p>
        </div> : <div className="divide-y divide-border">
          {notificationThreads.map((notification) => <button
            key={notification.thread_id}
            onClick={() => setActiveNotification(notification)}
            className="flex w-full items-center gap-3 py-3 text-left hover:bg-slate-50"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100">
              {notification.is_group ? <Users className="h-5 w-5" /> : <Send className="h-5 w-5" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <strong className="truncate">{notification.is_group ? 'Групповое уведомление' : (notification.recipient_names[0] || 'Личное уведомление')}</strong>
                <span className="shrink-0 text-xs text-muted-foreground">{new Date(notification.created_at).toLocaleString('ru-RU')}</span>
              </div>
              <p className="truncate text-xs text-muted-foreground">{notification.subject || 'Без заголовка'}</p>
              <p className="mt-1 truncate text-sm text-muted-foreground">{notification.body}</p>
            </div>
            {notification.is_group ? <Badge variant="secondary">{notification.recipient_count}</Badge> : null}
          </button>)}
        </div>}
      </CardContent>
    </Card> : <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Чаты</CardTitle>
          <span className="text-sm text-muted-foreground">{chats.length}</span>
        </div>
      </CardHeader>
      <CardContent>
        {chatsLoading ? <p>Загрузка...</p> : chats.length === 0 ? <div className="py-8 text-center text-muted-foreground">
          <MessageCircle className="mx-auto mb-2 h-7 w-7" />
          <p>Переписок пока нет.</p>
          <p className="mt-1 text-sm">Нажмите «Новый чат», чтобы начать переписку.</p>
        </div> : <div className="divide-y divide-border">
          {chats.map((chat) => <button key={chat.thread_id} onClick={() => void openChat(chat)} className="flex w-full items-center gap-3 py-3 text-left hover:bg-slate-50">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100">
              {chat.is_group ? <Users className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <strong className="truncate">{chat.is_group ? (chat.subject || 'Групповой чат') : (chat.participant_names[0] || chat.subject || 'Переписка')}</strong>
                <span className="shrink-0 text-xs text-muted-foreground">{chat.last_at ? new Date(chat.last_at).toLocaleString('ru-RU') : ''}</span>
              </div>
              <p className="mt-1 truncate text-sm text-muted-foreground">{chat.last_message || 'Нет сообщений'}</p>
            </div>
            {chat.unread_count > 0 ? <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-bold text-white">{chat.unread_count > 9 ? '9+' : chat.unread_count}</span> : null}
          </button>)}
        </div>}
      </CardContent>
    </Card>}

    {activeNotification ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">{activeNotification.is_group ? 'Групповое уведомление' : 'Уведомление'}</h2>
            <p className="text-sm text-muted-foreground">{activeNotification.subject || 'Без заголовка'}</p>
          </div>
          <button onClick={() => setActiveNotification(null)}><X className="h-5 w-5" /></button>
        </div>
        {activeNotification.is_group ? <div className="mt-4 rounded-xl border border-border p-4">
          <p className="mb-2 text-sm font-semibold">Получатели ({activeNotification.recipient_count})</p>
          <div className="space-y-1 text-sm text-muted-foreground">
            {activeNotification.recipient_names.map((name) => <div key={name}>{name}</div>)}
          </div>
        </div> : <p className="mt-4 text-sm"><span className="font-medium">Получатель:</span> {activeNotification.recipient_names[0] || 'Не указан'}</p>}
        <div className="mt-4 rounded-xl border border-border p-4">
          <p className="whitespace-pre-wrap">{activeNotification.body}</p>
          <p className="mt-3 text-xs text-muted-foreground">{new Date(activeNotification.created_at).toLocaleString('ru-RU')}</p>
        </div>
      </div>
    </div> : null}

    {sendTo ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form onSubmit={handleNotificationSend} className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div><h2 className="text-xl font-bold">Отправить уведомление</h2><p className="text-muted-foreground">{sendTo.full_name}</p></div>
          <button type="button" onClick={() => !isSending && setSendTo(null)}><X className="h-5 w-5" /></button>
        </div>
        <div className="mt-4 space-y-3">
          <label className="block text-sm font-medium">Заголовок<input className="mt-1 w-full rounded-lg border border-border px-3 py-2" value={title} onChange={(e) => setTitle(e.target.value)} required /></label>
          <label className="block text-sm font-medium">Текст уведомления<textarea className="mt-1 min-h-32 w-full rounded-lg border border-border px-3 py-2" value={body} onChange={(e) => setBody(e.target.value)} required /></label>
        </div>
        {sendError ? <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{sendError}</p> : null}
        <div className="mt-5 flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setSendTo(null)} disabled={isSending}>Отмена</Button><Button type="submit" isLoading={isSending}>Отправить</Button></div>
      </form>
    </div> : null}

    {newNotificationOpen ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form onSubmit={createNotification} className="flex max-h-[90vh] w-full max-w-xl flex-col rounded-xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div><h2 className="text-xl font-bold">Новое уведомление</h2><p className="text-sm text-muted-foreground">Одному или нескольким пользователям</p></div>
          <button type="button" onClick={() => !creatingNotification && setNewNotificationOpen(false)}><X className="h-5 w-5" /></button>
        </div>
        <div className="mt-4 flex gap-2">
          <Button type="button" size="sm" variant={newNotificationMode === 'personal' ? 'primary' : 'outline'} onClick={() => { setNewNotificationMode('personal'); setNewNotificationUsers([]) }}>Личное</Button>
          <Button type="button" size="sm" variant={newNotificationMode === 'group' ? 'primary' : 'outline'} onClick={() => { setNewNotificationMode('group'); setNewNotificationUsers([]) }}>Групповое</Button>
        </div>
        <input
          className="mt-4 w-full rounded-lg border border-border px-3 py-2"
          value={newNotificationSearch}
          onChange={(e) => setNewNotificationSearch(e.target.value)}
          placeholder="Поиск по ФИО..."
        />
        <div className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-lg border border-border">
          {filteredNewNotificationUsers.map((person) => {
            const checked = newNotificationUsers.includes(person.id)
            return <label key={person.id} className="flex cursor-pointer items-center gap-3 border-b border-border px-3 py-2 last:border-b-0 hover:bg-slate-50">
              <input
                type={newNotificationMode === 'personal' ? 'radio' : 'checkbox'}
                name="notification-user"
                checked={checked}
                onChange={() => toggleNewNotificationUser(person.id)}
              />
              <span>{person.full_name || person.email || person.id}</span>
            </label>
          })}
        </div>
        <div className="mt-4 space-y-3">
          <label className="block text-sm font-medium">Заголовок<input className="mt-1 w-full rounded-lg border border-border px-3 py-2" value={newNotificationTitle} onChange={(e) => setNewNotificationTitle(e.target.value)} required /></label>
          <label className="block text-sm font-medium">Текст уведомления<textarea className="mt-1 min-h-24 w-full rounded-lg border border-border px-3 py-2" value={newNotificationBody} onChange={(e) => setNewNotificationBody(e.target.value)} required /></label>
        </div>
        {newNotificationError ? <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{newNotificationError}</p> : null}
        <div className="mt-5 flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setNewNotificationOpen(false)} disabled={creatingNotification}>Отмена</Button><Button type="submit" isLoading={creatingNotification}>Отправить</Button></div>
      </form>
    </div> : null}

    {newChatOpen ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form onSubmit={createChat} className="flex max-h-[90vh] w-full max-w-xl flex-col rounded-xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div><h2 className="text-xl font-bold">Новый чат</h2><p className="text-sm text-muted-foreground">Личная или групповая переписка</p></div>
          <button type="button" onClick={() => !creatingChat && setNewChatOpen(false)}><X className="h-5 w-5" /></button>
        </div>
        <div className="mt-4 flex gap-2">
          <Button type="button" size="sm" variant={newChatMode === 'personal' ? 'primary' : 'outline'} onClick={() => { setNewChatMode('personal'); setNewChatUsers([]) }}>Личный</Button>
          <Button type="button" size="sm" variant={newChatMode === 'group' ? 'primary' : 'outline'} onClick={() => { setNewChatMode('group'); setNewChatUsers([]) }}>Групповой</Button>
        </div>
        <input
          className="mt-4 w-full rounded-lg border border-border px-3 py-2"
          value={newChatSearch}
          onChange={(e) => setNewChatSearch(e.target.value)}
          placeholder="Поиск по ФИО..."
        />
        <div className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-lg border border-border">
          {filteredNewChatUsers.map((person) => {
            const checked = newChatUsers.includes(person.id)
            return <label key={person.id} className="flex cursor-pointer items-center gap-3 border-b border-border px-3 py-2 last:border-b-0 hover:bg-slate-50">
              <input
                type={newChatMode === 'personal' ? 'radio' : 'checkbox'}
                name="chat-user"
                checked={checked}
                onChange={() => toggleNewChatUser(person.id)}
              />
              <span>{person.full_name || person.email || person.id}</span>
            </label>
          })}
        </div>
        <div className="mt-4 space-y-3">
          <label className="block text-sm font-medium">{newChatMode === 'group' ? 'Название группы' : 'Тема чата'}<input className="mt-1 w-full rounded-lg border border-border px-3 py-2" value={newChatTitle} onChange={(e) => setNewChatTitle(e.target.value)} required /></label>
          <label className="block text-sm font-medium">Первое сообщение<textarea className="mt-1 min-h-24 w-full rounded-lg border border-border px-3 py-2" value={newChatBody} onChange={(e) => setNewChatBody(e.target.value)} required /></label>
        </div>
        {newChatError ? <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{newChatError}</p> : null}
        <div className="mt-5 flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setNewChatOpen(false)} disabled={creatingChat}>Отмена</Button><Button type="submit" isLoading={creatingChat}>Создать чат</Button></div>
      </form>
    </div> : null}

    {toast ? <div className="fixed bottom-4 right-4 z-50 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm shadow-lg">{toast}<button className="ml-3" onClick={() => setToast(null)}><X className="h-4 w-4" /></button></div> : null}

    {selectedNotificationUser ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex justify-between gap-4">
          <div><h2 className="text-xl font-bold">Уведомления</h2><p className="text-muted-foreground">{selectedNotificationUser.full_name}</p></div>
          <button onClick={() => setSelectedNotificationUser(null)}><X className="h-5 w-5" /></button>
        </div>
        {notificationHistoryLoading ? <p>Загрузка...</p> : filteredNotificationHistory.length === 0 ? <p>История пуста.</p> :
          <div className="space-y-3">{filteredNotificationHistory.map((item) => <div key={item.id} className="rounded-xl border border-border p-4">
            <div className="mb-2 flex justify-between gap-3">
              <strong>{item.messages?.message_threads?.subject || 'Уведомление'}</strong>
              <Badge variant={item.delivery_status === 'error' ? 'danger' : 'secondary'}>{item.opened_at ? 'Прочитано' : item.delivery_status === 'sending' ? 'Отправляется' : item.delivery_status === 'sent' ? 'Отправлено' : item.delivery_status === 'delivered' ? 'Доставлено' : 'Ошибка'}</Badge>
            </div>
            <p className="whitespace-pre-wrap">{item.messages?.body}</p>
            <p className="mt-2 text-sm text-muted-foreground">{new Date(item.created_at).toLocaleString('ru-RU')}</p>
          </div>)}</div>}
      </div>
    </div> : null}

    {activeChat ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-2 sm:p-4">
      <div className="flex h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate font-semibold text-primary">{activeChat.is_group ? (activeChat.subject || 'Групповой чат') : (activeChat.participant_names[0] || activeChat.subject || 'Переписка')}</h2>
            {activeChat.is_group ? (
              <button
                type="button"
                onClick={() => setShowGroupParticipants((value) => !value)}
                className="mt-0.5 text-left text-xs text-muted-foreground underline decoration-dotted underline-offset-2 hover:text-primary"
              >
                Групповой чат с: {activeChat.participant_names.length} участниками
              </button>
            ) : <p className="text-xs text-muted-foreground">Личная переписка</p>}
          </div>
          <button onClick={() => setActiveChat(null)} aria-label="Закрыть"><X className="h-5 w-5" /></button>
        </div>
        {activeChat.is_group && showGroupParticipants ? (
          <div className="border-b border-border bg-white px-4 py-3">
            <div className="rounded-xl border border-border p-4">
              <p className="mb-2 text-sm font-semibold">Участники ({activeChat.participant_names.length})</p>
              <div className="space-y-1 text-sm text-muted-foreground">
                {activeChat.participant_names.map((name) => <div key={name}>{name}</div>)}
              </div>
            </div>
          </div>
        ) : null}
        <div className="flex-1 space-y-2 overflow-y-auto bg-slate-50 p-4">
          {conversationLoading ? <p className="text-sm text-muted-foreground">Загрузка переписки...</p> : conversation.map((item) => {
            const mine = item.sender_id === user?.id
            return <div key={item.message_id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[82%] rounded-2xl px-4 py-2 shadow-sm ${mine ? 'bg-primary text-white' : 'border border-border bg-white text-primary'}`}>
                {!mine && activeChat.is_group ? <p className="mb-1 text-[11px] font-semibold text-muted-foreground">{item.sender_name || 'Пользователь'}</p> : null}
                <p className="whitespace-pre-wrap text-sm">{item.body}</p>
                <p className={`mt-1 text-[11px] ${mine ? 'text-white/70' : 'text-muted-foreground'}`}>{new Date(item.created_at).toLocaleString('ru-RU')}</p>
              </div>
            </div>
          })}
        </div>
        <div className="border-t border-border bg-white p-3">
          <div className="flex items-end gap-2">
            <textarea className="min-h-11 max-h-32 flex-1 resize-y rounded-xl border border-border px-3 py-2" value={adminReply} onChange={(e) => setAdminReply(e.target.value)} placeholder="Сообщение..." />
            <Button onClick={() => void sendAdminReply()} isLoading={isSending} disabled={!adminReply.trim()}>Отправить</Button>
          </div>
        </div>
      </div>
    </div> : null}
  </div>
}
