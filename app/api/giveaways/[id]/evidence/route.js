import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  requireGiveawayAdmin,
  dbErrorResponse,
  notFound,
  uuidParam,
} from '@/lib/giveaways/server'

const STATUSES = ['pending', 'approved', 'rejected']

// Cola de evidencias de un sorteo. Por defecto, las pendientes.
// Las capturas NO vienen acá: se piden una por una con una URL firmada de vida corta.
export async function GET(request, { params }) {
  const admin = await requireGiveawayAdmin(request)
  if (admin instanceof NextResponse) return admin

  const id = uuidParam((await params).id)
  if (!id) return notFound('No encontramos ese sorteo')

  const { searchParams } = new URL(request.url)
  const status = STATUSES.includes(searchParams.get('status')) ? searchParams.get('status') : 'pending'
  const page = Math.max(Number(searchParams.get('page')) || 1, 1)
  const perPage = Math.min(Math.max(Number(searchParams.get('perPage')) || 20, 1), 50)
  const from = (page - 1) * perPage

  const { data: rows, error, count } = await supabaseAdmin
    .from('giveaway_evidence')
    .select('id, participant_id, requirement_id, attempt_no, mime, size_bytes, status, rejection_reason, reviewed_at, created_at', { count: 'exact' })
    .eq('giveaway_id', id)
    .eq('status', status)
    .order('created_at', { ascending: true })
    .range(from, from + perPage - 1)

  if (error) return dbErrorResponse(error)

  const evidence = rows || []
  const participantIds = [...new Set(evidence.map(e => e.participant_id))]
  const requirementIds = [...new Set(evidence.map(e => e.requirement_id))]

  const [people, requirements] = await Promise.all([
    participantIds.length
      ? supabaseAdmin.from('giveaway_participants').select('id, full_name, ig_handle').in('id', participantIds)
      : { data: [] },
    requirementIds.length
      ? supabaseAdmin.from('giveaway_requirements').select('id, title, slot').in('id', requirementIds)
      : { data: [] },
  ])

  const peopleById = new Map((people.data || []).map(p => [p.id, p]))
  const requirementsById = new Map((requirements.data || []).map(r => [r.id, r]))

  return NextResponse.json({
    evidence: evidence.map(e => ({
      ...e,
      participant: peopleById.get(e.participant_id) || null,
      requirement: requirementsById.get(e.requirement_id) || null,
    })),
    total: count ?? evidence.length,
    page,
    perPage,
    status,
  })
}
