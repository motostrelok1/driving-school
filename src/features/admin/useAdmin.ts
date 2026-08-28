import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createIsolatedSupabaseClient, supabase } from '@/lib/supabase'
import type {
  PddArticle,
  PddArticleContent,
  Profile,
  Group,
  StudentFinance,
  UserRole,
} from '@/types'

export function useAllUsers() {
  return useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data ?? []) as Profile[]
    },
  })
}

export function useGroups() {
  return useQuery({
    queryKey: ['groups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('groups')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data ?? []) as Group[]
    },
  })
}

export function useInstructors() {
  return useQuery({
    queryKey: ['instructors'],
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

export function useStudents() {
  return useQuery({
    queryKey: ['students'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'student')
        .order('full_name')

      if (error) throw error
      return (data ?? []) as Profile[]
    },
  })
}

export function useUpdateProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string
      updates: Partial<Profile>
    }) => {
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      queryClient.invalidateQueries({ queryKey: ['students'] })
      queryClient.invalidateQueries({ queryKey: ['instructors'] })
    },
  })
}

export function useDeleteProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('admin_delete_user', {
        user_id_to_delete: id,
      })

      if (error) throw error
      return id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      queryClient.invalidateQueries({ queryKey: ['students'] })
      queryClient.invalidateQueries({ queryKey: ['instructors'] })
      queryClient.invalidateQueries({ queryKey: ['instructor-students'] })
    },
  })
}

export function useCreateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      email,
      password,
      fullName,
      role,
    }: {
      email: string
      password: string
      fullName: string
      role: UserRole
    }) => {
      const authClient = createIsolatedSupabaseClient()
      const { data, error } = await authClient.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      })

      if (error) throw error

      const userId = data.user?.id
      if (!userId) {
        throw new Error('Не удалось создать пользователя.')
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ full_name: fullName, email, role })
        .eq('id', userId)

      if (profileError) throw profileError

      await authClient.auth.signOut()
      return userId
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      queryClient.invalidateQueries({ queryKey: ['students'] })
      queryClient.invalidateQueries({ queryKey: ['instructors'] })
    },
  })
}

export function useSendPasswordReset() {
  return useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (error) throw error
      return email
    },
  })
}

export function useStudentFinance(studentId?: string) {
  return useQuery({
    queryKey: ['student-finance', studentId],
    queryFn: async () => {
      if (!studentId) return null

      const { data, error } = await supabase
        .from('student_finances')
        .select('*')
        .eq('student_id', studentId)
        .maybeSingle()

      if (error) throw error
      return data as StudentFinance | null
    },
    enabled: !!studentId,
  })
}

export function useMyFinance() {
  return useQuery({
    queryKey: ['my-finance'],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('student_finances')
        .select('*')
        .eq('student_id', userData.user.id)
        .maybeSingle()

      if (error) throw error
      return data as StudentFinance | null
    },
  })
}

export function useUpsertStudentFinance() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      studentId,
      contractAmount,
      paymentDueDate,
      installmentDueDate,
    }: {
      studentId: string
      contractAmount: number
      paymentDueDate: string | null
      installmentDueDate: string | null
    }) => {
      const { data, error } = await supabase
        .from('student_finances')
        .upsert(
          {
            student_id: studentId,
            contract_amount: contractAmount,
            payment_due_date: paymentDueDate,
            installment_due_date: installmentDueDate,
          },
          { onConflict: 'student_id' }
        )
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['student-finance', variables.studentId],
      })
      queryClient.invalidateQueries({ queryKey: ['my-finance'] })
    },
  })
}

async function loadLocalPddArticle(topicId: string) {
  const response = await fetch('/pdd/articles.json')

  if (!response.ok) {
    return null
  }

  const payload = (await response.json()) as { articles?: PddArticle[] }
  return payload.articles?.find((article) => article.topic_id === topicId) ?? null
}

export function usePddArticle(topicId?: string) {
  return useQuery({
    queryKey: ['pdd-article', topicId],
    queryFn: async () => {
      if (!topicId) return null

      try {
        const { data, error } = await supabase
          .from('pdd_articles')
          .select('*')
          .eq('topic_id', topicId)
          .maybeSingle()

        if (error) throw error
        if (data) return data as PddArticle
      } catch (error) {
        console.warn('Не удалось загрузить раздел ПДД из базы, беру локальный материал.', error)
      }

      return loadLocalPddArticle(topicId)
    },
    enabled: !!topicId,
  })
}

export function useUpsertPddArticle() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      topicId,
      title,
      content,
    }: {
      topicId: string
      title: string
      content: PddArticleContent
    }) => {
      const { data, error } = await supabase
        .from('pdd_articles')
        .upsert(
          {
            topic_id: topicId,
            title,
            content,
          },
          { onConflict: 'topic_id' }
        )
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['pdd-article', variables.topicId],
      })
    },
  })
}

export function useCreateGroup() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (group: Omit<Group, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('groups')
        .insert(group)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] })
    },
  })
}

export function useAssignInstructor() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      instructorId,
      studentId,
    }: {
      instructorId: string
      studentId: string
    }) => {
      const { data, error } = await supabase
        .from('instructor_students')
        .upsert(
          { instructor_id: instructorId, student_id: studentId },
          { onConflict: 'instructor_id,student_id', ignoreDuplicates: true }
        )
        .select()
        .maybeSingle()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instructor-students'] })
      queryClient.invalidateQueries({ queryKey: ['my-instructors'] })
    },
  })
}

