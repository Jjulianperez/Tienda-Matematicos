import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { findPublicGiveaway, notFound, firstName } from '@/lib/giveaways/server'

// Detalle público de un sorteo.
//
// Transparencia: desde que se congela la lista (estado "ready") se publican la
// huella de los tickets y la lista misma, para que cualquiera pueda comprobar
// que no cambió. Al terminar se publican además la semilla revelada y los
// ganadores. Con esos datos, `verifyDraw` (lib/giveaways/draw.js) recalcula el
// resultado.
//
// Privacidad: de los ganadores solo sale el nombre de pila y el número de
// ticket. Nunca teléfono, email ni usuario de Instagram.
export async function GET(request, { params }) {
  const { slug } = await params
  const giveaway = await findPublicGiveaway(slug)
  if (!giveaway) return notFound('No encontramos ese sorteo')

  const { data: requirements } = await supabaseAdmin
    .from('giveaway_requirements')
    .select('id, position, slot, kind, title, instructions')
    .eq('giveaway_id', giveaway.id)
    .order('position')

  const response = {
    giveaway,
    requirements: requirements || [],
    verification: null,
    winners: [],
  }

  const frozen = ['ready', 'drawing', 'completed'].includes(giveaway.status)
  if (frozen) {
    const { data: tickets } = await supabaseAdmin
      .from('giveaway_entries')
      .select('ticket_number, participant_id')
      .eq('giveaway_id', giveaway.id)
      .order('ticket_number')

    response.verification = {
      algorithm: 'mm-hmac-sha256-v1',
      seed_commitment: giveaway.seed_commitment,
      tickets_hash: giveaway.tickets_hash,
      tickets: tickets || [],
      seed_hex: null,
      results: null,
    }
  }

  if (giveaway.status === 'completed') {
    const { data: draw } = await supabaseAdmin
      .from('giveaway_draws')
      .select('seed_hex, algorithm, completed_at, result')
      .eq('giveaway_id', giveaway.id)
      .eq('status', 'completed')
      .maybeSingle()

    if (draw && response.verification) {
      response.verification.seed_hex = draw.seed_hex
      response.verification.algorithm = draw.algorithm
      response.verification.results = draw.result?.results || null
      response.verification.completed_at = draw.completed_at
    }

    const { data: winners } = await supabaseAdmin
      .from('giveaway_winners')
      .select('participant_id, ticket_number, role, position')
      .eq('giveaway_id', giveaway.id)
      .order('role', { ascending: false })
      .order('position')

    if (winners?.length) {
      const { data: people } = await supabaseAdmin
        .from('giveaway_participants')
        .select('id, full_name')
        .in('id', winners.map(w => w.participant_id))
      const nameById = new Map((people || []).map(p => [p.id, firstName(p.full_name)]))

      response.winners = winners.map(w => ({
        role: w.role,
        position: w.position,
        ticket_number: w.ticket_number,
        participant_id: w.participant_id,
        first_name: nameById.get(w.participant_id) || 'Participante',
      }))
    }
  }

  return NextResponse.json(response)
}
