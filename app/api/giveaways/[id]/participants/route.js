import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sanitizeSearchTerm } from '@/lib/customers'
import {
  requireGiveawayAdmin,
  dbErrorResponse,
  notFound,
  uuidParam,
} from '@/lib/giveaways/server'

// Participantes de un sorteo, paginados, con sus tickets. Solo admin: incluye
// teléfono y email, que nunca salen en la API pública.
export async function GET(request, { params }) {
  const admin = await requireGiveawayAdmin(request)
  if (admin instanceof NextResponse) return admin

  const id = uuidParam((await params).id)
  if (!id) return notFound('No encontramos ese sorteo')

  const { searchParams } = new URL(request.url)
  const q = (searchParams.get('q') || '').trim()
  const page = Math.max(Number(searchParams.get('page')) || 1, 1)
  const perPage = Math.min(Math.max(Number(searchParams.get('perPage')) || 25, 1), 100)
  const from = (page - 1) * perPage

  let query = supabaseAdmin
    .from('giveaway_participants')
    .select('id, full_name, phone_display, email, ig_handle, customer_id, marketing_consent, created_at', { count: 'exact' })
    .eq('giveaway_id', id)
    .order('created_at', { ascending: false })

  if (q) {
    // sanitizeSearchTerm escapa % y _; la coma y los paréntesis son sintaxis del
    // filtro .or() y se sacan para que el texto buscado no pueda agregar condiciones.
    const term = sanitizeSearchTerm(q).replace(/[,()]/g, ' ')
    query = query.or(
      [`full_name.ilike.%${term}%`, `ig_handle_normalized.ilike.%${term}%`, `phone_display.ilike.%${term}%`, `email.ilike.%${term}%`].join(',')
    )
  }

  const { data, error, count } = await query.range(from, from + perPage - 1)
  if (error) return dbErrorResponse(error)

  const participants = data || []
  let ticketsByParticipant = new Map()
  if (participants.length) {
    const { data: entries } = await supabaseAdmin
      .from('giveaway_entries')
      .select('participant_id, slot, ticket_number')
      .in('participant_id', participants.map(p => p.id))
      .order('slot')
    for (const entry of entries || []) {
      const list = ticketsByParticipant.get(entry.participant_id) || []
      list.push({ slot: entry.slot, ticket_number: entry.ticket_number })
      ticketsByParticipant.set(entry.participant_id, list)
    }
  }

  return NextResponse.json({
    participants: participants.map(p => ({ ...p, tickets: ticketsByParticipant.get(p.id) || [] })),
    total: count ?? participants.length,
    page,
    perPage,
  })
}
