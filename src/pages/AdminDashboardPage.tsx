import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { useAllUsers } from '@/features/admin/useAdmin'
import { supabase } from '@/lib/supabase'
import { Users, GraduationCap, Car, Shield, FileText, ListTodo } from 'lucide-react'

export function AdminDashboardPage() {
  const { data: users } = useAllUsers()
  const { data: documentTasks = [] } = useQuery({
    queryKey: ['admin-document-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_admin_document_tasks')
      if (error) throw error
      return data ?? []
    },
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  })

  const incompleteDocuments = documentTasks.filter(
    (item: any) => !item.passport_complete || !item.snils_complete || !item.medical_complete
  )

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
          <CardTitle className="flex items-center gap-2">
            <ListTodo className="h-5 w-5" />
            Задачи
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Link
            to="/admin/tasks"
            className="flex items-center justify-between gap-3 rounded-lg border border-border p-4 transition-colors hover:bg-muted"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-700">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium text-primary">Документы</p>
                <p className="text-sm text-muted-foreground">Ученики с незаполненными документами</p>
              </div>
            </div>
            <span className={`flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-sm font-bold ${incompleteDocuments.length > 0 ? 'bg-red-100 text-red-700' : 'bg-muted text-muted-foreground'}`}>
              {incompleteDocuments.length}
            </span>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
