import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types'

export function useMyStudents() {
  return useQuery({
    queryKey: ['my-students'],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('instructor_students')
        .select('student:profiles!instructor_students_student_id_fkey(id, role, full_name, phone, group_id)')
        .eq('instructor_id', userData.user.id)

      if (error) throw error
      return (data?.map((item) => item.student) ?? []) as unknown as Profile[]
    },
  })
}
