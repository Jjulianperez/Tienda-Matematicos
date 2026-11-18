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

// Agrega un requisito. La base solo lo permite en borrador o programado.
export async function POST(request, { params }) {
  const admin = await requireGiveawayAdmin(request, { ownerOnly: true })
  if (admin instanceof NextResponse) return admin

  const id = uuidParam((await params).id)
  if (!id) return notFound('No encontramos ese sorteo')

  const body = await readJson(request)
  if (!body) return badRequest('Cuerpo de la petición inválido')

  const result = validateRequirementInput(body)
  if (!result.ok) return badRequest('Revisá los datos del requisito', result.errors)

  // Sin posición explícita, va al final.
  let position = result.value.position
  if (!position) {
    const { data: last } = await supabaseAdmin
      .from('giveaway_requirements')
      .select('position')
      .eq('giveaway_id', id)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle()
    position = (last?.position || 0) + 1
  }

  const { data, error } = await supabaseAdmin
    .from('giveaway_requirements')
    .insert({ ...result.value, position, giveaway_id: id })
    .select()
    .single()

  if (error) return dbErrorResponse(error)

  return NextResponse.json(data, { status: 201 })
}
