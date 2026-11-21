import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  requireGiveawayAdmin,
  notFound,
  uuidParam,
  EVIDENCE_BUCKET,
} from '@/lib/giveaways/server'

// Segundos de vida de la URL firmada de una captura.
const SIGNED_URL_SECONDS = 60

// URL firmada de una captura. El bucket es privado: no existe una URL pública.
export async function GET(request, { params }) {
  const admin = await requireGiveawayAdmin(request)
  if (admin instanceof NextResponse) return admin

  const { id: rawId, evidenceId: rawEvidenceId } = await params
  const id = uuidParam(rawId)
  const evidenceId = uuidParam(rawEvidenceId)
  if (!id || !evidenceId) return notFound('No encontramos esa evidencia')

  const { data: evidence } = await supabaseAdmin
    .from('giveaway_evidence')
    .select('storage_path')
    .eq('id', evidenceId)
    .eq('giveaway_id', id)
    .maybeSingle()

  if (!evidence) return notFound('No encontramos esa evidencia')

  const { data, error } = await supabaseAdmin.storage
    .from(EVIDENCE_BUCKET)
    .createSignedUrl(evidence.storage_path, SIGNED_URL_SECONDS)

  if (error || !data?.signedUrl) {
    console.error('No se pudo firmar la captura:', error?.message)
    return NextResponse.json(
      { error: 'No se pudo abrir la captura. ¿Está creado el bucket de evidencias?' },
      { status: 500 }
    )
  }

  return NextResponse.json({ url: data.signedUrl, expires_in: SIGNED_URL_SECONDS })
}
