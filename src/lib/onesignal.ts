const appId = import.meta.env.VITE_ONESIGNAL_APP_ID

let initPromise: Promise<void> | null = null

export type NotificationStatus = 'unknown' | 'enabled' | 'disabled' | 'blocked'

async function getOneSignal() {
  const module = await import('react-onesignal')
  return module.default
}

function hasConfiguredAppId() {
  return Boolean(appId && appId !== 'your-onesignal-app-id')
}

export async function initOneSignal() {
  if (!hasConfiguredAppId()) {
    console.warn('OneSignal App ID is not set. Push notifications disabled.')
    return
  }

  if (initPromise) return initPromise

  initPromise = (async () => {
    const OneSignal = await getOneSignal()

    await OneSignal.init({
      appId,
      allowLocalhostAsSecureOrigin: true,
      serviceWorkerPath: 'OneSignalSDKWorker.js',
      serviceWorkerParam: { scope: '/' },
      promptOptions: {
        slidedown: {
          prompts: [
            {
              type: 'push',
              autoPrompt: false,
              delay: { pageViews: 1, timeDelay: 0 },
              text: {
                actionMessage: 'Разрешите уведомления, чтобы получать напоминания и новости автошколы.',
                acceptButton: 'Разрешить',
                cancelButton: 'Позже',
              },
            },
          ],
        },
      },
      welcomeNotification: {
        title: 'Автошкола',
        message: 'Спасибо за подписку на уведомления!',
      },
      notifyButton: {
        enable: false,
        prenotify: false,
        showCredit: false,
        text: {
          'tip.state.unsubscribed': 'Подписаться на уведомления',
          'tip.state.subscribed': 'Вы подписаны на уведомления',
          'tip.state.blocked': 'Уведомления заблокированы',
          'message.prenotify': 'Нажмите, чтобы подписаться на уведомления',
          'message.action.subscribing': 'Подписываем...',
          'message.action.subscribed': 'Спасибо за подписку!',
          'message.action.resubscribed': 'Вы снова подписаны',
          'message.action.unsubscribed': 'Вы отписались',
          'dialog.main.title': 'Управление уведомлениями',
          'dialog.main.button.subscribe': 'Подписаться',
          'dialog.main.button.unsubscribe': 'Отписаться',
          'dialog.blocked.title': 'Разблокировать уведомления',
          'dialog.blocked.message': 'Разрешите уведомления для этого сайта в настройках браузера.',
        },
      },
    })
  })().catch((error) => {
    initPromise = null
    console.error('Failed to initialize OneSignal:', error)
  })

  return initPromise
}

export async function getNotificationStatus(): Promise<NotificationStatus> {
  if (!hasConfiguredAppId()) return 'disabled'

  await initOneSignal()
  const OneSignal = await getOneSignal()

  if (OneSignal.Notifications.permissionNative === 'denied') return 'blocked'
  if (OneSignal.User.PushSubscription.optedIn) return 'enabled'
  return 'disabled'
}

export async function requestNotificationPermission() {
  if (!hasConfiguredAppId()) return

  await initOneSignal()

  try {
    const OneSignal = await getOneSignal()

    if (OneSignal.Notifications.permissionNative === 'granted') {
      await OneSignal.User.PushSubscription.optIn()
      return
    }

    await OneSignal.Slidedown.promptPush({ force: true })
  } catch (error) {
    console.error('Failed to request notification permission:', error)
  }
}

export async function disableNotifications() {
  if (!hasConfiguredAppId()) return

  await initOneSignal()

  try {
    const OneSignal = await getOneSignal()
    await OneSignal.User.PushSubscription.optOut()
  } catch (error) {
    console.error('Failed to disable notifications:', error)
  }
}

export async function subscribeToNotificationChanges(
  listener: () => void
): Promise<() => void> {
  if (!hasConfiguredAppId()) return () => {}

  await initOneSignal()
  const OneSignal = await getOneSignal()
  const handleChange = () => listener()

  OneSignal.User.PushSubscription.addEventListener('change', handleChange)
  OneSignal.Notifications.addEventListener('permissionChange', handleChange)

  return () => {
    OneSignal.User.PushSubscription.removeEventListener('change', handleChange)
    OneSignal.Notifications.removeEventListener('permissionChange', handleChange)
  }
}
