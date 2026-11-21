import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { dbErrorResponse, advanceGiveaways, PUBLIC_STATUSES } from '@/lib/giveaways/server'

// Lista pública de sorteos. Sin borradores ni cancelados, y sin datos de nadie:
// solo lo necesario para armar las tarjetas.
const LIST_COLUMNS = [
  'id', 'slug', 'title', 'description', 'prize_name', 'prize_image_url', 'format',
  'status', 'starts_at', 'ends_at', 'winners_count',
].join(', ')

export async function GET() {
  await advanceGiveaways()
  const { data, error } = await supabaseAdmin
    .from('giveaways')
    .select(LIST_COLUMNS)
    .in('status', PUBLIC_STATUSES)
    .order('starts_at', { ascending: false })
    .limit(100)

  if (error) return dbErrorResponse(error)

  // Cantidad de personas por sorteo. Si falta la migración 009 las tarjetas
  // simplemente no muestran el número.
  const { data: counts } = await supabaseAdmin.rpc('giveaway_public_counts')
  const withCounts = (data || []).map(giveaway => ({
    ...giveaway,
    participants_count: counts?.[giveaway.id]?.participants ?? null,
    tickets_count: counts?.[giveaway.id]?.tickets ?? null,
  }))

  return NextResponse.json(withCounts)
}
