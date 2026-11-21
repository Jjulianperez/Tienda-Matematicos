// Test del dominio de sorteos: estados, identidad, tokens y sorteo determinista.
// Ejecutar: npm run test:giveaways
//
// El sorteo se prueba de tres maneras:
//   1. contra una implementación de referencia escrita aparte con node:crypto,
//   2. con una distribución estadística (chi-cuadrado) sobre miles de semillas,
//   3. con un vector de valores fijos, para detectar cambios accidentales.
// No toca la base ni la red.

const nodeCrypto = require('node:crypto')
const { loadLibModule } = require('./_load-lib')

const draw = loadLibModule('giveaways/draw.js', [
  'DRAW_ALGORITHM',
  'generateSeedHex',
  'isValidSeedHex',
  'seedCommitment',
  'ticketsHash',
  'canonicalTickets',
  'deriveDraw',
  'verifyDraw',
])
const states = loadLibModule('giveaways/states.js', [
  'GIVEAWAY_STATUSES',
  'GIVEAWAY_TRANSITIONS',
  'canTransition',
  'isTerminalStatus',
  'acceptsParticipation',
  'acceptsReviews',
  'isFrozenStatus',
])
const { normalizeInstagramHandle } = loadLibModule('giveaways/identity.js', ['normalizeInstagramHandle'])
const tokens = loadLibModule('giveaways/tokens.js', [
  'generateAccessToken',
  'isValidAccessToken',
  'hashAccessToken',
])

let failures = 0

