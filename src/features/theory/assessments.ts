import type { TheoryAssessmentKind } from '@/types'

export const assessmentKindLabels: Record<TheoryAssessmentKind, string> = {
  credit: 'Промежуточный зачёт',
  internal_exam: 'Внутренний экзамен',
}

export const INTERNAL_EXAM_RULES = {
  questionCount: 20,
  timeLimitMinutes: 20,
  maxErrors: 2,
} as const

export function formatAssessmentDate(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow', dateStyle: 'short', timeStyle: 'short',
  }).format(new Date(value))
}

export function toMoscowDateTimeInput(date: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date)
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`
}

export function moscowInputToIso(value: string) {
  return new Date(`${value}:00+03:00`).toISOString()
}

export function getAssessmentError(error: unknown) {
  const details = error as { code?: string; message?: string } | null
  if (details?.code === '42P01' || details?.code === '42883' || details?.code === 'PGRST202' || details?.code === 'PGRST205') {
    return 'Тестирование пока недоступно. Примените миграцию 0034_theory_assessments.sql в Supabase.'
  }
  if (details?.code === '23514' || details?.code === '23502') {
    return 'Проверьте темы, количество вопросов, время, допустимые ошибки и сроки.'
  }
  return details?.message || 'Не удалось выполнить операцию. Попробуйте ещё раз.'
}
