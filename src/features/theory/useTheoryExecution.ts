import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { TheoryAssessmentOverview, TheoryAttemptPayload } from '@/types'

export function useMyTheoryAssessments(studentId?: string) {
  return useQuery({
    queryKey: ['my-theory-assessments', studentId],
    enabled: !!studentId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_my_theory_assessments')
      if (error) throw error
      return data as TheoryAssessmentOverview
    },
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  })
}

export function useMyTheoryAttempt(studentId: string | undefined, attemptId: string | null) {
  return useQuery({
    queryKey: ['my-theory-attempt', studentId, attemptId],
    enabled: !!studentId && !!attemptId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_my_theory_attempt', { p_attempt_id: attemptId })
      if (error) throw error
      return data as TheoryAttemptPayload
    },
    refetchInterval: (query) => query.state.data?.attempt.status === 'running' ? 10_000 : false,
    refetchOnWindowFocus: true,
  })
}

type TheoryOperation = { action: 'start'; assessmentId: string }
  | { action: 'answer'; attemptId: string; questionIndex: number; answer: number }
  | { action: 'finish'; attemptId: string }

export function useTheoryOperation(studentId?: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (input: TheoryOperation) => {
      const response = input.action === 'start'
        ? await supabase.rpc('student_start_theory_assessment', { p_assessment_id: input.assessmentId })
        : input.action === 'answer'
          ? await supabase.rpc('student_answer_theory_question', { p_attempt_id: input.attemptId, p_question_index: input.questionIndex, p_selected_answer: input.answer })
          : await supabase.rpc('student_finish_theory_attempt', { p_attempt_id: input.attemptId })
      if (response.error) throw response.error
      return response.data as TheoryAttemptPayload
    },
    onSuccess: (payload) => {
      client.setQueryData(['my-theory-attempt', studentId, payload.attempt.id], payload)
      client.invalidateQueries({ queryKey: ['my-theory-assessments', studentId] })
      client.invalidateQueries({ queryKey: ['theory-assessment-attempts', studentId] })
    },
  })
}
