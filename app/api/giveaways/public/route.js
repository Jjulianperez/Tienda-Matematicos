import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { dbErrorResponse, PUBLIC_STATUSES } from '@/lib/giveaways/server'

// Lista pública de sorteos. Sin borradores ni cancelados, y sin datos de nadie:
// solo lo necesario para armar las tarjetas.
const LIST_COLUMNS = [
  'id', 'slug', 'title', 'description', 'prize_name', 'prize_image_url', 'format',
  'status', 'starts_at', 'ends_at', 'winners_count',
].join(', ')

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('giveaways')
    .select(LIST_COLUMNS)
    .in('status', PUBLIC_STATUSES)
    .order('starts_at', { ascending: false })
    .limit(100)

  if (error) return dbErrorResponse(error)

  return NextResponse.json(data || [])
}
