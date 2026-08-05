import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/auth'

export async function PATCH(request, { params }) {
  const payload = requireAdmin(request)
  if (payload instanceof NextResponse) return payload

  const { id } = await params
  const { status } = await request.json()

  if (!['pending', 'confirmed', 'cancelled'].includes(status)) {
    return NextResponse.json({ error: 'Estado inválido' }, { status: 400 })
  }

  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('*')
    .eq('id', id)
    .single()

  if (!order) {
    return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })
  }

  const targets = []
  if (order.combo_items) {
    for (const comp of order.combo_items) {
      targets.push({ product_id: comp.product_id, quantity: comp.quantity })
    }
  } else if (order.product_id) {
    targets.push({ product_id: order.product_id, quantity: order.quantity })
  }

  if (targets.length) {
    const ids = targets.map(t => t.product_id)
    const { data: products } = await supabaseAdmin
      .from('products')
      .select('id, stock')
      .in('id', ids)

    const stockMap = {}
    for (const p of products || []) stockMap[p.id] = p.stock

    if (status === 'confirmed') {
      for (const t of targets) {
        const newStock = (stockMap[t.product_id] ?? 0) - t.quantity
        if (newStock < 0) {
          return NextResponse.json({ error: 'Stock insuficiente para confirmar la orden' }, { status: 400 })
        }
        await supabaseAdmin
          .from('products')
          .update({ stock: newStock })
          .eq('id', t.product_id)
      }
    } else if (status === 'cancelled' && order.status === 'confirmed') {
      for (const t of targets) {
        const newStock = (stockMap[t.product_id] ?? 0) + t.quantity
        await supabaseAdmin
          .from('products')
          .update({ stock: newStock })
          .eq('id', t.product_id)
      }
    }
  }

  const { data, error } = await supabaseAdmin
    .from('orders')
    .update({ status })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function DELETE(request, { params }) {
  const payload = requireAdmin(request)
  if (payload instanceof NextResponse) return payload

  const { id } = await params

  const { error } = await supabaseAdmin
    .from('orders')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
