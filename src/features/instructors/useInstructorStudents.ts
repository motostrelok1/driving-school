import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { InstructorReview, Profile } from '@/types'

function isProfile(value: unknown): value is Profile {
  return Boolean(value && typeof value === 'object' && 'id' in value)
}


export function useAvailableInstructors() {
  return useQuery({
    queryKey: ['available-instructors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'instructor')
        .order('full_name')

      if (error) throw error
      return (data ?? []) as Profile[]
    },
  })
}


export function useChooseInstructor() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (instructorId: string) => {
      const { data, error } = await supabase.rpc('student_choose_instructor', {
        target_instructor_id: instructorId,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-instructors'] })
      queryClient.invalidateQueries({ queryKey: ['available-instructors'] })
      queryClient.invalidateQueries({ queryKey: ['my-students'] })
      queryClient.invalidateQueries({ queryKey: ['driving-slots'] })
    },
  })
}

export function useBeginInstructorChange() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('student_begin_instructor_change')
      if (error) throw error
      return data as { cancelled_slots: { id: string; start_at: string }[] }
    },
    onSuccess: () => {
      void supabase.functions.invoke('send-driving-events').catch((error: unknown) => console.warn('Driving event delivery deferred', error))
      queryClient.invalidateQueries({ queryKey: ['my-instructors'] })
      queryClient.invalidateQueries({ queryKey: ['driving-slots'] })
    },
  })
}

export function useInstructorReviews(instructorId: string) {
  return useQuery({
    queryKey: ['instructor-reviews', instructorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('instructor_reviews')
        .select('*, student:profiles!instructor_reviews_student_id_fkey(full_name)')
        .eq('instructor_id', instructorId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data ?? []) as InstructorReview[]
    },
  })
}

export function useCreateInstructorReview() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      instructorId,
      rating,
      text,
    }: {
      instructorId: string
      rating: number
      text: string
    }) => {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('instructor_reviews')
        .upsert(
          {
            instructor_id: instructorId,
            student_id: userData.user.id,
            rating,
            text,
          },
          { onConflict: 'instructor_id,student_id' }
        )
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['instructor-reviews', variables.instructorId],
      })
    },
  })
}

export function useMyStudents() {
  return useQuery({
    queryKey: ['my-students'],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('instructor_students')
        .select('student:profiles!instructor_students_student_id_fkey(id, role, full_name, email, phone, group_id, created_at, updated_at)')
        .eq('instructor_id', userData.user.id)

      if (error) throw error
      return ((data?.map((item) => item.student) ?? []) as unknown[])
        .filter(isProfile)
    },
  })
}

export function useMyInstructors() {
  return useQuery({
    queryKey: ['my-instructors'],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('instructor_students')
        .select('instructor:profiles!instructor_students_instructor_id_fkey(id, role, full_name, email, phone, group_id, created_at, updated_at)')
        .eq('student_id', userData.user.id)

      if (error) throw error
      return ((data?.map((item) => item.instructor) ?? []) as unknown[])
        .filter(isProfile)
    },
  })
}
