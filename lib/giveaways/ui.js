// Ayudas de interfaz compartidas por el panel admin y las páginas públicas de
// sorteos. Código de navegador (fetch, fechas locales).

export const STATUS_META = {
  draft: { label: 'Borrador', cls: 'badge-new' },
  scheduled: { label: 'Programado', cls: 'badge-premium' },
  active: { label: 'Activo', cls: 'badge-stock' },
  closing: { label: 'Cerrado, en revisión', cls: 'badge-artesanal' },
  ready: { label: 'Listo para sortear', cls: 'badge-premium' },
  drawing: { label: 'Sorteando', cls: 'badge-artesanal' },
  completed: { label: 'Finalizado', cls: 'badge-stock' },
  cancelled: { label: 'Cancelado', cls: 'badge-sinstock' },
}

export const KIND_LABELS = {
  declarative: 'Declaración',
  evidence_upload: 'Captura de pantalla',
  text_answer: 'Respuesta de texto',
  external_link: 'Enlace',
}

export const FORMAT_LABELS = {
  ruleta: 'Ruleta',
  urna: 'Urna',
  numeros: 'Números',
}

export const SLOT_LABELS = {
  1: 'Primera oportunidad',
  2: 'Segunda oportunidad',
}

// ISO -> valor de <input type="datetime-local"> en hora local.
export function toLocalInput(iso) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = n => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

// Valor de <input type="datetime-local"> -> ISO (o null si está vacío).
export function fromLocalInput(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

// Llamada a la API de administración con el token del admin.
export async function adminFetch(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('token')}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data }
}

// Primer mensaje de error legible de una respuesta de la API.
export function errorMessage(result, fallback = 'No se pudo completar la acción') {
  const fields = result?.data?.fields
  if (fields && typeof fields === 'object') {
    const first = Object.values(fields)[0]
    if (first) return String(first)
  }
  return result?.data?.error || fallback
}

// Qué campos ya no se pueden editar según el estado del sorteo (lo hace cumplir
// la base de datos; acá solo se deshabilitan los inputs).
export function lockedFields(status) {
  const published = status !== 'draft'
  const running = !['draft', 'scheduled'].includes(status)
  return {
    slug: published,
    winners_count: published,
    alternates_count: published,
    max_opportunities: published,
    terms_text: published,
    prize_name: running,
    starts_at: running,
    ends_at: running,
  }
}

// Qué falta para poder publicar un borrador.
export function publishChecklist(giveaway, requirements) {
  const items = [
    { label: 'Premio con nombre', ok: Boolean(giveaway.prize_name) },
    { label: 'Fechas de inicio y cierre', ok: Boolean(giveaway.starts_at && giveaway.ends_at) },
    {
      label: 'Cierre en el futuro',
      ok: Boolean(giveaway.ends_at && new Date(giveaway.ends_at) > new Date()),
    },
    { label: 'Bases y condiciones', ok: Boolean(giveaway.terms_text && giveaway.terms_text.trim()) },
    {
      label: 'Al menos un requisito para la primera oportunidad',
      ok: requirements.some(r => r.slot === 1),
    },
    {
      label: 'Requisitos solo de oportunidades que el sorteo admite',
      ok: !requirements.some(r => r.slot > giveaway.max_opportunities),
    },
  ]
  return { items, ready: items.every(i => i.ok) }
}
