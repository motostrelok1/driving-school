import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, FileText } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { supabase } from '@/lib/supabase'

interface DocumentTask {
  student_id: string
  full_name: string | null
  passport_complete: boolean
  snils_complete: boolean
  medical_complete: boolean
}

export function AdminTasksPage() {
  const [documentsOpen, setDocumentsOpen] = useState(false)

  const { data: documentTasks = [], isLoading } = useQuery({
    queryKey: ['admin-document-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_admin_document_tasks')
      if (error) throw error
      return (data ?? []) as DocumentTask[]
    },
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  })

  const incompleteDocuments = documentTasks.filter(
    (item) => !item.passport_complete || !item.snils_complete || !item.medical_complete
  )

  return <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-bold text-primary">Задачи</h1>
      <p className="mt-1 text-sm text-muted-foreground">Контроль незавершённых данных и действий.</p>
    </div>

    <Card>
      <CardHeader>
        <CardTitle>Требуют внимания</CardTitle>
      </CardHeader>
      <CardContent>
        <button
          type="button"
          onClick={() => setDocumentsOpen((value) => !value)}
          className="flex w-full items-center gap-3 rounded-lg border border-border p-4 text-left hover:bg-muted"
          aria-expanded={documentsOpen}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-700">
            <FileText className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <strong>Документы</strong>
              <Badge variant={incompleteDocuments.length > 0 ? 'danger' : 'secondary'}>
                {incompleteDocuments.length}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Ученики с незаполненными паспортом, СНИЛС или справкой.</p>
          </div>
          <ChevronDown className={`h-5 w-5 transition-transform ${documentsOpen ? 'rotate-180' : ''}`} />
        </button>

        {documentsOpen ? <div className="mt-3 overflow-hidden rounded-lg border border-border">
          {isLoading ? <p className="p-4 text-sm text-muted-foreground">Загрузка...</p> :
            incompleteDocuments.length === 0 ? <p className="p-4 text-sm text-muted-foreground">Все документы заполнены.</p> :
            <div className="divide-y divide-border">
              {incompleteDocuments.map((item) => {
                const missing = [
                  !item.passport_complete ? 'Паспорт' : null,
                  !item.snils_complete ? 'СНИЛС' : null,
                  !item.medical_complete ? 'Справка' : null,
                ].filter(Boolean)

                return <Link
                  key={item.student_id}
                  to={`/admin/users?documents=${item.student_id}`}
                  className="flex items-center justify-between gap-3 p-3 hover:bg-muted"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-primary">{item.full_name || item.student_id}</p>
                    <p className="mt-1 text-xs text-red-700">Не заполнено: {missing.join(', ')}</p>
                  </div>
                  <FileText className="h-4 w-4 shrink-0 text-red-700" />
                </Link>
              })}
            </div>}
        </div> : null}
      </CardContent>
    </Card>
  </div>
}
