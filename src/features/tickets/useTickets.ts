import { useQuery } from '@tanstack/react-query'
import type { TheoryTicket } from '@/types'

type TicketPayload = TheoryTicket[] | { tickets: Array<TheoryTicket | (Omit<TheoryTicket, 'ticketNumber'> & { number: number })> }

type RawTicket = TheoryTicket | (Omit<TheoryTicket, 'ticketNumber'> & { number: number })

function normalizeTicket(ticket: RawTicket): TheoryTicket {
  return {
    ...ticket,
    ticketNumber: 'ticketNumber' in ticket ? ticket.ticketNumber : ticket.number,
  }
}

async function loadTickets() {
  const response = await fetch('/tickets/tickets.json')

  if (!response.ok) {
    throw new Error('Не удалось загрузить билеты.')
  }

  const payload = (await response.json()) as TicketPayload
  const tickets = Array.isArray(payload) ? payload : payload.tickets

  return tickets.map(normalizeTicket).sort((a, b) => a.ticketNumber - b.ticketNumber)
}

export function useTickets() {
  return useQuery({
    queryKey: ['theory-tickets'],
    queryFn: loadTickets,
  })
}
