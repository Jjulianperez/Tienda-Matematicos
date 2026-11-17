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

  // Estado y stock cambian en una sola transacción (migración 004_set_order_status.sql).
  const { data, error } = await supabaseAdmin.rpc('set_order_status', {
    p_order_id: id,
    p_status: status,
  })

  if (error) {
    const message = error.message || 'Error al actualizar la orden'
    if (message.includes('no encontrada')) {
      return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })
    }
    if (message.includes('Stock insuficiente') || message.includes('Estado inválido')) {
      return NextResponse.json({ error: message }, { status: 400 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
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
