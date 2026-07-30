import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/auth'

export async function PATCH(request, { params }) {
  const payload = requireAdmin(request)
  if (payload instanceof NextResponse) return payload

  const { id } = await params
  const { status } = await request.json()

  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('*, products(stock)')
    .eq('id', id)
    .single()

  if (!order) {
    return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })
  }

  if (status === 'confirmed') {
    await supabaseAdmin
      .from('products')
      .update({ stock: order.products.stock - order.quantity })
      .eq('id', order.product_id)
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
