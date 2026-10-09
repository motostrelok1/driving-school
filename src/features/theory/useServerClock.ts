import { useEffect, useState } from 'react'

// Отсчёт от серверного timestamp и монотонных часов; перевод часов ОС не меняет таймер.
export function useServerClock(serverTime?: string) {
  const [clock, setClock] = useState<{ epoch: number; monotonic: number } | null>(null)
  const [, setTick] = useState(0)
  useEffect(() => {
    if (serverTime) setClock({ epoch: Date.parse(serverTime), monotonic: performance.now() })
  }, [serverTime])
  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), 1000)
    return () => window.clearInterval(timer)
  }, [])
  return clock ? clock.epoch + performance.now() - clock.monotonic : null
}
