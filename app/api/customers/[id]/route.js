import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/auth'
import {
  PURCHASE_STATUSES,
  normalizePhone,
  formatPhoneDisplay,
  normalizeTags,
} from '@/lib/customers'

export async function GET(request, { params }) {
  const payload = requireAdmin(request)
  if (payload instanceof NextResponse) return payload

  const { id } = await params

  const { data: customer, error } = await supabaseAdmin
    .from('customers')
    .select('id, name, phone, phone_display, email, notes, tags, first_order_at, last_order_at, created_at')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!customer) {
    return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
  }

  // Historial completo: incluye consultas pendientes, no solo las ventas.
  const { data: orders, error: ordersError } = await supabaseAdmin
    .from('orders')
    .select('id, order_number, product_name, product_id, quantity, price_at_order, combo_items, status, created_at')
    .eq('customer_id', id)
    .order('created_at', { ascending: false })

  if (ordersError) {
    return NextResponse.json({ error: ordersError.message }, { status: 500 })
  }

  // Los pedidos vienen uno por línea. Se agrupan por order_number para que el
  // frontend pueda mostrar cada pedido una sola vez con todos sus ítems.
  const groups = new Map()

  for (const order of orders || []) {
    const key = order.order_number || order.id
    if (!groups.has(key)) {
      groups.set(key, {
        order_number: order.order_number,
        status: order.status,
        created_at: order.created_at,
        items: [],
        total: 0,
      })
    }
    const group = groups.get(key)
    const amount = Number(order.price_at_order || 0) * (Number(order.quantity) || 1)
    group.items.push({
      product_name: order.product_name,
      quantity: order.quantity,
      price_at_order: order.price_at_order,
      is_combo: Boolean(order.combo_items),
    })
    group.total += amount
  }

  const purchaseOrders = [...groups.values()].filter(group =>
    PURCHASE_STATUSES.includes(group.status)
  )

  const total_spent = purchaseOrders.reduce((sum, group) => sum + group.total, 0)

  return NextResponse.json({
    customer: {
      ...customer,
      phone_display: customer.phone_display || formatPhoneDisplay(customer.phone),
    },
    orders: [...groups.values()],
    stats: {
      // cuenta pedidos (no líneas): un combo es un pedido, no tres
      order_count: purchaseOrders.length,
      total_spent,
      avg_ticket: purchaseOrders.length ? total_spent / purchaseOrders.length : 0,
      // consultas que nunca se convirtieron: sirve para saber a quién seguir
      pending_count: [...groups.values()].filter(group => group.status === 'pending').length,
      last_order_at: customer.last_order_at,
    },
  })
}

export async function PATCH(request, { params }) {
  const payload = requireAdmin(request)
  if (payload instanceof NextResponse) return payload

  const { id } = await params

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo de la petición inválido' }, { status: 400 })
  }

  const updates = {}

  if (body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    updates.name = name || null
  }

  if (body.email !== undefined) {
    const email = typeof body.email === 'string' ? body.email.trim() : ''
    updates.email = email || null
  }

  if (body.notes !== undefined) {
    const notes = typeof body.notes === 'string' ? body.notes.trim() : ''
    updates.notes = notes || null
  }

  if (body.tags !== undefined) {
    updates.tags = normalizeTags(body.tags)
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Sin cambios para guardar' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('customers')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
  }

  return NextResponse.json({ customer: data })
}

export async function DELETE(request, { params }) {
  const payload = requireAdmin(request)
  if (payload instanceof NextResponse) return payload

  const { id } = await params

  // Las órdenes quedan con customer_id = NULL (ON DELETE SET NULL), no se
  // borran: el historial de ventas es más importante que el link al cliente.
  const { error } = await supabaseAdmin.from('customers').delete().eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
