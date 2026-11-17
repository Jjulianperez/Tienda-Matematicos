import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/auth'
import { sendNewOrderNotification } from '@/lib/email'
import { isPromotionActive, priceProductLines } from '@/lib/pricing'
import { upsertCustomerForOrder } from '@/lib/customers'

function generateOrderNumber() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ123456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return `MM-${code}`
}

function isValidQuantity(value) {
  return Number.isInteger(value) && value >= 1
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

  // Las cantidades las manda el cliente: se validan antes de usarlas.
  for (const item of body.items) {
    if (item.type === 'combo') {
      for (const comp of item.items || []) {
        if (!isValidQuantity(comp.quantity ?? 1)) {
          return NextResponse.json({ error: 'Cantidad inválida' }, { status: 400 })
        }
      }
    } else if (!isValidQuantity(item.quantity ?? 1)) {
      return NextResponse.json({ error: 'Cantidad inválida' }, { status: 400 })
    }
  }

  const involvedIds = new Set()
  for (const item of body.items) {
    if (item.type === 'combo') {
      for (const comp of item.items || []) involvedIds.add(comp.product_id)
    } else {
      involvedIds.add(item.product_id)
    }
  }

  const { data: products, error: productsError } = await supabaseAdmin
    .from('products')
    .select('id, name, price, stock, category_id')
    .in('id', [...involvedIds])

  if (productsError) {
    return NextResponse.json({ error: productsError.message }, { status: 500 })
  }

  const productMap = {}
  for (const p of products || []) productMap[p.id] = p

  const comboIds = body.items.filter(i => i.type === 'combo').map(i => i.combo_id)
  const comboMap = {}
  if (comboIds.length) {
    const { data: combos, error: combosError } = await supabaseAdmin
      .from('promotions')
      .select('*, items:promotion_items(*)')
      .in('id', comboIds)

    if (combosError) {
      return NextResponse.json({ error: combosError.message }, { status: 500 })
    }
    for (const combo of combos || []) comboMap[combo.id] = combo
  }

  // Validación de existencia y stock. La demanda se suma por producto, porque
  // una misma orden puede traer el mismo producto en varias líneas o combos.
  const demand = {}
  const productLines = []
  for (const item of body.items) {
    if (item.type === 'combo') {
      const combo = comboMap[item.combo_id]
      if (!combo || combo.type !== 'combo' || !isPromotionActive(combo)) {
        return NextResponse.json({ error: 'El combo no está disponible' }, { status: 400 })
      }
      for (const comp of item.items || []) {
        if (!productMap[comp.product_id]) {
          return NextResponse.json({ error: 'Producto del combo no encontrado' }, { status: 400 })
        }
        demand[comp.product_id] = (demand[comp.product_id] || 0) + (comp.quantity ?? 1)
      }
    } else {
      if (!productMap[item.product_id]) {
        return NextResponse.json({ error: 'Producto no encontrado' }, { status: 400 })
      }
      const quantity = item.quantity ?? 1
      demand[item.product_id] = (demand[item.product_id] || 0) + quantity
      productLines.push({ product_id: item.product_id, quantity })
    }
  }

  for (const [productId, quantity] of Object.entries(demand)) {
    const product = productMap[productId]
    if (product.stock < quantity) {
      return NextResponse.json({ error: `Sin stock suficiente de "${product.name}"` }, { status: 400 })
    }
  }

  // El precio sale siempre de la base de datos, nunca del cliente.
  let pricedLines = []
  if (productLines.length) {
    const { data: promos, error: promosError } = await supabaseAdmin
      .from('promotions')
      .select('*, items:promotion_items(*)')
      .eq('type', 'promo')
      .eq('is_active', true)

    if (promosError) {
      return NextResponse.json({ error: promosError.message }, { status: 500 })
    }

    const activePromos = (promos || []).filter(p => p.kind !== 'weight' && isPromotionActive(p))
    pricedLines = priceProductLines(productLines, productMap, activePromos)
  }

  const orderNumber = generateOrderNumber()
  const rows = []
  let pricedIndex = 0

  for (const item of body.items) {
    if (item.type === 'combo') {
      const combo = comboMap[item.combo_id]
      rows.push({
        order_number: orderNumber,
        product_id: null,
        quantity: 1,
        product_name: combo.title,
        price_at_order: Number(combo.price),
        combo_items: (item.items || []).map(comp => ({
          product_id: comp.product_id,
          name: productMap[comp.product_id].name,
          quantity: comp.quantity ?? 1,
        })),
        customer_name: customerName,
        customer_phone: customerPhone,
        status: 'pending',
      })
    } else {
      const product = productMap[item.product_id]
      const { unitPrice } = pricedLines[pricedIndex++]
      rows.push({
        order_number: orderNumber,
        product_id: product.id,
        quantity: item.quantity ?? 1,
        product_name: product.name,
        price_at_order: unitPrice,
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

  // Alta o actualización del cliente en el CRM. Va después del insert para no
  // agregar latencia al checkout, y nunca debe romper la venta: si falla, el
  // pedido ya está guardado y el cliente se puede crear desde /admin/clientes.
  try {
    await upsertCustomerForOrder({
      supabase: supabaseAdmin,
      orderNumber,
      phone: customerPhone,
      name: customerName,
    })
  } catch (customerError) {
    console.error('No se pudo registrar el cliente:', customerError)
  }

  if (body.product_id) {
    return NextResponse.json(data[0], { status: 201 })
  }

  return NextResponse.json({ order_number: orderNumber, orders: data }, { status: 201 })
}
