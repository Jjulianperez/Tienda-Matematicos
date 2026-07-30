import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/auth'
import { sendNewOrderNotification } from '@/lib/email'

export async function GET(request) {
  const payload = requireAdmin(request)
  if (payload instanceof NextResponse) return payload

  const { data: orders, error } = await supabaseAdmin
    .from('orders')
    .select('*, products(name, price)')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(orders)
}

export async function POST(request) {
  const body = await request.json()

  const { data: product } = await supabaseAdmin
    .from('products')
    .select('name, price')
    .eq('id', body.product_id)
    .single()

  const { data, error } = await supabaseAdmin
    .from('orders')
    .insert({
      product_id: body.product_id,
      quantity: body.quantity || 1,
      customer_name: body.customer_name,
      customer_phone: body.customer_phone,
      status: 'pending',
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await supabaseAdmin
    .from('products')
    .update({ whatsapp_clicks: (product?.whatsapp_clicks || 0) + 1 })
    .eq('id', body.product_id)

  await sendNewOrderNotification({
    productName: product?.name,
    price: product?.price,
    customerName: body.customer_name,
    customerPhone: body.customer_phone,
  }).catch(() => {})

  return NextResponse.json(data, { status: 201 })
}
