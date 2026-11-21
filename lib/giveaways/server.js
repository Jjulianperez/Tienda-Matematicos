// Ayudas compartidas por las rutas de la API de sorteos (solo servidor).

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/auth'
import { mapDbError } from './errors'
import { sha256Hex } from './crypto-utils'
import { hashAccessToken, isValidAccessToken } from './tokens'
import { isUuid } from './validation'

// Bucket PRIVADO de Supabase Storage con las capturas. Se crea con
// scripts/setup-giveaway-storage.js.
export const EVIDENCE_BUCKET = 'giveaway-evidence'

// Estados que se muestran en la web pública. Borrador y cancelado no.
export const PUBLIC_STATUSES = ['scheduled', 'active', 'closing', 'ready', 'drawing', 'completed']

// Columnas del sorteo que puede ver cualquiera. La semilla secreta vive en otra
// tabla y no está acá; tampoco quién lo creó ni el motivo de cancelación.
export const PUBLIC_GIVEAWAY_COLUMNS = [
  'id', 'slug', 'title', 'description', 'prize_name', 'prize_description', 'prize_image_url',
  'format', 'status', 'starts_at', 'ends_at', 'winners_count', 'alternates_count',
  'max_opportunities', 'terms_text', 'terms_version', 'seed_commitment', 'tickets_hash',
  'tickets_count', 'frozen_at',
].join(', ')

/** Respuesta de error a partir de un error de la base (o de Supabase). */
export function dbErrorResponse(error) {
  const mapped = mapDbError(error)
  if (mapped.code === 'unknown') {
    console.error('Error inesperado en sorteos:', error?.message || error)
  }
  return NextResponse.json({ error: mapped.error, code: mapped.code }, { status: mapped.status })
}

export function badRequest(message, fields) {
  return NextResponse.json({ error: message, fields: fields || undefined }, { status: 400 })
}

export function notFound(message = 'No encontrado') {
  return NextResponse.json({ error: message }, { status: 404 })
}

/** Lee el cuerpo JSON o devuelve null si no es válido. */
export async function readJson(request) {
  try {
    return await request.json()
  } catch {
    return null
  }
}

/** Devuelve el id si es un UUID; si no, null (evita errores de sintaxis de Postgres). */
export function uuidParam(value) {
  return isUuid(value) ? value : null
}

/**
 * Exige un admin con sesión. Con `ownerOnly` además exige el rol propietario
 * (confirmar sorteos, congelar, ejecutar). El rol se lee de la base en cada
 * petición: el token no lo lleva, así que cambiarlo en la base surte efecto
 * enseguida.
 */
export async function requireGiveawayAdmin(request, { ownerOnly = false } = {}) {
  const payload = requireAdmin(request)
  if (payload instanceof NextResponse) return payload

  const { data: admin, error } = await supabaseAdmin
    .from('admins')
    .select('id, email, role')
    .eq('id', payload.id)
    .single()

  if (error || !admin) {
    const missingRole = error?.message?.includes('role')
    return NextResponse.json(
      {
        error: missingRole
          ? 'Falta aplicar la migración 006_giveaways.sql en Supabase.'
          : 'No autorizado',
      },
      { status: missingRole ? 500 : 401 }
    )
  }

  if (ownerOnly && admin.role !== 'owner') {
    return NextResponse.json({ error: 'Solo el propietario puede hacer esto' }, { status: 403 })
  }
  return admin
}

function clientIp(request) {
  const forwarded = request.headers.get('x-forwarded-for') || ''
  return forwarded.split(',')[0].trim() || request.headers.get('x-real-ip') || 'desconocida'
}

/**
 * Límite de peticiones por IP y acción, con contador compartido en la base.
 * Devuelve true si la petición puede seguir. La IP se guarda solo como hash.
 * Si el contador falla se deja pasar (disponibilidad antes que bloqueo) y se
 * deja constancia en el log.
 */
export async function withinRateLimit(request, action, limit, windowSeconds) {
  const bucket = `${action}:${await sha256Hex(`${action}|${clientIp(request)}`)}`
  const { data, error } = await supabaseAdmin.rpc('giveaway_rate_limit_hit', {
    p_bucket: bucket,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  })
  if (error) {
    console.error('No se pudo consultar el límite de peticiones:', error.message)
    return true
  }
  return data === true
}

