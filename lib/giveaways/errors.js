// Traducción de los errores de la base a respuestas HTTP.
//
// Las funciones SQL de 006 y 007 fallan con códigos estables ("giveaway_not_active")
// o "codigo: explicación" (triggers). Acá se convierten en un estado HTTP y un
// mensaje para la persona. Lo que no se reconoce se responde como error del
// servidor sin mostrar el texto interno de Postgres.

const KNOWN = {
  // Sorteo y estados
  giveaway_not_found: [404, 'No encontramos ese sorteo'],
  giveaway_invalid_state: [409, 'El sorteo no está en un estado que permita esa acción'],
  giveaway_invalid_transition: [409, 'El sorteo no puede pasar a ese estado desde el actual'],
  giveaway_not_active: [409, 'El sorteo no está recibiendo participaciones en este momento'],
  giveaway_not_reviewable: [409, 'El sorteo ya no admite revisiones'],
  giveaway_phase_locked: [409, 'El sorteo está en una etapa que no permite este cambio'],
  giveaway_rules_locked: [409, 'Las reglas del sorteo no se pueden cambiar después de publicarlo'],
  giveaway_commitment_locked: [409, 'El compromiso de la semilla no se puede cambiar'],
  giveaway_counter_locked: [409, 'El contador de tickets no puede bajar'],
  giveaway_cannot_delete: [409, 'Un sorteo en marcha o terminado no se puede borrar'],

  // Publicación
  giveaway_missing_requirements: [422, 'Agregá al menos un requisito para la primera oportunidad'],
  giveaway_missing_terms: [422, 'Falta el texto de las bases y condiciones'],
  giveaway_missing_dates: [422, 'Faltan las fechas de inicio y cierre'],
  giveaway_ends_in_past: [422, 'La fecha de cierre tiene que ser futura'],
  giveaway_requirement_slot_invalid: [422, 'Hay requisitos de una oportunidad que el sorteo no admite'],
  giveaway_invalid_seed: [500, 'No se pudo generar la semilla del sorteo'],

  // Inscripción
  giveaway_terms_outdated: [409, 'Las bases cambiaron. Recargá la página y volvé a intentar'],
  giveaway_phone_taken: [409, 'Ese teléfono ya está inscripto en este sorteo'],
  giveaway_instagram_taken: [409, 'Ese usuario de Instagram ya está inscripto en este sorteo'],
  participant_not_found: [404, 'No encontramos tu participación'],

  // Requisitos, respuestas y evidencias
  requirement_not_found: [404, 'No encontramos ese requisito'],
  requirement_kind_mismatch: [400, 'Ese requisito no se responde de esa manera'],
  answer_invalid: [400, 'La respuesta no es válida'],
  evidence_duplicate: [409, 'Esa captura ya fue usada en este sorteo'],
  evidence_already_submitted: [409, 'Ya enviaste una captura para este requisito'],
  evidence_not_found: [404, 'No encontramos esa evidencia'],
  evidence_not_pending: [409, 'Esa evidencia ya fue revisada'],
  invalid_decision: [400, 'La decisión tiene que ser aprobar o rechazar'],
  reason_required: [400, 'Tenés que escribir un motivo'],

  // Congelamiento y ejecución
  giveaway_has_pending_evidence: [409, 'Todavía hay evidencias pendientes de revisión'],
  giveaway_no_tickets: [409, 'No hay participantes con oportunidades: no se puede sortear'],
  confirmation_mismatch: [400, 'La confirmación no coincide con el enlace del sorteo'],
  draw_seed_mismatch: [500, 'La semilla no coincide con el compromiso publicado. El sorteo no se ejecutó'],
  draw_tickets_changed: [500, 'La lista de tickets cambió después de congelarla. El sorteo no se ejecutó'],
  draw_invalid_result: [500, 'El resultado calculado no es coherente. El sorteo no se ejecutó'],
  draw_seed_missing: [500, 'Falta la semilla del sorteo'],

  // Límite de peticiones
  rate_limited: [429, 'Demasiados intentos. Esperá un momento y volvé a probar'],
}

// Violaciones de unicidad de Postgres (código 23505) que tienen mensaje propio.
const UNIQUE_BY_CONSTRAINT = [
  ['giveaways_slug_key', 'giveaway_slug_taken', 409, 'Ya existe un sorteo con ese enlace'],
  ['giveaway_requirements_giveaway_id_position_key', 'requirement_position_taken', 409, 'Ya hay un requisito en esa posición'],
]

export function extractErrorCode(message) {
  if (typeof message !== 'string') return null
  const match = message.match(/^([a-z][a-z0-9_]*)(?::|$)/)
  return match ? match[1] : null
}

/**
 * @param {{ message?: string, code?: string } | null | undefined} error
 * @returns {{ status: number, error: string, code: string }}
 */
export function mapDbError(error) {
  const message = error?.message || ''

  if (error?.code === '23505') {
    for (const [constraint, code, status, text] of UNIQUE_BY_CONSTRAINT) {
      if (message.includes(constraint)) return { status, error: text, code }
    }
  }

  const code = extractErrorCode(message)
  if (code && KNOWN[code]) {
    const [status, text] = KNOWN[code]
    return { status, error: text, code }
  }

  return { status: 500, error: 'Error del servidor', code: 'unknown' }
}
