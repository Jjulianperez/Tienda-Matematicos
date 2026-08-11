import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/auth'

function validatePromotion(body) {
  if (!body.title?.trim()) return 'El título es obligatorio'
  if (!['combo', 'promo'].includes(body.type)) return 'Tipo inválido'

  const kind = body.kind || 'quantity'
  if (!['quantity', 'weight'].includes(kind)) return 'Tipo de descuento inválido'

  if (body.type === 'combo') {
    if (!body.price || Number(body.price) <= 0) return 'El precio del combo es obligatorio'
    if (!body.items?.length) return 'El combo necesita al menos un producto'
    if (body.items.some(i => !i.product_id)) return 'Los items de un combo deben ser productos'
  }

  if (body.type === 'promo') {
    if (!['percent', 'fixed'].includes(body.discount_type)) return 'Tipo de descuento inválido'
    if (!body.discount_value || Number(body.discount_value) <= 0) return 'El descuento es obligatorio'
    if (!body.items?.length) return 'La promo necesita un producto o categoría'

    if (kind === 'weight') {
      if (body.discount_type !== 'percent') return 'El descuento por peso solo admite porcentaje'
      if (!Number(body.min_weight) || Number(body.min_weight) <= 0) return 'El peso mínimo es obligatorio'
      const categoryItem = body.items.find(i => i.category_id)
      if (!categoryItem) return 'El descuento por peso necesita una categoría'
      if (body.items.some(i => !i.category_id)) return 'El descuento por peso solo admite categorías'
    }
  }

  return null
}

export async function GET(request, { params }) {
  const payload = requireAdmin(request)
  if (payload instanceof NextResponse) return payload

  const { id } = await params

  const { data, error } = await supabaseAdmin
    .from('promotions')
    .select('*, items:promotion_items(*, products(id, name, images, price, stock), categories(id, name, slug))')
    .eq('id', id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Promoción no encontrada' }, { status: 404 })
  }

  return NextResponse.json(data)
}

export async function PATCH(request, { params }) {
  const payload = requireAdmin(request)
  if (payload instanceof NextResponse) return payload

  try {
    const { id } = await params
    const body = await request.json()
    const invalid = validatePromotion(body)
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })

    const { data: promo, error } = await supabaseAdmin
      .from('promotions')
      .update({
        title: body.title,
        description: body.description,
        type: body.type,
        image: body.image || null,
        price: body.type === 'combo' ? body.price : null,
        discount_type: body.type === 'promo' ? body.discount_type : null,
        discount_value: body.type === 'promo' ? body.discount_value : null,
        min_quantity: body.type === 'promo' ? body.min_quantity || 1 : 1,
        kind: body.type === 'promo' ? body.kind || 'quantity' : 'quantity',
        min_weight: body.type === 'promo' && (body.kind || 'quantity') === 'weight' ? Number(body.min_weight) : null,
        is_active: body.is_active ?? true,
        starts_at: body.starts_at || null,
        ends_at: body.ends_at || null,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await supabaseAdmin.from('promotion_items').delete().eq('promotion_id', id)

    const items = body.items.map(item => ({
      promotion_id: promo.id,
      product_id: item.product_id || null,
      category_id: item.category_id || null,
      quantity: item.quantity || 1,
    }))

    const { data: insertedItems, error: itemsError } = await supabaseAdmin
      .from('promotion_items')
      .insert(items)
      .select()

    if (itemsError) {
      return NextResponse.json({ error: itemsError.message }, { status: 500 })
    }

    return NextResponse.json({ ...promo, items: insertedItems })
  } catch (error) {
    return NextResponse.json({ error: 'Error al actualizar la promoción' }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  const payload = requireAdmin(request)
  if (payload instanceof NextResponse) return payload

  const { id } = await params

  const { error } = await supabaseAdmin
    .from('promotions')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
