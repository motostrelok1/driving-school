import { useState } from 'react'
import {
  useAllUsers,
  useUpdateProfile,
  useInstructors,
  useAssignInstructor,
} from '@/features/admin/useAdmin'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import type { Profile, UserRole } from '@/types'
import { Search, UserCog } from 'lucide-react'

const roleLabels: Record<UserRole, string> = {
  student: 'Ученик',
  instructor: 'Инструктор',
  admin: 'Администратор',
}

export function AdminUsersPage() {
  const { data: users, isLoading } = useAllUsers()
  const { data: instructors } = useInstructors()
  const updateProfile = useUpdateProfile()
  const assignInstructor = useAssignInstructor()
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [selectedRole, setSelectedRole] = useState<UserRole>('student')
  const [selectedInstructor, setSelectedInstructor] = useState('')

  const filteredUsers =
    users?.filter((user) =>
      (user.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
      user.id.toLowerCase().includes(search.toLowerCase())
    ) ?? []

  function startEdit(user: Profile) {
    setEditing(user.id)
    setSelectedRole(user.role)
  }

  function saveRole(userId: string) {
    updateProfile.mutate({ id: userId, updates: { role: selectedRole } })
    setEditing(null)
  }

  function handleAssignInstructor(studentId: string) {
    if (!selectedInstructor) return
    assignInstructor.mutate({
      instructorId: selectedInstructor,
      studentId,
    })
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-primary">Пользователи</h1>

      <Card>
        <CardHeader>
          <CardTitle>Список пользователей</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Input
              placeholder="Поиск по имени или ID"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              icon={<Search className="h-4 w-4" />}
            />
          </div>

          <div className="space-y-3">
            {filteredUsers.map((user) => (
              <div
                key={user.id}
                className="min-w-0 rounded-lg border border-border p-3"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium text-primary">
                      {user.full_name || 'Без имени'}
                    </p>
                    <p className="break-all text-xs text-muted-foreground">{user.id}</p>
                    <div className="mt-1">
                      <Badge variant="secondary">{roleLabels[user.role]}</Badge>
                    </div>
                  </div>

                  {editing === user.id ? (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <select
                        value={selectedRole}
                        onChange={(e) =>
                          setSelectedRole(e.target.value as UserRole)
                        }
                        className="h-10 w-full rounded-lg border border-border px-3 sm:w-auto"
                      >
                        <option value="student">Ученик</option>
                        <option value="instructor">Инструктор</option>
                        <option value="admin">Администратор</option>
                      </select>
                      <Button size="sm" onClick={() => saveRole(user.id)}>
                        Сохранить
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditing(null)}
                      >
                        Отмена
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => startEdit(user)}
                    >
                      <UserCog className="mr-1.5 h-4 w-4" />
                      Изменить роль
                    </Button>
                  )}
                </div>

                {user.role === 'student' && instructors ? (
                  <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center">
                    <select
                      value={selectedInstructor}
                      onChange={(e) => setSelectedInstructor(e.target.value)}
                      className="h-10 w-full rounded-lg border border-border px-3 sm:w-auto"
                    >
                      <option value="">Выберите инструктора</option>
                      {instructors.map((inst) => (
                        <option key={inst.id} value={inst.id}>
                          {inst.full_name || inst.id}
                        </option>
                      ))}
                    </select>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAssignInstructor(user.id)}
                    >
                      Назначить
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
