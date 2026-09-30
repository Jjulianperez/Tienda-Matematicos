// lib/customers.js
// Lógica de negocio para el CRM de clientes.
// NO toca stock ni altera estados de pedido: solo enlaza y agrega.

// Estados que cuentan como compra real.
// `pending` es una consulta, no una venta → no cuenta.
// `cancelled` → no cuenta.
// Cuando agregues los estados nuevos (Bloque 0.2: preparando/enviado/entregado),
// sumalos acá. Es el único lugar que hay que tocar.
export const PURCHASE_STATUSES = ['confirmed', 'preparing', 'shipped', 'delivered']

/**
 * Normaliza un teléfono a E.164-esque canónico: 54 + área + número, sin el 9
 * de móvil y sin ceros de troncalidad.
 *
 * Objetivo: que +54 9 11 5555-4444, 011 15 5555-4444 y (011) 5555-4444
 * produzcan todos la misma clave.
 *
 * @param {string} raw
 * @returns {string} clave canónica, o '' si no hay dígitos útiles
 */
export function normalizePhone(raw) {
  if (!raw || typeof raw !== 'string') return ''

  let d = raw.replace(/\D/g, '')
  if (!d) return ''

  // Prefijo internacional escrito como 0054...
  if (d.startsWith('00')) d = d.slice(2)

  // Código de país Argentina presente explícitamente
  if (d.startsWith('54') && (d.length === 12 || d.length === 13)) {
    d = d.slice(2)
    // El 9 de móvil internacional va justo después del código de país
    if (d.length === 11 && d.startsWith('9')) d = d.slice(1)
  } else if (d.startsWith('0')) {
    // Prefijo de troncalidad: 011 15 XXXX-XXXX / 011 XXXX-XXXX
    d = d.slice(1)
    // Marcador de móvil "15" después del código de área (2 dígitos).
    // Tras quitar el 0 quedan 12 dígitos, y al sacar el "15" quedan 10.
    if (d.length === 12 && d.slice(2, 4) === '15') d = d.slice(0, 2) + d.slice(4)
  }

  // Número local de 10 dígitos (área de 2 + 8) o de 9 (área de 3 + 6)
  if (d.length === 10 || d.length === 9) d = `54${d}`

  return d
}

/**
 * Códigos de área argentinos de 3 dígitos.
 *
 * Hace falta porque el plan de numeración es irregular: hay áreas de 2 y de 3
 * dígitos, y en ambos casos el número local tiene 10 dígitos. Solo con el largo
 * no se puede distinguirlos, así que se consulta esta lista. Los que no están
 * se muestran asumiendo área de 2 dígitos (CABA y Buenos Aires).
 *
 * Lista de heurística de formato, a propósito incompleta: alcanza para las
 * ciudades grandes. Si el resultado importa, se agrega el código acá y es una
 * línea. Ojo: un código QUE NO SEA agregue es peor que uno que falte, porque
 * formatea mal un teléfono válido, así que conviene verificar antes de sumar.
 *
 * En la práctica esto casi no se usa: la API devuelve `phone_display` (lo que
 * escribió el cliente) cuando existe, y esto es solo el respaldo para clientes
 * creados sin ese dato.
 */
const THREE_DIGIT_AREA_CODES = new Set([
  // Buenos Aires (GBA/interior)
  '223', '230', '236', '237', '238', '239', '247', '249',
  // Patagonia
  '260', '261', '262', '263', '264', '265', '266',
  '290', '291', '292', '293', '294', '299',
  // Litoral / Santa Fe / Entre Ríos
  '336', '337', '338', '340', '341', '342', '343', '344', '345', '346', '348',
  // Centro
  '351', '352', '353', '354', '358',
  // Norte / Noroeste
  '362', '364', '370', '376', '378', '379',
  '380', '381', '382', '383', '384', '385', '386', '387', '388',
])

/**
 * Formato legible para pantalla. No se usa como clave.
 *
 * Se apoya en normalizePhone() en vez de parsear el input por su cuenta: así
 * no hay dos reglas de parseo que puedan divergir. Es idempotente, o sea que
 * formatear un teléfono ya normalizado devuelve el mismo resultado.
 *
 * @param {string} raw
 * @returns {string}
 */
export function formatPhoneDisplay(raw) {
  if (!raw || typeof raw !== 'string') return raw || ''

  const canonical = normalizePhone(raw)
  // Teléfono que no se puede normalizar (texto, vacío, etc.): se muestra tal cual.
  if (!canonical) return raw

  // normalizePhone siempre deja el código de país 54 al principio.
  const local = canonical.startsWith('54') ? canonical.slice(2) : canonical

  // 10 dígitos locales => área de 2 o de 3. Hay que desambiguar.
  if (local.length === 10) {
    if (THREE_DIGIT_AREA_CODES.has(local.slice(0, 3))) {
      return `+54 ${local.slice(0, 3)} ${local.slice(3, 6)}-${local.slice(6)}`
    }
    return `+54 ${local.slice(0, 2)} ${local.slice(2, 6)}-${local.slice(6)}`
  }

  // 9 dígitos locales => área de 3 + 6 dígitos (numeración antigua)
  if (local.length === 9) {
    return `+54 ${local.slice(0, 3)} ${local.slice(3, 6)}-${local.slice(6)}`
  }

  // Largo no reconocido: se muestra la clave canónica sin inventar estructura.
  return `+${canonical}`
}

