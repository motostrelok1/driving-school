import { useEffect, useState } from 'react'
import {
  disableNotifications,
  getNotificationStatus,
  initOneSignal,
  requestNotificationPermission,
  subscribeToNotificationChanges,
  type NotificationStatus,
} from '@/lib/onesignal'
import { Button } from '@/components/ui/Button'
import { Bell } from 'lucide-react'
import { cn } from '@/utils/cn'

const UNREAD_STORAGE_KEY = 'driving-school-has-unread-notifications'

const statusStyles: Record<NotificationStatus, string> = {
  unknown: 'border-border bg-white text-primary hover:bg-muted',
  enabled: 'border-green-200 bg-green-50 text-green-800 hover:bg-green-100',
  disabled: 'border-red-200 bg-red-50 text-red-800 hover:bg-red-100',
  blocked: 'border-red-200 bg-red-50 text-red-800 hover:bg-red-100',
}

export function NotificationButton() {
  const [status, setStatus] = useState<NotificationStatus>('unknown')
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [isBusy, setIsBusy] = useState(false)
  const [hasUnread, setHasUnread] = useState(() =>
    localStorage.getItem(UNREAD_STORAGE_KEY) === 'true'
  )

  async function refreshStatus() {
    setStatus(await getNotificationStatus())
  }

  useEffect(() => {
    function handleUnreadChange() {
      setHasUnread(localStorage.getItem(UNREAD_STORAGE_KEY) === 'true')
    }

    window.addEventListener('storage', handleUnreadChange)
    window.addEventListener('notifications-unread-change', handleUnreadChange)

    return () => {
      window.removeEventListener('storage', handleUnreadChange)
      window.removeEventListener('notifications-unread-change', handleUnreadChange)
    }
  }, [])

  useEffect(() => {
    let unsubscribe: (() => void) | undefined
    let isMounted = true

    initOneSignal()
      .then(() => refreshStatus())
      .then(() => subscribeToNotificationChanges(() => refreshStatus()))
      .then((cleanup) => {
        if (isMounted) {
          unsubscribe = cleanup
        } else {
          cleanup()
        }
      })

    return () => {
      isMounted = false
      unsubscribe?.()
    }
  }, [])

  async function handleClick() {
    if (status === 'enabled') {
      setIsConfirmOpen(true)
      return
    }

    setIsBusy(true)
    await requestNotificationPermission()
    await refreshStatus()
    setIsBusy(false)
  }

  async function handleDisable() {
    setIsBusy(true)
    await disableNotifications()
    await refreshStatus()
    setIsBusy(false)
    setIsConfirmOpen(false)
  }

  const shouldBlink = status === 'enabled' && hasUnread

  const title =
    shouldBlink
      ? '\u0415\u0441\u0442\u044c \u043d\u0435\u043f\u0440\u043e\u0447\u0438\u0442\u0430\u043d\u043d\u044b\u0435 \u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f'
      : status === 'enabled'
      ? '\u0423\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f \u0432\u043a\u043b\u044e\u0447\u0435\u043d\u044b'
      : status === 'blocked'
        ? '\u0423\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f \u0437\u0430\u0431\u043b\u043e\u043a\u0438\u0440\u043e\u0432\u0430\u043d\u044b \u0432 \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0435'
        : '\u0412\u043a\u043b\u044e\u0447\u0438\u0442\u044c push-\u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f'

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleClick}
        title={title}
        isLoading={isBusy}
        className={cn('border', statusStyles[status])}
      >
        <span className="relative inline-flex">
          <Bell
            className={cn(
              'h-4 w-4 sm:mr-1.5',
              shouldBlink && 'animate-notification-bell text-red-600'
            )}
          />
        </span>
        <span className="hidden sm:inline">
          {'\u0423\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f'}
        </span>
      </Button>

      {isConfirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 px-4 pt-5 sm:items-center sm:pt-0">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="disable-notifications-title"
            className="w-full max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-white p-4 shadow-lg sm:max-w-sm"
          >
            <h2
              id="disable-notifications-title"
              className="text-center text-lg font-semibold text-primary"
            >
              {'\u041e\u0442\u043a\u043b\u044e\u0447\u0438\u0442\u044c \u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f?'}
            </h2>
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => setIsConfirmOpen(false)}
                disabled={isBusy}
              >
                {'\u041d\u0435\u0442'}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="danger"
                className="w-full sm:w-auto"
                onClick={handleDisable}
                isLoading={isBusy}
              >
                {'\u0414\u0430, \u043e\u0442\u043a\u043b\u044e\u0447\u0438\u0442\u044c'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
