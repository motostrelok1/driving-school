import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Lesson, LessonWithDetails, LessonStatus } from '@/types'

export function useMyLessons() {
  return useQuery({
    queryKey: ['my-lessons'],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('lessons')
        .select(
          `*, student:profiles!lessons_student_id_fkey(full_name), instructor:profiles!lessons_instructor_id_fkey(full_name)`
        )
        .or(`student_id.eq.${userData.user.id},instructor_id.eq.${userData.user.id}`)
        .order('start_at', { ascending: true })

      if (error) throw error
      return (data ?? []) as LessonWithDetails[]
    },
  })
}

export function useStudentLessons(studentId?: string) {
  return useQuery({
    queryKey: ['student-lessons', studentId],
    queryFn: async () => {
      if (!studentId) return []
      const { data, error } = await supabase
        .from('lessons')
        .select(
          `*, student:profiles!lessons_student_id_fkey(full_name), instructor:profiles!lessons_instructor_id_fkey(full_name)`
        )
        .eq('student_id', studentId)
        .order('start_at', { ascending: true })

      if (error) throw error
      return (data ?? []) as LessonWithDetails[]
    },
    enabled: !!studentId,
  })
}

export function useCreateLesson() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (
      lesson: Omit<Lesson, 'id' | 'created_at' | 'updated_at'>
    ) => {
      const { data, error } = await supabase
        .from('lessons')
        .insert(lesson)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-lessons'] })
      queryClient.invalidateQueries({ queryKey: ['student-lessons'] })
      queryClient.invalidateQueries({ queryKey: ['all-lessons'] })
    },
  })
}

export function useUpdateLesson() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string
      updates: Partial<Lesson>
    }) => {
      const { data, error } = await supabase
        .from('lessons')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-lessons'] })
      queryClient.invalidateQueries({ queryKey: ['student-lessons'] })
      queryClient.invalidateQueries({ queryKey: ['all-lessons'] })
    },
  })
}

export function useUpdateLessonStatus() {
  const mutation = useUpdateLesson()

  return {
    ...mutation,
    mutate: (id: string, status: LessonStatus) =>
      mutation.mutate({ id, updates: { status } }),
  }
}
