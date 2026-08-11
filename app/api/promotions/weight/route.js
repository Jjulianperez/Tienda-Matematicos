import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const now = new Date().toISOString()
  const { data, error } = await supabaseAdmin
    .from('promotions')
    .select('*, items:promotion_items(category_id)')
    .eq('is_active', true)
    .eq('kind', 'weight')
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gte.${now}`)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const weightPromos = (data || [])
    .map(promo => {
      const categoryItem = (promo.items || []).find(i => i.category_id)
      if (!categoryItem) return null
      return {
        id: promo.id,
        title: promo.title,
        category_id: categoryItem.category_id,
        min_weight: Number(promo.min_weight) || 0,
        discount_type: promo.discount_type,
        discount_value: Number(promo.discount_value) || 0,
      }
    })
    .filter(Boolean)

  return NextResponse.json(weightPromos)
}
