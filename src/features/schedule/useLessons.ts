import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { DrivingSlot, Lesson, LessonWithDetails, LessonStatus } from '@/types'

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


export function useDrivingSlots() {
  return useQuery({
    queryKey: ['driving-slots'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('driving_slots')
        .select('*, instructor:profiles!driving_slots_instructor_id_fkey(full_name), student:profiles!driving_slots_student_id_fkey(full_name)')
        .order('start_at', { ascending: true })

      if (error) throw error
      return (data ?? []) as DrivingSlot[]
    },
  })
}

export function useCreateDrivingSlot() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (slot: Omit<DrivingSlot, 'id' | 'created_at' | 'updated_at' | 'instructor' | 'student'>) => {
      const { data, error } = await supabase
        .from('driving_slots')
        .upsert(slot, { onConflict: 'instructor_id,start_at' })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driving-slots'] })
    },
  })
}



export function useUpdateDrivingSlot() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string
      updates: Partial<DrivingSlot>
    }) => {
      const { data, error } = await supabase
        .from('driving_slots')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driving-slots'] })
    },
  })
}

export function useDeleteDrivingSlot() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('driving_slots')
        .delete()
        .eq('id', id)

      if (error) throw error
      return id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driving-slots'] })
    },
  })
}



export function useCancelMyFutureDrivingSlots() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (instructorId: string) => {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) throw new Error('Not authenticated')

      const { error } = await supabase
        .from('driving_slots')
        .update({ student_id: null, status: 'open' })
        .eq('student_id', userData.user.id)
        .eq('instructor_id', instructorId)
        .eq('status', 'booked')
        .gte('start_at', new Date().toISOString())

      if (error) throw error
      return instructorId
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driving-slots'] })
    },
  })
}