/**
 * Escapa wildcards de Postgres para usar dentro de un filtro `ilike`.
 * Sin esto, un cliente que busque "a_b" matchea cualquier cosa.
 * @param {string} q
 * @returns {string}
 */
export function sanitizeSearchTerm(q) {
  if (!q) return ''
  return q.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

/**
 * Normaliza una lista de etiquetas: strings, sin espacios, en minúscula,
 * sin duplicados y acotadas a 20.
 * @param {unknown} input
 * @returns {string[]}
 */
export function normalizeTags(input) {
  if (!Array.isArray(input)) return []
  return [
    ...new Set(
      input
        .filter(tag => typeof tag === 'string')
        .map(tag => tag.trim().toLowerCase())
        .filter(Boolean)
    ),
  ].slice(0, 20)
}

/**
 * @param {string} status
 * @returns {boolean}
 */
export function isPurchaseStatus(status) {
  return PURCHASE_STATUSES.includes(status)
}

/**
 * Recalcula los promedios y totales de un cliente a partir de sus órdenes.
 * Útil para el dashboard del admin o para una corrección manual.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} customerId
 * @returns {Promise<{order_count: number, total_spent: number, avg_ticket: number}>}
 */
export async function computeCustomerStats(supabase, customerId) {
  const { data, error } = await supabase
    .from('orders')
    .select('price_at_order, quantity')
    .eq('customer_id', customerId)
    .in('status', PURCHASE_STATUSES)

  if (error) throw new Error(error.message)

  const rows = data || []
  const order_count = rows.length
  const total_spent = rows.reduce(
    (sum, r) => sum + Number(r.price_at_order || 0) * (Number(r.quantity) || 1),
    0
  )
  const avg_ticket = order_count > 0 ? total_spent / order_count : 0

  return { order_count, total_spent, avg_ticket }
}

/**
 * Crea o actualiza el cliente a partir de un pedido y enlaza el pedido.
 *
 * Pensado para llamarse desde POST /api/orders después del insert. Se dispara
 * "fire and forget" en el route handler: si falla, la venta NO se cae.
 *
 * No toca stock ni modifica el status de la orden.
 *
 * @param {object} params
 * @param {import('@supabase/supabase-js').SupabaseClient} params.supabase
 * @param {string} params.orderNumber
 * @param {string} [params.phone]
 * @param {string} [params.name]
 * @returns {Promise<string|null>} id del cliente, o null si no hay teléfono
 */
export async function upsertCustomerForOrder({ supabase, orderNumber, phone, name }) {
  const normalized = normalizePhone(phone)
  if (!normalized) return null

  const { data: existing, error: findError } = await supabase
    .from('customers')
    .select('id, name, phone_display')
    .eq('phone', normalized)
    .maybeSingle()

  if (findError) throw new Error(findError.message)

  const trimmedName = typeof name === 'string' ? name.trim() : ''

  let customerId = existing?.id || null

  if (existing) {
    // Solo completamos el nombre si estaba vacío: no sobreescribimos el que
    // el admin haya corregido a mano.
    const patch = { phone_display: existing.phone_display || formatPhoneDisplay(phone) }
    if (!existing.name && trimmedName) patch.name = trimmedName

    const { error: updateError } = await supabase
      .from('customers')
      .update(patch)
      .eq('id', existing.id)

    if (updateError) throw new Error(updateError.message)
  } else {
    const { data: created, error: insertError } = await supabase
      .from('customers')
      .insert({
        name: trimmedName || null,
        phone: normalized,
        phone_display: formatPhoneDisplay(phone),
      })
      .select('id')
      .single()

    if (insertError) throw new Error(insertError.message)
    customerId = created.id
  }

  // Enlaza las líneas del pedido que aún no tengan cliente.
  const { error: linkError } = await supabase
    .from('orders')
    .update({ customer_id: customerId })
    .eq('order_number', orderNumber)
    .is('customer_id', null)

  if (linkError) throw new Error(linkError.message)

  // Refresca las fechas cacheadas del cliente.
  const { data: datedOrders } = await supabase
    .from('orders')
    .select('created_at')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: true })

  if (datedOrders?.length) {
    await supabase
      .from('customers')
      .update({
        first_order_at: datedOrders[0].created_at,
        last_order_at: datedOrders[datedOrders.length - 1].created_at,
      })
      .eq('id', customerId)
  }

  return customerId
}
