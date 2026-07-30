import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/auth'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('categoria')
  const sort = searchParams.get('sort')

  let query = supabaseAdmin
    .from('products')
    .select('*, categories(name, slug)')
    .order('whatsapp_clicks', { ascending: false })

  if (category) {
    query = query.eq('categories.slug', category)
  }

  const { data: products, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(products)
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
