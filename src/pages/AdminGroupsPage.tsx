import { useMemo, useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronDown, Plus, Search, Users, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { useCreateGroup, useGroups, useStudents } from '@/features/admin/useAdmin'
import { supabase } from '@/lib/supabase'
import type { Group } from '@/types'

export function AdminGroupsPage() {
  const { data: groups = [], isLoading: groupsLoading } = useGroups()
  const { data: students = [], isLoading: studentsLoading } = useStudents()
  const createGroup = useCreateGroup()
  const queryClient = useQueryClient()

  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [name, setName] = useState('')
  const [category, setCategory] = useState('B')
  const [startDate, setStartDate] = useState('')
  const [search, setSearch] = useState('')
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const sortedGroups = useMemo(
    () => [...groups].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [groups]
  )

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('ru')
    return [...students]
      .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || '', 'ru'))
      .filter((student) => !query || (student.full_name || student.email || '').toLocaleLowerCase('ru').includes(query))
  }, [students, search])

  function resetCreate() {
    setIsCreateOpen(false)
    setName('')
    setCategory('B')
    setStartDate('')
    setSearch('')
    setSelectedStudentIds([])
    setError(null)
  }

  function toggleStudent(studentId: string) {
    setSelectedStudentIds((current) =>
      current.includes(studentId)
        ? current.filter((id) => id !== studentId)
        : [...current, studentId]
    )
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!name.trim()) {
      setError('Укажите название группы.')
      return
    }

    setError(null)
    setIsSaving(true)

    try {
      const group = await createGroup.mutateAsync({
        name: name.trim(),
        category: category.trim() || 'B',
        start_date: startDate || null,
      } as Omit<Group, 'id' | 'created_at'>)

      if (selectedStudentIds.length > 0) {
        const { error: assignError } = await supabase
          .from('profiles')
          .update({ group_id: group.id })
          .in('id', selectedStudentIds)
          .eq('role', 'student')

        if (assignError) throw assignError
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['groups'] }),
        queryClient.invalidateQueries({ queryKey: ['students'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
      ])

      resetCreate()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать группу.')
    } finally {
      setIsSaving(false)
    }
  }

  if (groupsLoading || studentsLoading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
  }

  return <div className="space-y-6">
    <div className="flex items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-primary">Группы</h1>
        <p className="mt-1 text-sm text-muted-foreground">Учебные группы и состав учеников.</p>
      </div>
      <Button size="sm" onClick={() => setIsCreateOpen(true)}>
        <Plus className="mr-1.5 h-4 w-4" />Добавить группу
      </Button>
    </div>

    <Card>
      <CardHeader>
        <CardTitle>Список групп</CardTitle>
      </CardHeader>
      <CardContent>
        {sortedGroups.length === 0 ? <p className="py-8 text-center text-muted-foreground">Групп пока нет.</p> :
          <div className="divide-y divide-border">
            {sortedGroups.map((group) => {
              const groupStudents = students
                .filter((student) => student.group_id === group.id)
                .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || '', 'ru'))
              const expanded = expandedGroupId === group.id

              return <div key={group.id}>
                <button
                  type="button"
                  onClick={() => setExpandedGroupId(expanded ? null : group.id)}
                  className="flex w-full items-center gap-3 py-4 text-left hover:bg-muted"
                  aria-expanded={expanded}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <strong className="truncate">{group.name}</strong>
                      <span className="shrink-0 text-xs text-muted-foreground">{new Date(group.created_at).toLocaleString('ru-RU')}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2 text-sm text-muted-foreground">
                      <span>Категория {group.category}</span>
                      {group.start_date ? <span>• начало {new Date(group.start_date + 'T00:00:00').toLocaleDateString('ru-RU')}</span> : null}
                      <span>• учеников {groupStudents.length}</span>
                    </div>
                  </div>
                  <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                </button>

                {expanded ? <div className="mb-4 rounded-lg border border-border bg-slate-50 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <strong className="text-sm">Ученики</strong>
                    <Badge variant="secondary">{groupStudents.length}</Badge>
                  </div>
                  {groupStudents.length === 0 ? <p className="text-sm text-muted-foreground">В группе пока нет учеников.</p> :
                    <div className="space-y-1">
                      {groupStudents.map((student) => <div key={student.id} className="rounded-md bg-white px-3 py-2 text-sm">{student.full_name || student.email || student.id}</div>)}
                    </div>}
                </div> : null}
              </div>
            })}
          </div>}
      </CardContent>
    </Card>

    {isCreateOpen ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form onSubmit={handleCreate} className="flex max-h-[90vh] w-full max-w-xl flex-col rounded-xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">Добавить группу</h2>
            <p className="text-sm text-muted-foreground">Создайте группу и выберите учеников.</p>
          </div>
          <button type="button" onClick={() => !isSaving && resetCreate()}><X className="h-5 w-5" /></button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium sm:col-span-2">Название группы
            <input className="mt-1 w-full rounded-lg border border-border px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} placeholder="Например, Группа 12" required />
          </label>
          <label className="text-sm font-medium">Категория
            <input className="mt-1 w-full rounded-lg border border-border px-3 py-2" value={category} onChange={(e) => setCategory(e.target.value)} />
          </label>
          <label className="text-sm font-medium">Дата начала
            <input type="date" className="mt-1 w-full rounded-lg border border-border px-3 py-2" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
        </div>

        <div className="mt-4">
          <p className="mb-2 text-sm font-medium">Ученики</p>
          <Input placeholder="Поиск по ФИО" value={search} onChange={(e) => setSearch(e.target.value)} icon={<Search className="h-4 w-4" />} />
        </div>

        <div className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-lg border border-border">
          {filteredStudents.map((student) => {
            const checked = selectedStudentIds.includes(student.id)
            const currentGroup = groups.find((group) => group.id === student.group_id)
            return <label key={student.id} className="flex cursor-pointer items-center gap-3 border-b border-border px-3 py-2 last:border-b-0 hover:bg-slate-50">
              <input type="checkbox" checked={checked} onChange={() => toggleStudent(student.id)} />
              <div className="min-w-0 flex-1">
                <p className="truncate">{student.full_name || student.email || student.id}</p>
                {currentGroup ? <p className="text-xs text-muted-foreground">Сейчас в группе: {currentGroup.name}</p> : null}
              </div>
            </label>
          })}
        </div>

        {error ? <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={resetCreate} disabled={isSaving}>Отмена</Button>
          <Button type="submit" isLoading={isSaving}>Создать группу</Button>
        </div>
      </form>
    </div> : null}
  </div>
}
