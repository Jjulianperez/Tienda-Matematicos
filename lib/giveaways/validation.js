// Validación de lo que llega por la API. Funciones puras: devuelven
// { ok, errors, value } y nunca escriben nada.
//
// `errors` es un objeto campo -> mensaje, pensado para mostrarse junto al campo.

import { normalizeInstagramHandle } from './identity'
import { normalizePhone } from '../customers'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const IDEMPOTENCY_RE = /^[A-Za-z0-9_-]{16,64}$/

export const GIVEAWAY_FORMATS = ['ruleta', 'urna', 'numeros']
export const REQUIREMENT_KINDS = ['declarative', 'evidence_upload', 'text_answer', 'external_link']

export function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value)
}

// "Gran Sorteo de Verano!" -> "gran-sorteo-de-verano"
export function slugify(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '')
}

function text(value, { min = 0, max, required = false } = {}) {
  if (value === undefined || value === null || value === '') {
    return required ? { error: 'Este campo es obligatorio' } : { value: null }
  }
  if (typeof value !== 'string') return { error: 'Tiene que ser texto' }
  const trimmed = value.trim()
  if (!trimmed) return required ? { error: 'Este campo es obligatorio' } : { value: null }
  if (trimmed.length < min) return { error: `Tiene que tener al menos ${min} caracteres` }
  if (max && trimmed.length > max) return { error: `Tiene que tener como máximo ${max} caracteres` }
  return { value: trimmed }
}

function integer(value, { min, max, fallback }) {
  if (value === undefined || value === null || value === '') {
    return fallback === undefined ? { error: 'Este campo es obligatorio' } : { value: fallback }
  }
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(n)) return { error: 'Tiene que ser un número entero' }
  if (n < min || n > max) return { error: `Tiene que estar entre ${min} y ${max}` }
  return { value: n }
}

function isoDate(value) {
  if (value === undefined || value === null || value === '') return { value: null }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return { error: 'La fecha no es válida' }
  return { value: date.toISOString() }
}

function httpsUrl(value) {
  const t = text(value, { max: 500 })
  if (t.error || t.value === null) return t
  try {
    const url = new URL(t.value)
    if (url.protocol !== 'https:') return { error: 'La dirección tiene que empezar con https://' }
    return { value: url.toString() }
  } catch {
    return { error: 'La dirección no es válida' }
  }
}

// Ejecuta una lista de [campo, resultado] y arma { ok, errors, value }.
function collect(entries) {
  const errors = {}
  const value = {}
  for (const [field, result] of entries) {
    if (result.error) errors[field] = result.error
    else if (result.value !== undefined) value[field] = result.value
  }
  return { ok: Object.keys(errors).length === 0, errors, value }
}

/**
 * Datos de un sorteo (alta o edición).
 * Con `partial: true` solo se validan los campos que vienen en `input`.
 */
export function validateGiveawayInput(input, { partial = false } = {}) {
  const body = input && typeof input === 'object' ? input : {}
  const has = key => body[key] !== undefined
  const entries = []
  const want = key => !partial || has(key)

  if (want('title')) entries.push(['title', text(body.title, { min: 3, max: 120, required: true })])
  if (want('prize_name')) entries.push(['prize_name', text(body.prize_name, { min: 2, max: 120, required: true })])
  if (want('description')) entries.push(['description', text(body.description, { max: 2000 })])
  if (want('prize_description')) entries.push(['prize_description', text(body.prize_description, { max: 1000 })])
  if (want('prize_image_url')) entries.push(['prize_image_url', httpsUrl(body.prize_image_url)])
  if (want('terms_text')) entries.push(['terms_text', text(body.terms_text, { max: 10000 })])

  if (want('product_id')) {
    const raw = body.product_id
    entries.push(['product_id', raw === undefined || raw === null || raw === ''
      ? { value: null }
      : isUuid(raw) ? { value: raw } : { error: 'El producto no es válido' }])
  }

  if (want('format')) {
    const raw = body.format ?? 'ruleta'
    entries.push(['format', GIVEAWAY_FORMATS.includes(raw) ? { value: raw } : { error: 'El formato no es válido' }])
  }

  if (want('winners_count')) entries.push(['winners_count', integer(body.winners_count, { min: 1, max: 100, fallback: 1 })])
  if (want('alternates_count')) entries.push(['alternates_count', integer(body.alternates_count, { min: 0, max: 100, fallback: 0 })])
  if (want('max_opportunities')) entries.push(['max_opportunities', integer(body.max_opportunities, { min: 1, max: 2, fallback: 2 })])

  if (want('starts_at')) entries.push(['starts_at', isoDate(body.starts_at)])
  if (want('ends_at')) entries.push(['ends_at', isoDate(body.ends_at)])

  // El enlace: el que mandan o, si falta, uno derivado del título.
  if (want('slug')) {
    const raw = typeof body.slug === 'string' && body.slug.trim() ? body.slug.trim() : slugify(body.title)
    entries.push(['slug', SLUG_RE.test(raw) && raw.length <= 80
      ? { value: raw }
      : { error: 'El enlace solo puede tener minúsculas, números y guiones' }])
  }

  const result = collect(entries)

  if (result.ok && result.value.starts_at && result.value.ends_at && result.value.starts_at >= result.value.ends_at) {
    result.ok = false
    result.errors.ends_at = 'El cierre tiene que ser posterior al inicio'
  }

  return result
}

