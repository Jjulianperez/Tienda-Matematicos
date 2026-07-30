import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const { data: categories, error } = await supabaseAdmin
    .from('categories')
    .select('*, products(count)')
    .order('name')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(categories)
}

export async function POST(request) {
  const { requireAdmin } = await import('@/lib/auth')
  const payload = requireAdmin(request)
  if (payload instanceof NextResponse) return payload

  const body = await request.json()

  const { data, error } = await supabaseAdmin
    .from('categories')
    .insert({ name: body.name, slug: body.slug })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
