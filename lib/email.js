import { Resend } from 'resend'
import { getSettings } from '@/lib/settings'

const resend = new Resend(process.env.RESEND_API_KEY)

async function getAdminEmail() {
  const settings = await getSettings()
  return settings.notifications_email
}

export async function sendNewOrderNotification({ productName, price, customerName, customerPhone }) {
  const adminEmail = await getAdminEmail()
  if (!adminEmail) return

  await resend.emails.send({
    from: 'MateMáticos <onboarding@resend.dev>',
    to: adminEmail,
    subject: `🧉 Nuevo interés en: ${productName}`,
    html: `
      <h2>Nuevo interés desde el catálogo</h2>
      <p><strong>Producto:</strong> ${productName}</p>
      <p><strong>Precio:</strong> $${price}</p>
      <p><strong>Cliente:</strong> ${customerName || 'No especificado'}</p>
      <p><strong>Teléfono:</strong> ${customerPhone}</p>
      <p>Revisá el dashboard para gestionar la orden.</p>
    `,
  })
}

export async function sendTestEmail() {
  const adminEmail = await getAdminEmail()
  if (!adminEmail) {
    throw new Error('Configurá un email de notificaciones antes de enviar la prueba')
  }

  await resend.emails.send({
    from: 'MateMáticos <onboarding@resend.dev>',
    to: adminEmail,
    subject: '🧉 Email de prueba · MateMáticos',
    html: `
      <h2>¡Conexión exitosa!</h2>
      <p>Este email confirma que las notificaciones de <strong>MateMáticos</strong> llegan correctamente a esta casilla.</p>
      <p>Vas a recibir acá los avisos de nuevos pedidos del catálogo.</p>
    `,
  })
}
