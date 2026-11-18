// Envío de los avisos pendientes de la tabla giveaway_notifications (outbox).
//
// El sorteo nunca depende de que un email salga: el aviso se encola dentro de
// la misma transacción que el cambio de estado, y este proceso (el cron) lo
// envía después. Si Resend falla, queda pendiente y se reintenta; la
// dedupe_key de la tabla evita que el mismo aviso se encole dos veces.

import { Resend } from 'resend'
import { supabaseAdmin } from '@/lib/supabase'
import { getSettings } from '@/lib/settings'

const MAX_ATTEMPTS = 5
const BATCH = 20

const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ENTITIES[ch])

function messageFor(kind, giveaway) {
  const title = escapeHtml(giveaway?.title || 'Sorteo')
  if (kind === 'giveaway_closed') {
    return {
      subject: `🎁 Cerró el sorteo: ${giveaway?.title || ''}`.trim(),
      html: `
        <h2>Cerró la inscripción</h2>
        <p>El sorteo <strong>${title}</strong> terminó su período de participación.</p>
        <p>Para seguir: revisá las evidencias pendientes, congelá la lista de tickets y confirmá el sorteo desde el panel.</p>
      `,
    }
  }
  if (kind === 'giveaway_completed') {
    return {
      subject: `🏆 Sorteo realizado: ${giveaway?.title || ''}`.trim(),
      html: `
        <h2>El sorteo se realizó</h2>
        <p>El sorteo <strong>${title}</strong> ya tiene ganadores. Podés verlos en el panel.</p>
      `,
    }
  }
  return null
}

/**
 * Envía hasta BATCH avisos pendientes. Devuelve { sent, failed, skipped }.
 * Nunca lanza: un problema de envío no debe romper el cron.
 */
export async function processGiveawayNotifications() {
  const result = { sent: 0, failed: 0, skipped: 0 }

  try {
    const { data: pending, error } = await supabaseAdmin
      .from('giveaway_notifications')
      .select('id, giveaway_id, kind, attempts')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(BATCH)

    if (error || !pending?.length) return result

    const settings = await getSettings()
    const adminEmail = settings.notifications_email
    if (!adminEmail || !process.env.RESEND_API_KEY) {
      result.skipped = pending.length
      return result
    }
    const resend = new Resend(process.env.RESEND_API_KEY)

    for (const item of pending) {
      const { data: giveaway } = await supabaseAdmin
        .from('giveaways')
        .select('title')
        .eq('id', item.giveaway_id)
        .maybeSingle()

      const message = messageFor(item.kind, giveaway)
      if (!message) {
        await supabaseAdmin
          .from('giveaway_notifications')
          .update({ status: 'failed', last_error: 'tipo de aviso desconocido' })
          .eq('id', item.id)
        result.failed += 1
        continue
      }

      try {
        const { error: sendError } = await resend.emails.send({
          from: 'MateMáticos <onboarding@resend.dev>',
          to: adminEmail,
          subject: message.subject,
          html: message.html,
        })
        if (sendError) throw new Error(sendError.message || 'Resend rechazó el envío')

        await supabaseAdmin
          .from('giveaway_notifications')
          .update({ status: 'sent', sent_at: new Date().toISOString(), attempts: item.attempts + 1 })
          .eq('id', item.id)
        result.sent += 1
      } catch (sendError) {
        const attempts = item.attempts + 1
        await supabaseAdmin
          .from('giveaway_notifications')
          .update({
            attempts,
            last_error: String(sendError.message || sendError).slice(0, 300),
            status: attempts >= MAX_ATTEMPTS ? 'failed' : 'pending',
          })
          .eq('id', item.id)
        result.failed += 1
      }
    }
  } catch (error) {
    console.error('No se pudieron procesar los avisos de sorteos:', error?.message || error)
  }

  return result
}
