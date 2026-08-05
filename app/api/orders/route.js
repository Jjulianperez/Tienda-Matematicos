import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/auth'
import { sendNewOrderNotification } from '@/lib/email'

function generateOrderNumber() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ123456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return `MM-${code}`
}

export async function GET(request) {
  const payload = requireAdmin(request)
  if (payload instanceof NextResponse) return payload

  const { data: orders, error } = await supabaseAdmin
    .from('orders')
    .select('*, products(id, name, price, images)')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(orders)
}

export async function POST(request) {
  const body = await request.json()

  const customerName = body.customer_name
  const customerPhone = body.customer_phone

  if (body.product_id && !body.items) {
    body.items = [{
      type: 'product',
      product_id: body.product_id,
      quantity: body.quantity || 1,
    }]
  }

  if (!body.items?.length) {
    return NextResponse.json({ error: 'No hay items en la orden' }, { status: 400 })
  }

  const involvedIds = new Set()
  for (const item of body.items) {
    if (item.type === 'combo') {
      for (const comp of item.items || []) involvedIds.add(comp.product_id)
    } else {
      involvedIds.add(item.product_id)
    }
  }

  const { data: products } = await supabaseAdmin
    .from('products')
    .select('id, name, price, stock')
    .in('id', [...involvedIds])

  const productMap = {}
  for (const p of products || []) productMap[p.id] = p

  const comboIds = body.items.filter(i => i.type === 'combo').map(i => i.combo_id)
  const comboMap = {}
  if (comboIds.length) {
    const { data: combos } = await supabaseAdmin
      .from('promotions')
      .select('*, items:promotion_items(*)')
      .in('id', comboIds)
    for (const combo of combos || []) comboMap[combo.id] = combo
  }

  const orderNumber = generateOrderNumber()
  const rows = []

  for (const item of body.items) {
    if (item.type === 'combo') {
      const combo = comboMap[item.combo_id]
      if (!combo || combo.type !== 'combo' || !combo.is_active) {
        return NextResponse.json({ error: 'El combo no está disponible' }, { status: 400 })
      }
      for (const comp of item.items || []) {
        const product = productMap[comp.product_id]
        if (!product) {
          return NextResponse.json({ error: 'Producto del combo no encontrado' }, { status: 400 })
        }
        if (product.stock < comp.quantity) {
          return NextResponse.json({ error: `Sin stock suficiente de "${product.name}"` }, { status: 400 })
        }
      }
      rows.push({
        order_number: orderNumber,
        product_id: null,
        quantity: 1,
        product_name: item.title || combo.title,
        price_at_order: item.price ?? combo.price,
        combo_items: (item.items || []).map(comp => ({
          product_id: comp.product_id,
          name: productMap[comp.product_id]?.name || comp.name,
          quantity: comp.quantity,
        })),
        customer_name: customerName,
        customer_phone: customerPhone,
        status: 'pending',
      })
    } else {
      const product = productMap[item.product_id]
      if (!product) {
        return NextResponse.json({ error: 'Producto no encontrado' }, { status: 400 })
      }
      if (product.stock < (item.quantity || 1)) {
        return NextResponse.json({ error: `Sin stock suficiente de "${product.name}"` }, { status: 400 })
      }
      rows.push({
        order_number: orderNumber,
        product_id: product.id,
        quantity: item.quantity || 1,
        product_name: product.name,
        price_at_order: item.unit_price ?? product.price,
        combo_items: null,
        customer_name: customerName,
        customer_phone: customerPhone,
        status: 'pending',
      })
    }
  }

  const { data, error } = await supabaseAdmin
    .from('orders')
    .insert(rows)
    .select()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  for (const id of involvedIds) {
    await supabaseAdmin
      .from('products')
      .update({ whatsapp_clicks: { inc: 1 } })
      .eq('id', id)
  }

  for (const row of data) {
    await sendNewOrderNotification({
      productName: row.product_name,
      price: row.price_at_order,
      customerName: row.customer_name,
      customerPhone: row.customer_phone,
    }).catch(() => {})
  }

  if (body.product_id) {
    return NextResponse.json(data[0], { status: 201 })
  }

  return NextResponse.json({ order_number: orderNumber, orders: data }, { status: 201 })
}
