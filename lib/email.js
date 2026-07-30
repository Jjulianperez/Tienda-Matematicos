import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendNewOrderNotification({ productName, price, customerName, customerPhone }) {
  const adminEmail = process.env.RESEND_TO_EMAIL

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
