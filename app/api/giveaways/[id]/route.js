import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { validateGiveawayInput } from '@/lib/giveaways/validation'
import {
  requireGiveawayAdmin,
  dbErrorResponse,
  badRequest,
  notFound,
  readJson,
  uuidParam,
} from '@/lib/giveaways/server'

// Detalle completo para el panel: sorteo, requisitos, conteos, ganadores,
// resultado del sorteo y las últimas acciones de auditoría.
// La semilla secreta NO sale de acá: vive en otra tabla y se revela recién al sortear.
export async function GET(request, { params }) {
  const admin = await requireGiveawayAdmin(request)
  if (admin instanceof NextResponse) return admin

  const id = uuidParam((await params).id)
  if (!id) return notFound('No encontramos ese sorteo')

  const { data: giveaway, error } = await supabaseAdmin
    .from('giveaways')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) return dbErrorResponse(error)
  if (!giveaway) return notFound('No encontramos ese sorteo')

  const [requirements, overview, winnerRows, draw, audit] = await Promise.all([
    supabaseAdmin.from('giveaway_requirements').select('*').eq('giveaway_id', id).order('position'),
    supabaseAdmin.rpc('giveaway_admin_overview', { p_giveaway_id: id }),
    supabaseAdmin
      .from('giveaway_winners')
      .select('id, participant_id, ticket_number, role, position, status')
      .eq('giveaway_id', id)
      .order('role', { ascending: false })
      .order('position'),
    supabaseAdmin
      .from('giveaway_draws')
      .select('id, status, algorithm, seed_commitment, seed_hex, tickets_hash, tickets_count, started_at, completed_at, failed_reason')
      .eq('giveaway_id', id)
      .order('started_at', { ascending: false }),
    supabaseAdmin
      .from('giveaway_audit_logs')
      .select('id, actor_admin_id, action, reason, created_at')
      .eq('giveaway_id', id)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  // Los datos de contacto de los ganadores se piden aparte (sin depender de
  // relaciones compuestas entre tablas).
  let winners = winnerRows.data || []
  if (winners.length) {
    const { data: people } = await supabaseAdmin
      .from('giveaway_participants')
      .select('id, full_name, phone_display, email, ig_handle')
      .in('id', winners.map(w => w.participant_id))
    const byId = new Map((people || []).map(p => [p.id, p]))
    winners = winners.map(w => ({ ...w, participant: byId.get(w.participant_id) || null }))
  }

  return NextResponse.json({
    giveaway,
    requirements: requirements.data || [],
    overview: overview.data || null,
    winners,
    draws: draw.data || [],
    audit: audit.data || [],
    admin_role: admin.role,
  })
}

// Edición. Se manda `version` (la que se leyó): si alguien más guardó antes,
// responde 409 en vez de pisar sus cambios. Después de publicar, la base
// rechaza los campos que ya no se pueden tocar.
export async function PATCH(request, { params }) {
  const admin = await requireGiveawayAdmin(request, { ownerOnly: true })
  if (admin instanceof NextResponse) return admin

  const id = uuidParam((await params).id)
  if (!id) return notFound('No encontramos ese sorteo')

  const body = await readJson(request)
  if (!body) return badRequest('Cuerpo de la petición inválido')
  if (!Number.isInteger(body.version)) return badRequest('Falta la versión del sorteo')

  const result = validateGiveawayInput(body, { partial: true })
  if (!result.ok) return badRequest('Revisá los datos del sorteo', result.errors)
  if (Object.keys(result.value).length === 0) return badRequest('No hay cambios para guardar')

  const { data, error } = await supabaseAdmin
    .from('giveaways')
    .update({ ...result.value, version: body.version + 1 })
    .eq('id', id)
    .eq('version', body.version)
    .select()
    .maybeSingle()

  if (error) return dbErrorResponse(error)
  if (!data) {
    return NextResponse.json(
      { error: 'El sorteo cambió mientras lo editabas. Recargá la página y volvé a intentar', code: 'version_conflict' },
      { status: 409 }
    )
  }

  return NextResponse.json(data)
}

// Solo se borran borradores y sorteos cancelados (lo hace cumplir un trigger).
export async function DELETE(request, { params }) {
  const admin = await requireGiveawayAdmin(request, { ownerOnly: true })
  if (admin instanceof NextResponse) return admin

  const id = uuidParam((await params).id)
  if (!id) return notFound('No encontramos ese sorteo')

  const { error } = await supabaseAdmin.from('giveaways').delete().eq('id', id)
  if (error) return dbErrorResponse(error)

  return NextResponse.json({ success: true })
}
