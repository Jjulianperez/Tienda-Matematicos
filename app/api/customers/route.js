import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/auth'
import {
  PURCHASE_STATUSES,
  normalizePhone,
  formatPhoneDisplay,
  sanitizeSearchTerm,
  normalizeTags,
  summarizePurchaseRows,
} from '@/lib/customers'
import { fetchAll } from '@/lib/supabase-pagination'

const FIELDS =
  'id, name, phone, phone_display, email, notes, tags, first_order_at, last_order_at, created_at'

const SORTS = ['last_order_at', 'total_spent', 'name', 'created_at']

const PER_PAGE_MAX = 100

// Cuántos ids de cliente se mandan por consulta de pedidos. Con miles de
// clientes, `.in()` con todos los ids supera el largo de URL y los totales
// salían en 0 sin aviso (H7).
const CUSTOMER_ID_CHUNK = 200

// Compara por un campo ya enriquecido con las estadísticas (por eso `sort`
// puede ser 'total_spent' aunque no sea una columna de customers).
// `direction` es 1 para ascendente y -1 para descendente.
// Los nulos siempre caen al final, sin importar la dirección.
function compare(a, b, key, direction) {
  const va = a[key]
  const vb = b[key]
  const aIsNull = va === null || va === undefined
  const bIsNull = vb === null || vb === undefined
  if (aIsNull && bIsNull) return 0
  if (aIsNull) return 1
  if (bIsNull) return -1
  if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * direction
  return String(va).localeCompare(String(vb), 'es', { sensitivity: 'base' }) * direction
}

// Orden por defecto de cada criterio, cuando el frontend no manda `order`.
const DEFAULT_ORDER = {
  last_order_at: 'desc',
  total_spent: 'desc',
  name: 'asc',
  created_at: 'desc',
}

export async function GET(request) {
  const payload = requireAdmin(request)
  if (payload instanceof NextResponse) return payload

  const { searchParams } = new URL(request.url)
  const q = (searchParams.get('q') || '').trim()
  const tag = (searchParams.get('tag') || '').trim()
  const sortKey = SORTS.includes(searchParams.get('sort'))
    ? searchParams.get('sort')
    : 'last_order_at'
  const orderParam = searchParams.get('order')
  const order = orderParam === 'asc' || orderParam === 'desc'
    ? orderParam
    : DEFAULT_ORDER[sortKey]
  const page = Math.max(Number(searchParams.get('page')) || 1, 1)
  const perPage = Math.min(
    Math.max(Number(searchParams.get('perPage')) || 25, 1),
    PER_PAGE_MAX
  )

  try {
    // El orden por total_spent y order_count se calcula en memoria, así que
    // hay que tener TODOS los clientes que matchean el filtro antes de
    // ordenar y paginar. Leer solo la primera página daba un orden incorrecto.
    const customers = await fetchAll(() => buildCustomersQuery(q, tag))

    // Los totales no viven en la tabla: salen de un agregado sobre orders.
    // Se calculan en cada request en vez de guardarse, así no pueden
    // desincronizarse cuando una orden se cancela o se borra.
    const enriched = await attachStats(customers)

    enriched.sort((a, b) => compare(a, b, sortKey, order === 'asc' ? 1 : -1))

    const from = (page - 1) * perPage

    // Etiquetas existentes, para poblar el filtro. Se leen todas en vez de
    // deducirlas de la página visible: si no, al filtrar por una etiqueta
    // desaparecerían las demás opciones y no se podría cambiar de filtro.
    const tagRows = await fetchAll(() =>
      supabaseAdmin
        .from('customers')
        .select('id, tags')
        .not('tags', 'is', null)
        .order('id')
    )

    const availableTags = [
      ...new Set(tagRows.flatMap(row => row.tags || [])),
    ].sort((a, b) => a.localeCompare(b, 'es'))

    return NextResponse.json({
      customers: enriched.slice(from, from + perPage),
      total: enriched.length,
      page,
      perPage,
      sort: sortKey,
      available_tags: availableTags,
    })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

function buildCustomersQuery(q, tag) {
  let query = supabaseAdmin.from('customers').select(FIELDS).order('id')

  if (q) {
    const term = sanitizeSearchTerm(q)
    const conditions = [
      `name.ilike.%${term}%`,
      `email.ilike.%${term}%`,
      `phone_display.ilike.%${term}%`,
    ]
    const normalized = normalizePhone(q)
    if (normalized) {
      conditions.push(`phone.ilike.%${sanitizeSearchTerm(normalized)}%`)
    }
    query = query.or(conditions.join(','))
  }

  if (tag) {
    query = query.contains('tags', [tag])
  }

  return query
}

async function attachStats(customers) {
  if (!customers.length) return []

  const ids = customers.map(c => c.id)

  // `id` hace falta: hay filas legadas sin order_number y se usan como clave
  // propia (ver summarizePurchaseRows). Sin seleccionarlo, todas colapsan en la
  // misma clave `undefined` y el cliente figura con menos pedidos de los que tiene.
  const orders = []
  for (let i = 0; i < ids.length; i += CUSTOMER_ID_CHUNK) {
    const chunk = ids.slice(i, i + CUSTOMER_ID_CHUNK)
    const rows = await fetchAll(() =>
      supabaseAdmin
        .from('orders')
        .select('id, customer_id, order_number, price_at_order, quantity')
        .in('status', PURCHASE_STATUSES)
        .in('customer_id', chunk)
        .order('id')
    )
    orders.push(...rows)
  }

  // Un pedido puede tener varias líneas (una fila por ítem). Se cuentan
  // PEDIDOS distintos, no filas: si no, un pedido de 2 ítems figuraría como 2
  // en el listado y como 1 en el detalle. Las filas sin order_number cuentan
  // como un pedido cada una (por eso el select de arriba incluye `id`).
  const { orderCounts, totalSpent } = summarizePurchaseRows(orders)

  return customers.map(customer => ({
    ...customer,
    phone_display: customer.phone_display || formatPhoneDisplay(customer.phone),
    order_count: orderCounts.get(customer.id) || 0,
    total_spent: totalSpent.get(customer.id) || 0,
  }))
}

export async function POST(request) {
  const payload = requireAdmin(request)
  if (payload instanceof NextResponse) return payload

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo de la petición inválido' }, { status: 400 })
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const phone = normalizePhone(body.phone)

  if (!phone) {
    return NextResponse.json({ error: 'Ingresá un teléfono válido' }, { status: 400 })
  }

  const email = typeof body.email === 'string' ? body.email.trim() : ''
  const notes = typeof body.notes === 'string' ? body.notes.trim() : ''

  const { data, error } = await supabaseAdmin
    .from('customers')
    .insert({
      name: name || null,
      phone,
      phone_display: formatPhoneDisplay(body.phone),
      email: email || null,
      notes: notes || null,
      tags: normalizeTags(body.tags),
    })
    .select()
    .single()

  if (error) {
    // 23505 = unique_violation
    if (error.code === '23505') {
      return NextResponse.json(
        { error: `Ya existe un cliente con el teléfono ${formatPhoneDisplay(phone)}` },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ customer: data }, { status: 201 })
}
