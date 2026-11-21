import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requirementStates } from '@/lib/giveaways/participation'
import {
  notFound,
  findPublicGiveaway,
  loadPublicStats,
  findParticipantByToken,
  readParticipationToken,
  withinRateLimit,
  tooManyRequests,
} from '@/lib/giveaways/server'

// Comprobante de participación: qué requisitos cumplió, qué falta, sus
// tickets y, si el sorteo terminó, si ganó. El token va en el encabezado
// x-participation-token (no en la URL de la API, para que no quede en logs).
// Un token inexistente o de otro sorteo responde 404 sin dar más información.
export async function GET(request, { params }) {
  if (!(await withinRateLimit(request, 'giveaway-participation', 60, 600))) return tooManyRequests()

  const token = readParticipationToken(request)
  if (!token) return notFound('No encontramos tu participación')

  const { slug } = await params
  const giveaway = await findPublicGiveaway(slug)
  if (!giveaway) return notFound('No encontramos ese sorteo')

  const participant = await findParticipantByToken(giveaway.id, token)
  if (!participant) return notFound('No encontramos tu participación')

  const [requirements, evidence, submissions, entries, winner, stats] = await Promise.all([
    supabaseAdmin
      .from('giveaway_requirements')
      .select('id, position, slot, kind, title, instructions')
      .eq('giveaway_id', giveaway.id)
      .order('position'),
    supabaseAdmin
      .from('giveaway_evidence')
      .select('requirement_id, attempt_no, status, rejection_reason')
      .eq('participant_id', participant.id),
    supabaseAdmin
      .from('giveaway_submissions')
      .select('requirement_id')
      .eq('participant_id', participant.id),
    supabaseAdmin
      .from('giveaway_entries')
      .select('slot, ticket_number')
      .eq('participant_id', participant.id)
      .order('slot'),
    supabaseAdmin
      .from('giveaway_winners')
      .select('role, position')
      .eq('participant_id', participant.id)
      .maybeSingle(),
    // Las cifras en vivo para dibujar la escena (son las mismas que ve cualquiera).
    loadPublicStats(giveaway),
  ])

  return NextResponse.json({
    giveaway,
    stats,
    participant: { full_name: participant.full_name, ig_handle: participant.ig_handle },
    requirements: requirementStates(requirements.data, evidence.data, submissions.data),
    entries: entries.data || [],
    winner: winner.data || null,
  })
}
