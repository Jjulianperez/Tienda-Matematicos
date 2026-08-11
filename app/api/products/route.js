import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/auth'
import { attachPromoInfo } from '@/lib/pricing'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('categoria')
  const sort = searchParams.get('sort') || 'populares'

  let query = supabaseAdmin
    .from('products')
    .select('*, categories(name, slug)')

  if (category) {
    const { data: cat } = await supabaseAdmin
      .from('categories')
      .select('id')
      .eq('slug', category)
      .single()

    if (cat) {
      query = query.eq('category_id', cat.id)
    }
  }

  if (sort === 'precio-asc') {
    query = query.order('price', { ascending: true })
  } else if (sort === 'precio-desc') {
    query = query.order('price', { ascending: false })
  } else if (sort === 'nuevos') {
    query = query.order('created_at', { ascending: false })
  } else {
    query = query.order('whatsapp_clicks', { ascending: false })
  }

  const { data: products, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const promos = await getActivePromos()
  const withPromos = (products || []).map(p => attachPromoInfo(p, promos))

  return NextResponse.json(withPromos)
}

async function getActivePromos() {
  const now = new Date().toISOString()
  const { data } = await supabaseAdmin
    .from('promotions')
    .select('*, items:promotion_items(*)')
    .eq('is_active', true)
    .eq('type', 'promo')
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gte.${now}`)
  return data || []
}

export async function POST(request) {
  const payload = requireAdmin(request)
  if (payload instanceof NextResponse) return payload

  try {
    const body = await request.json()

    const { data, error } = await supabaseAdmin
      .from('products')
      .insert({
        name: body.name,
        description: body.description,
        price: body.price,
        stock: body.stock,
        category_id: body.category_id,
        images: body.images || [],
        featured: body.featured || false,
        weight: body.weight ? Number(body.weight) : null,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Error al crear producto' }, { status: 500 })
  }
}
