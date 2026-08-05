import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/auth'
import { attachPromoInfo } from '@/lib/pricing'

export async function GET(request, { params }) {
  const { id } = await params

  const { data: product, error } = await supabaseAdmin
    .from('products')
    .select('*, categories(name, slug)')
    .eq('id', id)
    .single()

  if (error || !product) {
    return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
  }

  const now = new Date().toISOString()
  const { data: promos } = await supabaseAdmin
    .from('promotions')
    .select('*, items:promotion_items(*)')
    .eq('is_active', true)
    .eq('type', 'promo')
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gte.${now}`)

  return NextResponse.json(attachPromoInfo(product, promos || []))
}

export async function PATCH(request, { params }) {
  const payload = requireAdmin(request)
  if (payload instanceof NextResponse) return payload

  const { id } = await params
  const body = await request.json()

  const { data, error } = await supabaseAdmin
    .from('products')
    .update({
      ...body,
      updated_at: new Date().toISOString(),
    })
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
    .from('products')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