export function validateRequirementInput(input, { partial = false } = {}) {
  const body = input && typeof input === 'object' ? input : {}
  const want = key => !partial || body[key] !== undefined
  const entries = []

  if (want('title')) entries.push(['title', text(body.title, { min: 3, max: 120, required: true })])
  if (want('instructions')) entries.push(['instructions', text(body.instructions, { max: 500 })])
  if (want('slot')) entries.push(['slot', integer(body.slot, { min: 1, max: 2 })])
  if (want('kind')) {
    entries.push(['kind', REQUIREMENT_KINDS.includes(body.kind) ? { value: body.kind } : { error: 'El tipo no es válido' }])
  }
  if (want('position') && body.position !== undefined) {
    entries.push(['position', integer(body.position, { min: 1, max: 50 })])
  }

  return collect(entries)
}

/** Inscripción pública. */
export function validateEntryInput(input) {
  const body = input && typeof input === 'object' ? input : {}
  const entries = []

  entries.push(['full_name', text(body.full_name, { min: 2, max: 100, required: true })])

  // normalizePhone acepta cualquier cosa con dígitos; para participar se exige
  // un largo razonable (un número argentino normalizado tiene 11 o 12 dígitos).
  const phone = normalizePhone(body.phone)
  const phoneOk = phone.length >= 10 && phone.length <= 15
  entries.push(['phone_normalized', phoneOk ? { value: phone } : { error: 'Ingresá un teléfono válido, con código de área' }])
  entries.push(['phone_display', text(body.phone, { max: 40 })])

  const email = text(body.email, { max: 120 })
  entries.push(['email', email.error || email.value === null
    ? email
    : EMAIL_RE.test(email.value) ? { value: email.value.toLowerCase() } : { error: 'El email no es válido' }])

  const ig = normalizeInstagramHandle(body.ig_handle)
  entries.push(['ig_handle_normalized', ig ? { value: ig } : { error: 'Ingresá tu usuario de Instagram (por ejemplo @matematicos)' }])

  entries.push(['marketing_consent', { value: body.marketing_consent === true }])
  entries.push(['accept_terms', body.accept_terms === true ? { value: true } : { error: 'Tenés que aceptar las bases y condiciones' }])
  entries.push(['terms_version', integer(body.terms_version, { min: 1, max: 1000 })])
  entries.push(['idempotency_key', IDEMPOTENCY_RE.test(body.idempotency_key ?? '')
    ? { value: body.idempotency_key }
    : { error: 'Falta la clave de la petición' }])

  const result = collect(entries)
  if (result.ok) result.value.ig_handle = typeof body.ig_handle === 'string' ? body.ig_handle.trim().slice(0, 80) : null
  return result
}

/** Respuesta de un requisito sin archivo (declaración, texto o enlace). */
export function validateAnswerInput(input) {
  const body = input && typeof input === 'object' ? input : {}
  const entries = [
    ['requirement_id', isUuid(body.requirement_id) ? { value: body.requirement_id } : { error: 'El requisito no es válido' }],
  ]
  const payload = body.payload && typeof body.payload === 'object' && !Array.isArray(body.payload) ? body.payload : {}
  entries.push(['payload', { value: payload }])
  return collect(entries)
}

/** Decisión sobre una evidencia. */
export function validateReviewInput(input) {
  const body = input && typeof input === 'object' ? input : {}
  const entries = [
    ['decision', ['approved', 'rejected'].includes(body.decision) ? { value: body.decision } : { error: 'Elegí aprobar o rechazar' }],
    ['reason', text(body.reason, { max: 300 })],
  ]
  const result = collect(entries)
  if (result.ok && result.value.decision === 'rejected' && !result.value.reason) {
    result.ok = false
    result.errors.reason = 'Escribí el motivo del rechazo'
  }
  return result
}
