import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { generateSeedHex, deriveDraw } from '@/lib/giveaways/draw'
import {
  requireGiveawayAdmin,
  dbErrorResponse,
  badRequest,
  notFound,
  readJson,
  uuidParam,
} from '@/lib/giveaways/server'

// Acciones que cambian el estado del sorteo. Todas son del propietario:
//   schedule   publica (genera la semilla y publica su compromiso)
//   cancel     cancela, con motivo
//   extend     reabre un sorteo cerrado con una nueva fecha de cierre, con motivo
//   freeze     congela la lista de tickets (closing -> ready)
//   draw       ejecuta el sorteo; hay que escribir el enlace del sorteo para confirmar
// Cada una es una función SQL transaccional (007_giveaways_rpc.sql).

const REASON_MAX = 300

function cleanReason(value) {
  return typeof value === 'string' ? value.trim().slice(0, REASON_MAX) : ''
}

export async function POST(request, { params }) {
  const admin = await requireGiveawayAdmin(request, { ownerOnly: true })
  if (admin instanceof NextResponse) return admin

  const id = uuidParam((await params).id)
  if (!id) return notFound('No encontramos ese sorteo')

  const body = await readJson(request)
  if (!body || typeof body.action !== 'string') return badRequest('Falta indicar la acción')

  switch (body.action) {
    case 'schedule': {
      // La semilla se genera acá, con aleatoriedad criptográfica del servidor.
      const { data, error } = await supabaseAdmin.rpc('giveaway_schedule', {
        p_giveaway_id: id,
        p_actor: admin.id,
        p_seed_hex: generateSeedHex(),
      })
      if (error) return dbErrorResponse(error)
      return NextResponse.json(data)
    }

    case 'cancel': {
      const { data, error } = await supabaseAdmin.rpc('giveaway_cancel', {
        p_giveaway_id: id,
        p_actor: admin.id,
        p_reason: cleanReason(body.reason),
      })
      if (error) return dbErrorResponse(error)
      return NextResponse.json(data)
    }

    case 'extend': {
      const endsAt = new Date(body.ends_at)
      if (Number.isNaN(endsAt.getTime())) return badRequest('La nueva fecha de cierre no es válida')
      const { data, error } = await supabaseAdmin.rpc('giveaway_extend', {
        p_giveaway_id: id,
        p_actor: admin.id,
        p_new_ends_at: endsAt.toISOString(),
        p_reason: cleanReason(body.reason),
      })
      if (error) return dbErrorResponse(error)
      return NextResponse.json(data)
    }

    case 'freeze': {
      const { data, error } = await supabaseAdmin.rpc('giveaway_freeze', {
        p_giveaway_id: id,
        p_actor: admin.id,
      })
      if (error) return dbErrorResponse(error)
      return NextResponse.json(data)
    }

    case 'draw':
      return runDraw(id, admin.id, typeof body.confirm_slug === 'string' ? body.confirm_slug : '')

    default:
      return badRequest('Acción desconocida')
  }
}

// El sorteo, en tres pasos:
//   1. begin: la base entrega la semilla y la lista congelada (o reanuda un
//      sorteo en curso si el proceso anterior se cayó).
//   2. Acá se calculan los ganadores (lib/giveaways/draw.js).
//   3. complete: la base comprueba que el resultado sea coherente con la
//      semilla comprometida y con la lista, y lo guarda junto con el cambio de
//      estado. Si ya estaba completo, devuelve el mismo resultado.
// Si el cálculo o la verificación fallan, el sorteo vuelve a "ready" para poder
// reintentar. Si falla algo de red, queda en "drawing" y volver a ejecutar lo
// reanuda.
async function runDraw(giveawayId, adminId, confirmSlug) {
  const { data: begun, error: beginError } = await supabaseAdmin.rpc('giveaway_begin_draw', {
    p_giveaway_id: giveawayId,
    p_actor: adminId,
    p_confirm_slug: confirmSlug,
  })
  if (beginError) return dbErrorResponse(beginError)

  const abort = async reason => {
    await supabaseAdmin.rpc('giveaway_abort_draw', {
      p_giveaway_id: giveawayId,
      p_actor: adminId,
      p_reason: reason,
    })
  }

  let derived
  try {
    derived = await deriveDraw({
      seedHex: begun.seed_hex,
      tickets: begun.tickets,
      winnersCount: begun.winners_count,
      alternatesCount: begun.alternates_count,
    })
  } catch (error) {
    await abort(`Error al calcular: ${error.message}`)
    return NextResponse.json(
      { error: 'No se pudo calcular el sorteo. Quedó listo para reintentar', code: 'draw_failed' },
      { status: 500 }
    )
  }

  const { data: done, error: completeError } = await supabaseAdmin.rpc('giveaway_complete_draw', {
    p_giveaway_id: giveawayId,
    p_actor: adminId,
    p_algorithm: derived.algorithm,
    p_results: derived.results,
  })

  if (completeError) {
    // Un resultado rechazado por la base no se reintenta con los mismos datos:
    // se deja el sorteo en "ready" y se avisa.
    if (/^draw_/.test(completeError.message || '')) {
      await abort(completeError.message)
    }
    return dbErrorResponse(completeError)
  }

  return NextResponse.json(done)
}
