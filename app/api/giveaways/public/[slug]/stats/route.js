import { NextResponse } from 'next/server'
import { findPublicGiveaway, loadPublicStats, notFound } from '@/lib/giveaways/server'

// Cifras en vivo de un sorteo, para que la página las actualice sin recargarse.
// Son las mismas para todo el mundo (solo agregados, sin datos de nadie), así
// que se pueden guardar unos segundos en la CDN y absorber muchas visitas.
export async function GET(request, { params }) {
  const { slug } = await params
  const giveaway = await findPublicGiveaway(slug)
  if (!giveaway) return notFound('No encontramos ese sorteo')

  const stats = await loadPublicStats(giveaway)

  return NextResponse.json(
    {
      status: giveaway.status,
      starts_at: giveaway.starts_at,
      ends_at: giveaway.ends_at,
      ...stats,
    },
    { headers: { 'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=10' } }
  )
}
