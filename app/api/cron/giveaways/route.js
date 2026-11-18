import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { processGiveawayNotifications } from '@/lib/giveaways/notify'

// Tarea programada de sorteos. Vercel Cron la llama enviando
// "Authorization: Bearer <CRON_SECRET>". Hace tres cosas, todas idempotentes:
//   1. Transiciones por tiempo: abre los sorteos que ya empezaron y cierra los
//      que ya terminaron. NUNCA sortea: el sorteo lo confirma un administrador.
//   2. Borra contadores viejos del límite de peticiones.
//   3. Envía los avisos pendientes (el cierre de un sorteo, un sorteo realizado).
// Ejecutarla dos veces seguidas no cambia nada la segunda vez.

function authorized(request) {
  const secret = process.env.CRON_SECRET
  if (!secret || secret.length < 16) return false

  const header = request.headers.get('authorization') || ''
  const expected = Buffer.from(`Bearer ${secret}`)
  const received = Buffer.from(header)
  return expected.length === received.length && timingSafeEqual(expected, received)
}

export async function GET(request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const tick = await supabaseAdmin.rpc('giveaway_tick')
  if (tick.error) {
    console.error('Falló el cron de sorteos (tick):', tick.error.message)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }

  const purge = await supabaseAdmin.rpc('giveaway_rate_limit_purge')
  if (purge.error) console.error('No se pudo limpiar el límite de peticiones:', purge.error.message)

  const notifications = await processGiveawayNotifications()

  return NextResponse.json({
    ...tick.data,
    purged_rate_limits: purge.error ? null : purge.data,
    notifications,
  })
}
