import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { validateAnswerInput } from '@/lib/giveaways/validation'
import {
  dbErrorResponse,
  badRequest,
  notFound,
  readJson,
  findPublicGiveaway,
  findParticipantByToken,
  readParticipationToken,
  withinRateLimit,
  tooManyRequests,
} from '@/lib/giveaways/server'

// Respuesta a un requisito sin archivo: declaración, texto o enlace.
// Si con esto se cumplen todos los requisitos de una oportunidad, la base
// entrega el ticket en la misma transacción.
export async function POST(request, { params }) {
  if (!(await withinRateLimit(request, 'giveaway-answer', 30, 600))) return tooManyRequests()

  const token = readParticipationToken(request)
  if (!token) return notFound('No encontramos tu participación')

  const body = await readJson(request)
  if (!body) return badRequest('Cuerpo de la petición inválido')

  const result = validateAnswerInput(body)
  if (!result.ok) return badRequest('Revisá la respuesta', result.errors)

  const { slug } = await params
  const giveaway = await findPublicGiveaway(slug)
  if (!giveaway) return notFound('No encontramos ese sorteo')

  const participant = await findParticipantByToken(giveaway.id, token)
  if (!participant) return notFound('No encontramos tu participación')

  const { data, error } = await supabaseAdmin.rpc('giveaway_submit_answer', {
    p_participant_id: participant.id,
    p_requirement_id: result.value.requirement_id,
    p_payload: result.value.payload,
  })

  if (error) return dbErrorResponse(error)

  return NextResponse.json(data)
}
