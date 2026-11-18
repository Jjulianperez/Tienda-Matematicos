import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { validateReviewInput } from '@/lib/giveaways/validation'
import {
  requireGiveawayAdmin,
  dbErrorResponse,
  badRequest,
  notFound,
  readJson,
  uuidParam,
} from '@/lib/giveaways/server'

// Aprueba o rechaza una evidencia. Puede hacerlo un propietario o un revisor.
// Rechazar exige un motivo. Aprobar puede entregar la oportunidad (ticket).
export async function POST(request, { params }) {
  const admin = await requireGiveawayAdmin(request)
  if (admin instanceof NextResponse) return admin

  const { id: rawId, evidenceId: rawEvidenceId } = await params
  const id = uuidParam(rawId)
  const evidenceId = uuidParam(rawEvidenceId)
  if (!id || !evidenceId) return notFound('No encontramos esa evidencia')

  const body = await readJson(request)
  if (!body) return badRequest('Cuerpo de la petición inválido')

  const result = validateReviewInput(body)
  if (!result.ok) return badRequest('Revisá la decisión', result.errors)

  // La evidencia tiene que pertenecer al sorteo de la URL.
  const { data: evidence } = await supabaseAdmin
    .from('giveaway_evidence')
    .select('id')
    .eq('id', evidenceId)
    .eq('giveaway_id', id)
    .maybeSingle()
  if (!evidence) return notFound('No encontramos esa evidencia')

  const { data, error } = await supabaseAdmin.rpc('giveaway_review_evidence', {
    p_evidence_id: evidenceId,
    p_admin_id: admin.id,
    p_decision: result.value.decision,
    p_reason: result.value.reason ?? null,
  })

  if (error) return dbErrorResponse(error)

  return NextResponse.json(data)
}
