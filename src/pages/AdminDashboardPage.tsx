import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { useAllUsers, useGroups } from '@/features/admin/useAdmin'
import { Users, GraduationCap, Car, Shield } from 'lucide-react'

export function AdminDashboardPage() {
  const { data: users } = useAllUsers()
  const { data: groups } = useGroups()

  const stats = [
    {
      label: 'Всего пользователей',
      value: users?.length ?? 0,
      icon: Users,
    },
    {
      label: 'Учеников',
      value: users?.filter((u) => u.role === 'student').length ?? 0,
      icon: GraduationCap,
    },
    {
      label: 'Инструкторов',
      value: users?.filter((u) => u.role === 'instructor').length ?? 0,
      icon: Car,
    },
    {
      label: 'Администраторов',
      value: users?.filter((u) => u.role === 'admin').length ?? 0,
      icon: Shield,
    },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-primary">Панель управления</h1>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="min-h-32">
            <CardContent className="flex h-full flex-col items-center justify-center gap-4 p-4 text-center">
              <p className="min-h-10 text-sm font-medium leading-5 text-muted-foreground">
                {stat.label}
              </p>
              <div className="flex items-center justify-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <stat.icon className="h-5 w-5 text-primary" />
                </div>
                <p className="min-w-8 text-left text-3xl font-bold leading-none text-primary">
                  {stat.value}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Группы</CardTitle>
        </CardHeader>
        <CardContent>
          {groups && groups.length > 0 ? (
            <div className="space-y-2">
              {groups.map((group) => (
                <div
                  key={group.id}
                  className="flex items-center justify-between rounded-lg border border-border p-3"
                >
                  <div>
                    <p className="font-medium text-primary">{group.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Категория {group.category}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">Групп пока нет.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
