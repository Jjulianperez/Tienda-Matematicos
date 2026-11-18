// Cálculos de las animaciones del sorteo (ruleta, urna, números).
//
// IMPORTANTE: la animación solo PRESENTA un resultado que el servidor ya
// calculó y guardó. Nada de lo que pasa en pantalla decide quién ganó. Estas
// funciones solo traducen "ganó el ticket N de T" a ángulos, bloques y tiempos
// para que la animación termine exactamente en ese ticket.
//
// Con miles de tickets no se dibuja uno por uno: la ruleta usa pocos segmentos
// (cada uno representa un rango de tickets) y la vista de números muestra el
// bloque de 100 que contiene al ganador.

export const MAX_WHEEL_SEGMENTS = 36
export const NUMBER_BLOCK_SIZE = 100
const ROLL_TICKS = 28

function clampInt(value, min, max) {
  return Math.min(Math.max(Math.trunc(value), min), max)
}

// Cantidad de segmentos de la ruleta: uno por ticket si son pocos, o 36 como máximo.
export function wheelSegmentCount(totalTickets) {
  return clampInt(totalTickets, 1, MAX_WHEEL_SEGMENTS)
}

// Segmento (0-based) que contiene al ticket. Los tickets se reparten en rangos
// consecutivos y casi iguales; segmentRange devuelve el rango de cada uno.
export function segmentOfTicket(ticketNumber, totalTickets, segments) {
  const total = Math.max(Math.trunc(totalTickets), 1)
  const ticket = clampInt(ticketNumber, 1, total)
  return Math.floor((ticket * segments + total - 1) / total) - 1
}

export function segmentRange(index, totalTickets, segments) {
  const total = Math.max(Math.trunc(totalTickets), 1)
  const start = Math.floor((index * total) / segments) + 1
  const end = Math.floor(((index + 1) * total) / segments)
  return { start, end: Math.max(end, start) }
}

// Rotación final de la ruleta para que la flecha (arriba) quede sobre el
// segmento del ticket ganador, después de `turns` vueltas completas. Dentro del
// segmento la aguja cae en un punto distinto según el ticket, para que dos
// ganadores seguidos no frenen siempre en el centro.
export function wheelTargetRotation(segmentIndex, segments, ticketNumber, turns = 5) {
  const arc = 360 / segments
  const center = (segmentIndex + 0.5) * arc
  const jitter = (((ticketNumber * 7919) % 100) / 100 - 0.5) * 0.6 * arc
  return turns * 360 - (center + jitter)
}

// Ángulo (0-360, desde arriba, sentido horario) que queda bajo la flecha con esa rotación.
export function angleUnderPointer(rotation) {
  return (((-rotation) % 360) + 360) % 360
}

// Bloque de 100 números que contiene al ticket ganador, para la vista de números.
export function numberBlock(ticketNumber, totalTickets, size = NUMBER_BLOCK_SIZE) {
  const total = Math.max(Math.trunc(totalTickets), 1)
  const ticket = clampInt(ticketNumber, 1, total)
  const start = Math.floor((ticket - 1) / size) * size + 1
  const end = Math.min(start + size - 1, total)
  return { start, end, count: end - start + 1, offset: ticket - start }
}

// Cuánto dura cada revelación. Con pocos ganadores se le da tiempo a cada una;
// con muchos, cada una es más corta para que el sorteo no se haga eterno.
export function spinDurationMs(winnersCount) {
  return winnersCount <= 3 ? 6500 : 3500
}

// Pausas entre cambios de número en la vista de números: arrancan rápidas y
// frenan hacia el final. Suman `spinMs`.
export function rollDelays(spinMs) {
  const weights = Array.from({ length: ROLL_TICKS }, (_, i) => 1 + 9 * (i / (ROLL_TICKS - 1)) ** 2)
  const sum = weights.reduce((a, b) => a + b, 0)
  return weights.map(w => (w / sum) * spinMs)
}
