// Sorteo determinista y verificable (commit-reveal).
//
// Algoritmo "mm-hmac-sha256-v1". Está pensado para que cualquiera pueda
// repetirlo con los datos públicos y obtener exactamente los mismos ganadores.
//
// 1. Antes de que se abran las inscripciones se genera una semilla de 32 bytes
//    y se publica su compromiso: seed_commitment = SHA-256(bytes de la semilla).
// 2. Al cerrar se congela la lista de tickets, ordenada por ticket_number, y se
//    publica su huella: tickets_hash = SHA-256 de las líneas "numero:participante\n".
// 3. Al sortear se revela la semilla. La secuencia de números aleatorios sale de
//    bloques HMAC-SHA256 con la semilla como clave y el mensaje
//    "<tickets_hash>|<contador>" (contador desde 0, en decimal). Cada bloque son
//    32 bytes = 8 palabras de 32 bits, leídas en orden, big-endian.
// 4. randomInt(n) elige un entero uniforme en [0, n) por rechazo: descarta las
//    palabras mayores o iguales a floor(2^32 / n) * n y devuelve palabra % n.
//    Si n == 1 devuelve 0 sin consumir ninguna palabra.
// 5. Selección: sobre la lista de tickets restante se elige un índice con
//    randomInt(restantes). El participante dueño de ese ticket queda elegido y
//    se quitan TODOS sus tickets de la lista. Se repite hasta completar
//    ganadores + suplentes o hasta que no queden tickets. Los primeros
//    `winnersCount` elegidos son ganadores (posición 1..N), el resto suplentes.
//
// Cada ticket pesa lo mismo: quien tiene dos oportunidades tiene dos tickets y,
// por lo tanto, el doble de probabilidad (decisión D2 del plan).

import { hexToBytes, sha256Hex, hmacSha256, randomHex } from './crypto-utils'

export const DRAW_ALGORITHM = 'mm-hmac-sha256-v1'

const SEED_BYTES = 32
const SEED_HEX_RE = /^[0-9a-f]{64}$/
const TWO_POW_32 = 2 ** 32
const blockMessageEncoder = new TextEncoder()

export function generateSeedHex() {
  return randomHex(SEED_BYTES)
}

export function isValidSeedHex(value) {
  return typeof value === 'string' && SEED_HEX_RE.test(value)
}

// Compromiso público de la semilla: SHA-256 de los bytes (no del texto hex).
export async function seedCommitment(seedHex) {
  if (!isValidSeedHex(seedHex)) throw new Error('Semilla inválida')
  return sha256Hex(hexToBytes(seedHex))
}

function sortedTickets(tickets) {
  const copy = [...tickets].sort((a, b) => a.ticket_number - b.ticket_number)
  for (let i = 1; i < copy.length; i++) {
    if (copy[i].ticket_number === copy[i - 1].ticket_number) {
      throw new Error(`Ticket repetido: ${copy[i].ticket_number}`)
    }
  }
  return copy
}

// Texto canónico de la lista congelada: una línea por ticket, ordenada.
export function canonicalTickets(tickets) {
  return sortedTickets(tickets)
    .map(t => `${t.ticket_number}:${t.participant_id}\n`)
    .join('')
}

export async function ticketsHash(tickets) {
  return sha256Hex(canonicalTickets(tickets))
}

// Flujo de palabras aleatorias de 32 bits derivado de la semilla y la huella.
function createStream(seedHex, ticketsHashHex) {
  const key = hexToBytes(seedHex)
  let counter = 0
  let block = null
  let offset = 32

  async function nextUint32() {
    if (offset >= 32) {
      block = await hmacSha256(key, blockMessageEncoder.encode(`${ticketsHashHex}|${counter}`))
      counter += 1
      offset = 0
    }
    const value =
      ((block[offset] << 24) | (block[offset + 1] << 16) | (block[offset + 2] << 8) | block[offset + 3]) >>> 0
    offset += 4
    return value
  }

  async function randomInt(n) {
    if (!Number.isInteger(n) || n < 1 || n > TWO_POW_32) {
      throw new Error('Rango inválido')
    }
    if (n === 1) return 0
    const limit = Math.floor(TWO_POW_32 / n) * n
    for (;;) {
      const word = await nextUint32()
      if (word < limit) return word % n
    }
  }

  return { randomInt }
}

/**
 * Calcula ganadores y suplentes.
 * @param {object} params
 * @param {string} params.seedHex semilla revelada (64 caracteres hex)
 * @param {{ticket_number: number, participant_id: string}[]} params.tickets lista congelada
 * @param {number} params.winnersCount
 * @param {number} params.alternatesCount
 */
export async function deriveDraw({ seedHex, tickets, winnersCount, alternatesCount }) {
  if (!isValidSeedHex(seedHex)) throw new Error('Semilla inválida')
  if (!Array.isArray(tickets) || tickets.length === 0) throw new Error('No hay tickets para sortear')
  if (!Number.isInteger(winnersCount) || winnersCount < 1) throw new Error('Cantidad de ganadores inválida')
  if (!Number.isInteger(alternatesCount) || alternatesCount < 0) throw new Error('Cantidad de suplentes inválida')

  const sorted = sortedTickets(tickets)
  const hash = await ticketsHash(sorted)
  const stream = createStream(seedHex, hash)

  const total = winnersCount + alternatesCount
  const picks = []
  let remaining = sorted

  while (picks.length < total && remaining.length > 0) {
    const chosen = remaining[await stream.randomInt(remaining.length)]
    picks.push(chosen)
    remaining = remaining.filter(t => t.participant_id !== chosen.participant_id)
  }

  const results = picks.map((ticket, i) => ({
    role: i < winnersCount ? 'winner' : 'alternate',
    position: i < winnersCount ? i + 1 : i - winnersCount + 1,
    participant_id: ticket.participant_id,
    ticket_number: ticket.ticket_number,
  }))

  return {
    algorithm: DRAW_ALGORITHM,
    tickets_hash: hash,
    tickets_count: sorted.length,
    results,
  }
}

// Compara resultados campo por campo. No se puede comparar el JSON como texto:
// PostgreSQL (jsonb) reordena las claves de cada objeto al guardarlos.
function sameResults(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
  return a.every(
    (x, i) =>
      x.role === b[i].role &&
      x.position === b[i].position &&
      x.participant_id === b[i].participant_id &&
      x.ticket_number === b[i].ticket_number
  )
}

/**
 * Verifica un sorteo ya hecho con los datos públicos.
 * Devuelve { ok, problems }: `problems` lista qué no coincide.
 */
export async function verifyDraw({
  seedHex,
  seedCommitmentHex,
  ticketsHashHex,
  tickets,
  winnersCount,
  alternatesCount,
  results,
}) {
  const problems = []

  if ((await seedCommitment(seedHex)) !== seedCommitmentHex) {
    problems.push('La semilla revelada no coincide con el compromiso publicado')
  }

  const hash = await ticketsHash(tickets)
  if (hash !== ticketsHashHex) {
    problems.push('La lista de tickets no coincide con la huella publicada')
  }

  const expected = await deriveDraw({ seedHex, tickets, winnersCount, alternatesCount })
  if (!sameResults(expected.results, results)) {
    problems.push('Los ganadores no coinciden con el resultado recalculado')
  }

  return { ok: problems.length === 0, problems }
}
