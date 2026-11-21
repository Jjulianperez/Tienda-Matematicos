import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { validateRequirementInput } from '@/lib/giveaways/validation'
import {
  requireGiveawayAdmin,
  dbErrorResponse,
  badRequest,
  notFound,
  readJson,
  uuidParam,
} from '@/lib/giveaways/server'

export async function PATCH(request, { params }) {
  const admin = await requireGiveawayAdmin(request, { ownerOnly: true })
  if (admin instanceof NextResponse) return admin

  const { id: rawId, reqId: rawReqId } = await params
  const id = uuidParam(rawId)
  const reqId = uuidParam(rawReqId)
  if (!id || !reqId) return notFound('No encontramos ese requisito')

  const body = await readJson(request)
  if (!body) return badRequest('Cuerpo de la petición inválido')

  const result = validateRequirementInput(body, { partial: true })
  if (!result.ok) return badRequest('Revisá los datos del requisito', result.errors)
  if (Object.keys(result.value).length === 0) return badRequest('No hay cambios para guardar')

  const { data, error } = await supabaseAdmin
    .from('giveaway_requirements')
    .update(result.value)
    .eq('id', reqId)
    .eq('giveaway_id', id)
    .select()
    .maybeSingle()

  if (error) return dbErrorResponse(error)
  if (!data) return notFound('No encontramos ese requisito')

  return NextResponse.json(data)
}

export async function DELETE(request, { params }) {
  const admin = await requireGiveawayAdmin(request, { ownerOnly: true })
  if (admin instanceof NextResponse) return admin

  const { id: rawId, reqId: rawReqId } = await params
  const id = uuidParam(rawId)
  const reqId = uuidParam(rawReqId)
  if (!id || !reqId) return notFound('No encontramos ese requisito')

  const { error } = await supabaseAdmin
    .from('giveaway_requirements')
    .delete()
    .eq('id', reqId)
    .eq('giveaway_id', id)

  if (error) return dbErrorResponse(error)

  return NextResponse.json({ success: true })
}
