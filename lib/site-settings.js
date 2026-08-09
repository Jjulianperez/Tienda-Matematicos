export const MESSAGE_DEFAULTS = {
  wa_consult:
    'Hola, vengo del catálogo de MateMáticos.\n\nQuiero consultar por:\n*{name}*\nPrecio: ${price}\n\n¿Está disponible?',
  wa_confirm:
    'Hola, vengo del catálogo de MateMáticos.\n\nQuiero confirmar mi pedido:\n*Orden #{order_number}*\n*{name}*\nPrecio: ${price}\n¿Confirmamos el pedido?',
  wa_cart:
    'Hola, vengo del carrito de MateMáticos.\n\nQuiero confirmar mi pedido:\n*Orden #{order_number}*\n\n{items}\n\n*Subtotal: ${subtotal}*\n\nCliente: {customer_name}\nTeléfono: {customer_phone}\n\n¿Confirmamos el pedido?',
  offer_label: 'En oferta',
  promo_badge: '{pct}% OFF',
  promo_badge_qty: '{pct}% OFF en {min}+',
}

export const PUBLIC_DEFAULTS = {
  whatsapp_number: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '542657583046',
  messages: { ...MESSAGE_DEFAULTS },
}

export function formatMessage(template, vars) {
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    vars[key] !== undefined ? String(vars[key]) : match
  )
}

export function mergePublicSettings(stored) {
  return {
    whatsapp_number: stored?.whatsapp_number || PUBLIC_DEFAULTS.whatsapp_number,
    messages: { ...MESSAGE_DEFAULTS, ...(stored?.messages || {}) },
  }
}
