// Máquina de estados de un sorteo.
//
// Es la misma tabla que valida PostgreSQL (trigger sobre giveaways.status).
// Se repite acá solo para que la interfaz sepa qué botones mostrar; la
// garantía real está en la base. scripts/test-giveaway-db.js comprueba que
// las dos tablas coincidan.

export const GIVEAWAY_STATUSES = [
  'draft',
  'scheduled',
  'active',
  'closing',
  'ready',
  'drawing',
  'completed',
  'cancelled',
]

export const GIVEAWAY_TRANSITIONS = {
  draft: ['scheduled', 'cancelled'],
  scheduled: ['active', 'cancelled'],
  active: ['closing', 'cancelled'],
  closing: ['ready', 'active', 'cancelled'],
  ready: ['drawing', 'cancelled'],
  drawing: ['completed', 'ready'],
  completed: [],
  cancelled: [],
}

export function canTransition(from, to) {
  return (GIVEAWAY_TRANSITIONS[from] || []).includes(to)
}

export function isTerminalStatus(status) {
  return status === 'completed' || status === 'cancelled'
}

// Se pueden crear participaciones y subir evidencias.
export function acceptsParticipation(status) {
  return status === 'active'
}

// El admin puede aprobar o rechazar evidencias pendientes.
export function acceptsReviews(status) {
  return status === 'active' || status === 'closing'
}

// La lista de tickets ya no puede cambiar.
export function isFrozenStatus(status) {
  return status === 'ready' || status === 'drawing' || status === 'completed' || status === 'cancelled'
}
