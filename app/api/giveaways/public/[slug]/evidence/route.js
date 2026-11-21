import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isUuid } from '@/lib/giveaways/validation'
import { sha256Hex } from '@/lib/giveaways/crypto-utils'
import {
  validateEvidenceFile,
  evidenceStoragePath,
  EVIDENCE_SIGNATURE_BYTES,
} from '@/lib/giveaways/evidence'
import {
  dbErrorResponse,
  badRequest,
  notFound,
  findPublicGiveaway,
  findParticipantByToken,
  readParticipationToken,
  withinRateLimit,
  tooManyRequests,
  EVIDENCE_BUCKET,
} from '@/lib/giveaways/server'

// Subida de una captura para un requisito de tipo "evidence_upload".
//
// El archivo se valida por su contenido (firma y tamaño, no por el
// Content-Type declarado), se calcula su SHA-256 (una misma captura no puede
// usarse dos veces en el sorteo) y se guarda en un bucket PRIVADO. Después se
// registra en la base; si el registro falla, se borra el archivo subido.
export async function POST(request, { params }) {
  if (!(await withinRateLimit(request, 'giveaway-evidence', 20, 600))) return tooManyRequests()

  const token = readParticipationToken(request)
  if (!token) return notFound('No encontramos tu participación')

  let formData
  try {
    formData = await request.formData()
  } catch {
    return badRequest('No se pudo leer el archivo')
  }

  const requirementId = formData.get('requirement_id')
  const file = formData.get('image')
  if (!isUuid(requirementId)) return badRequest('El requisito no es válido')
  if (!file || typeof file === 'string' || typeof file.arrayBuffer !== 'function') {
    return badRequest('No se envió ninguna captura')
  }

  const head = new Uint8Array(await file.slice(0, EVIDENCE_SIGNATURE_BYTES).arrayBuffer())
  const check = validateEvidenceFile({ size: file.size, head })
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status })

  const { slug } = await params
  const giveaway = await findPublicGiveaway(slug)
  if (!giveaway) return notFound('No encontramos ese sorteo')

  const participant = await findParticipantByToken(giveaway.id, token)
  if (!participant) return notFound('No encontramos tu participación')

  const bytes = new Uint8Array(await file.arrayBuffer())
  const sha256 = await sha256Hex(bytes)
  const storagePath = evidenceStoragePath({
    giveawayId: giveaway.id,
    participantId: participant.id,
    sha256,
    mime: check.mime,
  })

  const { error: uploadError } = await supabaseAdmin.storage
    .from(EVIDENCE_BUCKET)
    .upload(storagePath, bytes, { contentType: check.mime, upsert: false })

  // Si el archivo ya estaba (mismo hash, mismo participante), el registro de
  // la base decide si corresponde rechazarlo como duplicado.
  const alreadyThere = uploadError && /already exists|duplicate/i.test(uploadError.message || '')
  if (uploadError && !alreadyThere) {
    console.error('No se pudo subir la captura:', uploadError.message)
    return NextResponse.json(
      { error: 'No se pudo guardar la captura. Probá de nuevo en un momento' },
      { status: 500 }
    )
  }

  const { data, error } = await supabaseAdmin.rpc('giveaway_submit_evidence', {
    p_participant_id: participant.id,
    p_requirement_id: requirementId,
    p_storage_path: storagePath,
    p_mime: check.mime,
    p_size_bytes: file.size,
    p_sha256: sha256,
  })

  if (error) {
    // No dejar archivos huérfanos si la base rechazó el registro.
    if (!alreadyThere) {
      await supabaseAdmin.storage.from(EVIDENCE_BUCKET).remove([storagePath])
    }
    return dbErrorResponse(error)
  }

  return NextResponse.json(data, { status: 201 })
}
