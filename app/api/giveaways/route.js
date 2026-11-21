import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { validateGiveawayInput } from '@/lib/giveaways/validation'
import {
  requireGiveawayAdmin,
  dbErrorResponse,
  badRequest,
  readJson,
  advanceGiveaways,
} from '@/lib/giveaways/server'

// Lista de sorteos con sus conteos (participantes, tickets, evidencias pendientes).
export async function GET(request) {
  const admin = await requireGiveawayAdmin(request)
  if (admin instanceof NextResponse) return admin

  await advanceGiveaways()
  const { data, error } = await supabaseAdmin.rpc('giveaway_admin_list')
  if (error) return dbErrorResponse(error)

  return NextResponse.json(data || [])
}

// Crea un sorteo en borrador. Publicarlo es una acción aparte (actions/schedule).
export async function POST(request) {
  const admin = await requireGiveawayAdmin(request)
  if (admin instanceof NextResponse) return admin

  const body = await readJson(request)
  if (!body) return badRequest('Cuerpo de la petición inválido')

  const result = validateGiveawayInput(body)
  if (!result.ok) return badRequest('Revisá los datos del sorteo', result.errors)

  const { data, error } = await supabaseAdmin
    .from('giveaways')
    .insert({ ...result.value, created_by: admin.id })
    .select()
    .single()

  if (error) return dbErrorResponse(error)

  return NextResponse.json(data, { status: 201 })
}
