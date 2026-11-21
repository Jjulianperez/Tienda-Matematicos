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

const TAU = Math.PI * 2

// Segmento (0-based) que está bajo la flecha con esa rotación (en radianes,
// sentido horario). Sirve para hacer sonar un clic cada vez que la flecha pasa
// de un segmento al siguiente.
export function segmentUnderPointer(rotationRad, segments) {
  const angle = (((-rotationRad) % TAU) + TAU) % TAU
  return Math.min(segments - 1, Math.floor((angle / TAU) * segments))
}

// Rotación final (en radianes) de la ruleta dibujada en un canvas: parte de
// `fromRad`, da `turns` vueltas completas y frena con la flecha sobre el
// segmento del ticket ganador. Es la misma cuenta que wheelTargetRotation pero
// siempre hacia adelante a partir de donde está la ruleta.
export function wheelSpinTarget(fromRad, ticketNumber, totalTickets, turns = 5) {
  const segments = wheelSegmentCount(totalTickets)
  const winning = segmentOfTicket(ticketNumber, totalTickets, segments)
  const targetRad = (wheelTargetRotation(winning, segments, ticketNumber, 0) * Math.PI) / 180
  const targetMod = ((targetRad % TAU) + TAU) % TAU
  const fromMod = ((fromRad % TAU) + TAU) % TAU
  const forward = (((targetMod - fromMod) % TAU) + TAU) % TAU
  return { final: fromRad + forward + turns * TAU, winning, segments }
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

// ---------------------------------------------------------------------------
// Escena en vivo (la que se ve mientras el sorteo está abierto)
// ---------------------------------------------------------------------------

// Cuenta regresiva legible: "2 d 04:12:09" o "04:12:09".
export function formatCountdown(ms) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const days = Math.floor(total / 86400)
  const hours = Math.floor((total % 86400) / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const pad = n => String(n).padStart(2, '0')
  const clock = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
  return days > 0 ? `${days} d ${clock}` : clock
}

// ¿Está asignado este ticket? `ranges` son rangos [desde, hasta] ordenados y
// sin superposición (así los entrega la API para el formato de números).
export function isTicketTaken(ticket, ranges) {
  let low = 0
  let high = ranges.length - 1
  while (low <= high) {
    const mid = (low + high) >> 1
    const [from, to] = ranges[mid]
    if (ticket < from) high = mid - 1
    else if (ticket > to) low = mid + 1
    else return true
  }
  return false
}

// Rangos de tickets asignados. Si la API no los mandó (migración sin aplicar),
// se asume que son los primeros `tickets` números, sin huecos.
export function ticketRanges(ranges, tickets) {
  if (Array.isArray(ranges)) return ranges
  return tickets > 0 ? [[1, tickets]] : []
}

// Número más alto asignado.
export function highestTicket(ranges) {
  return ranges.length ? ranges[ranges.length - 1][1] : 0
}

// Bloque (0-based) del tablero de números que contiene al ticket.
export function blockOfTicket(ticket, size = NUMBER_BLOCK_SIZE) {
  return Math.max(0, Math.floor((Math.max(ticket, 1) - 1) / size))
}

// Cuántos bloques hacen falta para mostrar hasta el ticket más alto (mínimo uno).
export function boardBlockCount(highest, size = NUMBER_BLOCK_SIZE) {
  return Math.max(1, Math.ceil(highest / size))
}

// Qué números de un bloque están asignados: un arreglo de `size` booleanos.
export function takenFlags(ranges, blockIndex, size = NUMBER_BLOCK_SIZE) {
  const start = blockIndex * size + 1
  return Array.from({ length: size }, (_, i) => isTicketTaken(start + i, ranges))
}

// Cuántos números de un bloque ya están asignados (para la barra de avance).
export function blockFill(ranges, blockIndex, size = NUMBER_BLOCK_SIZE) {
  const start = blockIndex * size + 1
  const end = start + size - 1
  let count = 0
  for (const [from, to] of ranges) {
    if (to < start) continue
    if (from > end) break
    count += Math.min(to, end) - Math.max(from, start) + 1
  }
  return count
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
