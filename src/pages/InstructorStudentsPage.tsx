import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { useMyStudents } from '@/features/instructors/useInstructorStudents'
import { User, Phone } from 'lucide-react'

export function InstructorStudentsPage() {
  const { data: students, isLoading } = useMyStudents()

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-primary">Мои ученики</h1>

      <Card>
        <CardHeader>
          <CardTitle>Список учеников</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {students && students.length > 0 ? (
            students.map((student) => (
              <div
                key={student.id}
                className="flex items-center gap-3 rounded-lg border border-border p-3"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                  <User className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-primary">
                    {student.full_name || 'Без имени'}
                  </p>
                  {student.phone ? (
                    <p className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" />
                      {student.phone}
                    </p>
                  ) : null}
                </div>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground">
              У вас пока нет закреплённых учеников.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
