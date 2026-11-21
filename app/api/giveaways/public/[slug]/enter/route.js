import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { validateEntryInput } from '@/lib/giveaways/validation'
import { deriveAccessToken, hashAccessToken } from '@/lib/giveaways/tokens'
import {
  dbErrorResponse,
  badRequest,
  notFound,
  readJson,
  findPublicGiveaway,
  withinRateLimit,
  tooManyRequests,
  accessTokenSecret,
} from '@/lib/giveaways/server'

// Inscripción. Devuelve el token del comprobante de participación, que es la
// única forma de volver a ver y completar la participación.
//
// El token sale de la clave de idempotencia que manda el navegador: si la
// petición se repite (corte de red, doble toque) se devuelve el MISMO token y
// no se crea otra persona. En la base solo se guarda su hash.
export async function POST(request, { params }) {
  if (!(await withinRateLimit(request, 'giveaway-enter', 10, 600))) return tooManyRequests()

  const body = await readJson(request)
  if (!body) return badRequest('Cuerpo de la petición inválido')

  const result = validateEntryInput(body)
  if (!result.ok) return badRequest('Revisá los datos del formulario', result.errors)
  const value = result.value

  const { slug } = await params
  const giveaway = await findPublicGiveaway(slug)
  if (!giveaway) return notFound('No encontramos ese sorteo')

  let token
  let tokenHash
  try {
    token = await deriveAccessToken(accessTokenSecret(), giveaway.id, value.idempotency_key)
    tokenHash = await hashAccessToken(token)
  } catch (error) {
    console.error('No se pudo generar el token de participación:', error.message)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }

  const { data, error } = await supabaseAdmin.rpc('giveaway_enter', {
    p_giveaway_id: giveaway.id,
    p_full_name: value.full_name,
    p_phone_normalized: value.phone_normalized,
    p_phone_display: value.phone_display,
    p_email: value.email,
    p_ig_handle: value.ig_handle,
    p_ig_handle_normalized: value.ig_handle_normalized,
    p_marketing_consent: value.marketing_consent,
    p_terms_version: value.terms_version,
    p_token_hash: tokenHash,
    p_idempotency_key: value.idempotency_key,
  })

  if (error) return dbErrorResponse(error)

  return NextResponse.json({ token, created: data.created }, { status: data.created ? 201 : 200 })
}
