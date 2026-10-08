import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { TheoryBankQuestion, TicketAnswer } from '@/types'

export function useTheoryBank() {
  return useQuery({
    queryKey: ['theory-question-bank'],
    queryFn: async () => {
      const { data, error } = await supabase.from('theory_question_bank').select('*')
        .order('ticket_number').order('question_number')
      if (error) throw error
      return (data ?? []) as TheoryBankQuestion[]
    },
  })
}

export function useImportTheoryBank() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const response = await fetch('/tickets/tickets.json')
      if (!response.ok) throw new Error('Не удалось загрузить исходные билеты.')
      const payload = await response.json()
      const tickets = Array.isArray(payload) ? payload : payload.tickets
      const questions = tickets.flatMap((ticket: { number?: number; ticketNumber?: number; questions: object[] }) =>
        ticket.questions.map((question) => ({ ...question, ticketNumber: ticket.ticketNumber ?? ticket.number })))
      const { data, error } = await supabase.rpc('admin_import_theory_questions', { p_questions: questions })
      if (error) throw error
      return data as { inserted: number; invalid_keys: number; total: number }
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['theory-question-bank'] }),
  })
}

export function useSaveTheoryQuestion() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; text: string; answers: TicketAnswer[]; correctAnswer: number | null; topicIds: string[]; approve: boolean }) => {
      const { error } = await supabase.rpc('admin_save_theory_question', {
        p_id: input.id, p_text: input.text, p_answers: input.answers,
        p_correct_answer: input.correctAnswer, p_topic_ids: input.topicIds, p_approve: input.approve,
      })
      if (error) throw error
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['theory-question-bank'] }),
  })
}