function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) failures++
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}${ok ? '' : ` -> esperado ${JSON.stringify(expected)}, obtenido ${JSON.stringify(actual)}`}`)
}

async function rejects(fn) {
  try {
    await fn()
    return false
  } catch {
    return true
  }
}

// ---------------------------------------------------------------------------
// Implementación de referencia: sigue la especificación del encabezado de
// lib/giveaways/draw.js, escrita aparte y sincrónica con node:crypto.
// ---------------------------------------------------------------------------
function referenceDraw(seedHex, tickets, winnersCount, alternatesCount) {
  const sorted = [...tickets].sort((a, b) => a.ticket_number - b.ticket_number)
  const canonical = sorted.map(t => `${t.ticket_number}:${t.participant_id}\n`).join('')
  const hash = nodeCrypto.createHash('sha256').update(canonical, 'utf8').digest('hex')

  const key = Buffer.from(seedHex, 'hex')
  let counter = 0
  let block = null
  let offset = 32
  const word = () => {
    if (offset >= 32) {
      block = nodeCrypto.createHmac('sha256', key).update(`${hash}|${counter}`, 'utf8').digest()
      counter += 1
      offset = 0
    }
    const value = block.readUInt32BE(offset)
    offset += 4
    return value
  }
  const randomInt = n => {
    if (n === 1) return 0
    const limit = Math.floor(2 ** 32 / n) * n
    for (;;) {
      const w = word()
      if (w < limit) return w % n
    }
  }

  const picks = []
  let remaining = sorted
  while (picks.length < winnersCount + alternatesCount && remaining.length) {
    const chosen = remaining[randomInt(remaining.length)]
    picks.push(chosen)
    remaining = remaining.filter(t => t.participant_id !== chosen.participant_id)
  }
  return {
    hash,
    results: picks.map((t, i) => ({
      role: i < winnersCount ? 'winner' : 'alternate',
      position: i < winnersCount ? i + 1 : i - winnersCount + 1,
      participant_id: t.participant_id,
      ticket_number: t.ticket_number,
    })),
  }
}

// Una semilla distinta y reproducible por índice.
function seedFor(i) {
  return nodeCrypto.createHash('sha256').update(`semilla-de-prueba-${i}`).digest('hex')
}

// Lista de tickets: cada participante recibe `perParticipant[i]` tickets.
function buildTickets(perParticipant) {
  const tickets = []
  let n = 0
  perParticipant.forEach((count, p) => {
    for (let k = 0; k < count; k++) {
      n += 1
      tickets.push({ ticket_number: n, participant_id: `p${p + 1}` })
    }
  })
  return tickets
}

// Chi-cuadrado de las frecuencias observadas contra las esperadas.
function chiSquare(observed, expected) {
  return observed.reduce((sum, o, i) => sum + (o - expected[i]) ** 2 / expected[i], 0)
}

async function main() {
  // -------------------------------------------------------------------------
  // Estados
  // -------------------------------------------------------------------------
  check('draft puede pasar a scheduled', states.canTransition('draft', 'scheduled'), true)
  check('draft no puede pasar a active', states.canTransition('draft', 'active'), false)
  check('closing puede volver a active (extensión)', states.canTransition('closing', 'active'), true)
  check('drawing puede volver a ready (error recuperable)', states.canTransition('drawing', 'ready'), true)
  check('completed no tiene salidas', states.GIVEAWAY_TRANSITIONS.completed, [])
  check('cancelled no tiene salidas', states.GIVEAWAY_TRANSITIONS.cancelled, [])
  check('no se cancela una vez en drawing', states.canTransition('drawing', 'cancelled'), false)
  check('solo active acepta participaciones', states.GIVEAWAY_STATUSES.filter(states.acceptsParticipation), ['active'])
  check('active y closing aceptan revisiones', states.GIVEAWAY_STATUSES.filter(states.acceptsReviews), ['active', 'closing'])
  check(
    'ready, drawing, completed y cancelled están congelados',
    states.GIVEAWAY_STATUSES.filter(states.isFrozenStatus),
    ['ready', 'drawing', 'completed', 'cancelled']
  )
  check(
    'todo estado destino de una transición es un estado conocido',
    Object.values(states.GIVEAWAY_TRANSITIONS).flat().every(s => states.GIVEAWAY_STATUSES.includes(s)),
    true
  )

  // -------------------------------------------------------------------------
  // Usuario de Instagram
  // -------------------------------------------------------------------------
  check('quita la arroba y pasa a minúsculas', normalizeInstagramHandle('@MateMaticos_Ok'), 'matematicos_ok')
  check('acepta el usuario sin arroba', normalizeInstagramHandle('  usuario.uno '), 'usuario.uno')
  check('acepta la URL del perfil', normalizeInstagramHandle('https://www.instagram.com/Mi_Perfil/?hl=es'), 'mi_perfil')
  check('acepta la URL sin protocolo', normalizeInstagramHandle('instagram.com/mi_perfil'), 'mi_perfil')
  check('rechaza la URL de una publicación', normalizeInstagramHandle('https://instagram.com/p/AbC123/'), null)
  check('rechaza caracteres inválidos', normalizeInstagramHandle('usuario con espacios'), null)
  check('rechaza más de 30 caracteres', normalizeInstagramHandle('a'.repeat(31)), null)
  check('rechaza puntos consecutivos', normalizeInstagramHandle('a..b'), null)
  check('rechaza punto al final', normalizeInstagramHandle('usuario.'), null)
  check('rechaza vacío y no-texto', [normalizeInstagramHandle(''), normalizeInstagramHandle(null), normalizeInstagramHandle(42)], [null, null, null])

  // -------------------------------------------------------------------------
  // Tokens
  // -------------------------------------------------------------------------
  const token = tokens.generateAccessToken()
  check('el token tiene 64 caracteres hex', tokens.isValidAccessToken(token), true)
  check('dos tokens nunca coinciden', tokens.generateAccessToken() === tokens.generateAccessToken(), false)
  check(
    'el hash del token es SHA-256',
    await tokens.hashAccessToken(token),
    nodeCrypto.createHash('sha256').update(token).digest('hex')
  )
  check('hashear un token inválido falla', await rejects(() => tokens.hashAccessToken('corto')), true)

  // -------------------------------------------------------------------------
  // Semilla y huella
  // -------------------------------------------------------------------------
  const seedA = 'aa'.repeat(32)
  check('generateSeedHex da 64 hex válidos', draw.isValidSeedHex(draw.generateSeedHex()), true)
  check('rechaza semilla de largo incorrecto', draw.isValidSeedHex('abc'), false)
  check(
    'el compromiso es SHA-256 de los bytes de la semilla',
    await draw.seedCommitment(seedA),
    nodeCrypto.createHash('sha256').update(Buffer.from(seedA, 'hex')).digest('hex')
  )
  check('la huella no depende del orden de entrada', await draw.ticketsHash(buildTickets([1, 2, 1]).reverse()), await draw.ticketsHash(buildTickets([1, 2, 1])))
  check(
    'la huella cambia si cambia un ticket',
    (await draw.ticketsHash(buildTickets([1, 2, 1]))) === (await draw.ticketsHash(buildTickets([1, 2, 2]))),
    false
  )
  check('rechaza tickets con número repetido', await rejects(() => draw.ticketsHash([
    { ticket_number: 1, participant_id: 'a' },
    { ticket_number: 1, participant_id: 'b' },
  ])), true)

  // -------------------------------------------------------------------------
  // Sorteo contra la implementación de referencia
  // -------------------------------------------------------------------------
  const configs = [
    { per: [1], w: 1, a: 0 },
    { per: [1, 1, 1], w: 1, a: 2 },
    { per: [2, 1, 2, 1, 1], w: 2, a: 1 },
    { per: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1], w: 3, a: 3 },
    { per: Array.from({ length: 40 }, (_, i) => (i % 3 === 0 ? 2 : 1)), w: 5, a: 5 },
  ]
  let mismatches = 0
  for (const { per, w, a } of configs) {
    const tickets = buildTickets(per)
    for (let i = 0; i < 60; i++) {
      const seedHex = seedFor(`${per.length}-${i}`)
      const real = await draw.deriveDraw({ seedHex, tickets, winnersCount: w, alternatesCount: a })
      const ref = referenceDraw(seedHex, tickets, w, a)
      if (JSON.stringify(real.results) !== JSON.stringify(ref.results) || real.tickets_hash !== ref.hash) {
        mismatches++
      }
    }
  }
  check('coincide con la implementación de referencia en 300 sorteos', mismatches, 0)

  // -------------------------------------------------------------------------
  // Propiedades del resultado
  // -------------------------------------------------------------------------
  {
    const tickets = buildTickets([2, 2, 1, 1])
    const result = await draw.deriveDraw({ seedHex: seedA, tickets, winnersCount: 2, alternatesCount: 1 })
    const ids = result.results.map(r => r.participant_id)
    check('un participante no puede ganar dos veces', new Set(ids).size, ids.length)
    check('hay ganadores y suplentes en orden', result.results.map(r => `${r.role}${r.position}`), ['winner1', 'winner2', 'alternate1'])
    check(
      'el ticket elegido le pertenece al participante',
      result.results.every(r => tickets.some(t => t.ticket_number === r.ticket_number && t.participant_id === r.participant_id)),
      true
    )

    const again = await draw.deriveDraw({ seedHex: seedA, tickets: [...tickets].reverse(), winnersCount: 2, alternatesCount: 1 })
    check('mismo resultado sin importar el orden de entrada', again.results, result.results)

    const other = await draw.deriveDraw({ seedHex: seedFor('otra'), tickets, winnersCount: 2, alternatesCount: 1 })
    check('otra semilla puede dar otro resultado', JSON.stringify(other.results) === JSON.stringify(result.results), false)
  }
  {
    const result = await draw.deriveDraw({ seedHex: seedA, tickets: buildTickets([1, 1]), winnersCount: 3, alternatesCount: 2 })
    check('con menos participantes que lugares, devuelve solo los posibles', result.results.length, 2)
  }
  check('sin tickets no se puede sortear', await rejects(() => draw.deriveDraw({ seedHex: seedA, tickets: [], winnersCount: 1, alternatesCount: 0 })), true)
  check('cantidad de ganadores inválida falla', await rejects(() => draw.deriveDraw({ seedHex: seedA, tickets: buildTickets([1]), winnersCount: 0, alternatesCount: 0 })), true)
  check('semilla inválida falla', await rejects(() => draw.deriveDraw({ seedHex: 'xyz', tickets: buildTickets([1]), winnersCount: 1, alternatesCount: 0 })), true)

  // -------------------------------------------------------------------------
  // Distribución: sin sesgo y con peso proporcional a los tickets
  // -------------------------------------------------------------------------
  {
    // 7 tickets de 7 participantes: n = 7 no divide a 2^32, así que el muestreo
    // por rechazo es lo que evita el sesgo del resto.
    const tickets = buildTickets([1, 1, 1, 1, 1, 1, 1])
    const draws = 14000
    const counts = new Array(7).fill(0)
    for (let i = 0; i < draws; i++) {
      const r = await draw.deriveDraw({ seedHex: seedFor(`u-${i}`), tickets, winnersCount: 1, alternatesCount: 0 })
      counts[Number(r.results[0].participant_id.slice(1)) - 1] += 1
    }
    const stat = chiSquare(counts, new Array(7).fill(draws / 7))
    // Valor crítico de chi-cuadrado, 6 grados de libertad, p = 0,001.
    check(`distribución uniforme (chi² = ${stat.toFixed(2)} < 22,46)`, stat < 22.46, true)
  }
  {
    // p1 tiene 2 tickets; p2 y p3, uno cada uno: 50 % / 25 % / 25 %.
    const tickets = buildTickets([2, 1, 1])
    const draws = 8000
    const counts = [0, 0, 0]
    for (let i = 0; i < draws; i++) {
      const r = await draw.deriveDraw({ seedHex: seedFor(`w-${i}`), tickets, winnersCount: 1, alternatesCount: 0 })
      counts[Number(r.results[0].participant_id.slice(1)) - 1] += 1
    }
    const stat = chiSquare(counts, [draws * 0.5, draws * 0.25, draws * 0.25])
    // 2 grados de libertad, p = 0,001.
    check(`dos tickets pesan el doble (chi² = ${stat.toFixed(2)} < 13,82)`, stat < 13.82, true)
  }

  // -------------------------------------------------------------------------
  // Verificación pública
  // -------------------------------------------------------------------------
  {
    const tickets = buildTickets([2, 1, 1, 2, 1])
    const commitment = await draw.seedCommitment(seedA)
    const result = await draw.deriveDraw({ seedHex: seedA, tickets, winnersCount: 2, alternatesCount: 1 })
    const base = {
      seedHex: seedA,
      seedCommitmentHex: commitment,
      ticketsHashHex: result.tickets_hash,
      tickets,
      winnersCount: 2,
      alternatesCount: 1,
      results: result.results,
    }

    check('un sorteo honesto verifica', (await draw.verifyDraw(base)).ok, true)

    // jsonb de PostgreSQL devuelve las claves en otro orden; no debe importar.
    const reordered = result.results.map(r => ({
      ticket_number: r.ticket_number,
      participant_id: r.participant_id,
      position: r.position,
      role: r.role,
    }))
    check('verifica aunque las claves del JSON vengan en otro orden', (await draw.verifyDraw({ ...base, results: reordered })).ok, true)
    check(
      'detecta una semilla distinta a la comprometida',
      (await draw.verifyDraw({ ...base, seedHex: seedFor('x') })).ok,
      false
    )
    check(
      'detecta un ticket agregado después del congelamiento',
      (await draw.verifyDraw({ ...base, tickets: [...tickets, { ticket_number: 99, participant_id: 'p9' }] })).ok,
      false
    )
    const swapped = [...result.results]
    ;[swapped[0], swapped[1]] = [swapped[1], swapped[0]]
    check('detecta ganadores intercambiados', (await draw.verifyDraw({ ...base, results: swapped })).ok, false)
  }

  // -------------------------------------------------------------------------
  // Vector fijo: si cambia algo del algoritmo, este caso falla.
  // -------------------------------------------------------------------------
  {
    const tickets = [
      { ticket_number: 1, participant_id: 'ana' },
      { ticket_number: 2, participant_id: 'beto' },
      { ticket_number: 3, participant_id: 'ana' },
      { ticket_number: 4, participant_id: 'carla' },
      { ticket_number: 5, participant_id: 'dani' },
      { ticket_number: 6, participant_id: 'elena' },
    ]
    const result = await draw.deriveDraw({
      seedHex: '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f',
      tickets,
      winnersCount: 2,
      alternatesCount: 1,
    })
    const reference = referenceDraw(
      '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f',
      tickets,
      2,
      1
    )
    check('vector fijo coincide con la referencia', [reference.hash, reference.results], [GOLDEN.ticketsHash, GOLDEN.results])
    check('algoritmo declarado', result.algorithm, 'mm-hmac-sha256-v1')
    check('vector fijo: huella de tickets', result.tickets_hash, GOLDEN.ticketsHash)
    check('vector fijo: resultado', result.results, GOLDEN.results)
  }

  if (failures > 0) {
    console.log(`\n${failures} caso(s) fallaron`)
    process.exitCode = 1
  } else {
    console.log('\nTodos los casos pasaron')
  }
}

// Valores esperados del vector fijo. Se comprueban también contra la
// implementación de referencia (ver el caso "vector fijo" en main).
const GOLDEN = {
  ticketsHash: '1154f45bbcd0636c1bb8a6b202b7d0af26f2b022aa799eb959cb1515b6f0bf7c',
  results: [
    { role: 'winner', position: 1, participant_id: 'ana', ticket_number: 1 },
    { role: 'winner', position: 2, participant_id: 'carla', ticket_number: 4 },
    { role: 'alternate', position: 1, participant_id: 'elena', ticket_number: 6 },
  ],
}

main()
