import { LessonList } from '@/features/schedule/LessonList'
import { useMyLessons, useUpdateLessonStatus } from '@/features/schedule/useLessons'

export function SchedulePage() {
  const { data: lessons, isLoading } = useMyLessons()
  const updateStatus = useUpdateLessonStatus()

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-primary">Моё расписание</h1>
      <LessonList
        lessons={lessons ?? []}
        title="Ближайшие занятия"
        showActions
        onStatusChange={(id, status) => updateStatus.mutate(id, status)}
      />
    </div>
  )
}
