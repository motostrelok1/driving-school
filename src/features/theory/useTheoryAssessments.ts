import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { TheoryAssessment, TheoryAssessmentAttemptSummary, TheoryAssessmentKind } from '@/types'

// Явный список колонок: answer_key доступен только серверу.
const attemptColumns = 'id, assessment_id, student_id, rules_version, question_count, time_limit_minutes, max_errors, started_at, expires_at, finished_at, status, correct_count, error_count, elapsed_seconds, passed'

export function useTheoryAssessments(studentId: string) {
  return useQuery({
    queryKey: ['theory-assessments', studentId],
    queryFn: async () => {
      const { data, error } = await supabase.from('theory_assessments')
        .select('*').eq('student_id', studentId).order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as TheoryAssessment[]
    },
    enabled: !!studentId,
  })
}

export function useTheoryAssessmentAttempts(studentId: string) {
  return useQuery({
    queryKey: ['theory-assessment-attempts', studentId],
    queryFn: async () => {
      const { data, error } = await supabase.from('theory_assessment_attempts')
        .select(attemptColumns).eq('student_id', studentId).order('started_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as TheoryAssessmentAttemptSummary[]
    },
    enabled: !!studentId,
  })
}

export interface AssignTheoryAssessmentInput {
  id: string
  studentId: string
  kind: TheoryAssessmentKind
  topicIds: string[]
  questionCount: number
  timeLimitMinutes: number
  maxErrors: number
  opensAt: string
  deadlineAt: string
}

export function useAssignTheoryAssessment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: AssignTheoryAssessmentInput) => {
      const { data, error } = await supabase.rpc('admin_assign_theory_assessment', {
        p_id: input.id, p_student_id: input.studentId, p_kind: input.kind,
        p_topic_ids: input.topicIds, p_question_count: input.questionCount,
        p_time_limit_minutes: input.timeLimitMinutes, p_max_errors: input.maxErrors,
        p_opens_at: input.opensAt, p_deadline_at: input.deadlineAt,
      })
      if (error) throw error
      return data as TheoryAssessment
    },
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({ queryKey: ['theory-assessments', input.studentId] })
    },
  })
}

export function useCancelTheoryAssessment(studentId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc('admin_cancel_theory_assessment', { p_id: id })
      if (error) throw error
      return data as TheoryAssessment
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['theory-assessments', studentId] })
    },
  })
}
