import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/auth'

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

  return NextResponse.json(product)
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