export function tooManyRequests() {
  return NextResponse.json(
    { error: 'Demasiados intentos. Esperá un momento y volvé a probar', code: 'rate_limited' },
    { status: 429 }
  )
}

/** Secreto con el que se derivan los tokens de comprobante. */
export function accessTokenSecret() {
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET falta o tiene menos de 32 caracteres')
  }
  return secret
}

/** Token de la participación, enviado en el encabezado x-participation-token. */
export function readParticipationToken(request) {
  const token = request.headers.get('x-participation-token')
  return isValidAccessToken(token) ? token : null
}

/** Busca al participante de un sorteo a partir de su token. null si no existe. */
export async function findParticipantByToken(giveawayId, token) {
  const { data } = await supabaseAdmin
    .from('giveaway_participants')
    .select('id, giveaway_id, full_name, ig_handle, created_at')
    .eq('giveaway_id', giveawayId)
    .eq('access_token_hash', await hashAccessToken(token))
    .maybeSingle()
  return data || null
}

let lastAdvance = 0

/**
 * Aplica las transiciones por tiempo (programado → activo → cerrando) sin
 * esperar al cron: cada vez que alguien mira un sorteo, la base se pone al día.
 * El cron sigue haciendo falta para los sorteos que nadie mira y para las
 * notificaciones, pero la apertura y el cierre ya no dependen de él. Es
 * idempotente (la función de la base bloquea las filas) y se limita a una
 * llamada cada pocos segundos por instancia.
 */
export async function advanceGiveaways(minIntervalMs = 5000) {
  const now = Date.now()
  if (now - lastAdvance < minIntervalMs) return
  lastAdvance = now
  const { error } = await supabaseAdmin.rpc('giveaway_tick')
  if (error) console.error('No se pudo actualizar el estado de los sorteos:', error.message)
}

/** Sorteo público por enlace, solo con las columnas públicas. */
export async function findPublicGiveaway(slug) {
  await advanceGiveaways()
  const { data, error } = await supabaseAdmin
    .from('giveaways')
    .select(PUBLIC_GIVEAWAY_COLUMNS)
    .eq('slug', slug)
    .in('status', PUBLIC_STATUSES)
    .maybeSingle()
  // Un error de la base se responde como "no encontrado" (no se filtra el
  // detalle), pero queda en el log para no confundirlo con un sorteo inexistente.
  if (error) console.error('No se pudo leer el sorteo público:', error.message)
  return data || null
}

/**
 * Cifras que se muestran en vivo: personas que participan (con al menos una
 * oportunidad), oportunidades totales y, en el formato de números, qué tickets
 * ya se asignaron (como rangos). Son agregados: no llevan datos de nadie.
 *
 * Si todavía no se aplicó la migración 009 se responde con lo que se pueda
 * calcular sin ella (solo las oportunidades) y `degraded: true`, para que la
 * página no se rompa mientras tanto.
 */
export async function loadPublicStats(giveaway) {
  const withRanges = giveaway.format === 'numeros'
  const { data, error } = await supabaseAdmin.rpc('giveaway_public_stats', {
    p_giveaway_id: giveaway.id,
    p_with_ranges: withRanges,
  })

  if (!error && data) {
    return {
      participants: Number(data.participants) || 0,
      tickets: Number(data.tickets) || 0,
      ranges: Array.isArray(data.ranges) ? data.ranges : null,
      degraded: false,
    }
  }

  console.error('No se pudieron leer las cifras públicas (¿falta la migración 009?):', error?.message)
  const { count } = await supabaseAdmin
    .from('giveaway_entries')
    .select('id', { count: 'exact', head: true })
    .eq('giveaway_id', giveaway.id)
  return { participants: null, tickets: count || 0, ranges: null, degraded: true }
}

/** Nombre de pila para mostrar a un ganador sin exponer el nombre completo. */
export function firstName(fullName) {
  return String(fullName || '').trim().split(/\s+/)[0] || 'Participante'
}
