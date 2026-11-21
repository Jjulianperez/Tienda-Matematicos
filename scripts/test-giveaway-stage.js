// Test de las escenas del sorteo: esferas, colores, confeti, sonido y cuentas
// de la escena en vivo.
// Ejecutar: npm run test:giveaway-stage
//
// Son módulos de navegador, pero la parte de cálculo es pura. Lo que usa la
// Web Audio API se prueba con un contexto de audio falso que cuenta las notas.

const { loadLibModule } = require('./_load-lib')

const physics = loadLibModule('giveaways/physics.js', [
  'WORLD_RADIUS',
  'MAX_BALLS',
  'createRng',
  'ballRadiusFor',
  'visibleBallCount',
  'createWorld',
  'addBall',
  'removeBall',
  'spawnPoint',
  'scatterBottom',
  'stepWorld',
  'settleWorld',
])
const palette = loadLibModule('giveaways/palette.js', ['SPHERE_COLORS', 'MINE_COLOR', 'mixHex', 'lighten', 'darken', 'segmentColor'])
const confetti = loadLibModule('giveaways/confetti.js', ['CONFETTI_COLORS', 'makeParticles', 'stepParticles'])
const stage = loadLibModule('giveaways/stage.js', [
  'formatCountdown',
  'isTicketTaken',
  'ticketRanges',
  'highestTicket',
  'blockOfTicket',
  'boardBlockCount',
  'takenFlags',
  'blockFill',
  'wheelSegmentCount',
  'segmentOfTicket',
  'segmentUnderPointer',
  'wheelSpinTarget',
])

let failures = 0

function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) failures++
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}${ok ? '' : ` -> esperado ${JSON.stringify(expected)}, obtenido ${JSON.stringify(actual)}`}`)
}

// ---------------------------------------------------------------------------
// Esferas
// ---------------------------------------------------------------------------

function fill(count, seed = 11) {
  const world = physics.createWorld({ seed })
  const r = physics.ballRadiusFor(count)
  const balls = Array.from({ length: count }, () => physics.addBall(world, { r }))
  physics.scatterBottom(world, balls)
  return { world, r, balls }
}

function worstOverlap(world) {
  // Cuánto se hunden dos esferas, como fracción de la suma de sus radios.
  let worst = 0
  for (let i = 0; i < world.balls.length; i++) {
    for (let j = i + 1; j < world.balls.length; j++) {
      const a = world.balls[i]
      const b = world.balls[j]
      const gap = a.r + b.r - Math.hypot(a.x - b.x, a.y - b.y)
      worst = Math.max(worst, gap / (a.r + b.r))
    }
  }
  return worst
}

function allInside(world, tolerance = 0.01) {
  return world.balls.every(b => Math.hypot(b.x, b.y) + b.r <= world.radius + tolerance)
}

const radii = [1, 5, 20, 60, 120, 150].map(n => physics.ballRadiusFor(n))
check('el radio de las esferas baja al haber más', radii.every((r, i) => i === 0 || r <= radii[i - 1]), true)
check('el radio queda entre 5.2 y 16', radii.every(r => r >= 5.2 && r <= 16), true)
check('con 150 esferas todas caben en la urna', 150 * Math.PI * physics.ballRadiusFor(150) ** 2 < Math.PI * 100 ** 2 * 0.7, true)
check('se dibujan como mucho 150 esferas', [physics.visibleBallCount(0), physics.visibleBallCount(40), physics.visibleBallCount(9999), physics.visibleBallCount(-3)], [0, 40, 150, 0])

{
  const { world } = fill(120)
  physics.settleWorld(world, 4)
  check('120 esferas asentadas quedan dentro de la urna', allInside(world), true)
  check('sin chorro las esferas descansan abajo', world.balls.filter(b => b.y > 0).length / world.balls.length > 0.9, true)
  check('las esferas asentadas casi no se superponen', worstOverlap(world) < 0.3, true)
  check('ninguna posición es NaN', world.balls.every(b => Number.isFinite(b.x) && Number.isFinite(b.y)), true)
  check('el chorro de aire se restablece después de asentar', world.jet, 1)
}

{
  const a = fill(60, 5)
  const b = fill(60, 5)
  for (const { world } of [a, b]) {
    for (let i = 0; i < 300; i++) physics.stepWorld(world, 1 / 60)
  }
  check('con la misma semilla la simulación es idéntica', JSON.stringify(a.world.balls.map(x => [x.x, x.y])), JSON.stringify(b.world.balls.map(x => [x.x, x.y])))
}

{
  const { world } = fill(100, 3)
  physics.settleWorld(world, 3)
  let moved = 0
  const before = world.balls.map(b => [b.x, b.y])
  const topAtRest = Math.min(...world.balls.map(b => b.y))
  let highest = topAtRest
  // 20 segundos de chorro de aire a 60 cuadros por segundo.
  for (let i = 0; i < 1200; i++) {
    physics.stepWorld(world, 1 / 60)
    for (const b of world.balls) highest = Math.min(highest, b.y)
  }
  world.balls.forEach((b, i) => { moved += Math.hypot(b.x - before[i][0], b.y - before[i][1]) })
  check('con el chorro las esferas se mezclan (se mueven)', moved / world.balls.length > 20, true)
  check('mezclando, todas siguen dentro de la urna', allInside(world), true)
  check('mezclando, ninguna posición es NaN', world.balls.every(b => Number.isFinite(b.x) && Number.isFinite(b.y)), true)
  check('el chorro levanta esferas bien por encima de la pila', highest < topAtRest - 25, true)
}

{
  // Una esfera nueva aparece arriba y cae.
  const { world, r } = fill(30, 9)
  physics.settleWorld(world, 3)
  world.jet = 0
  const point = physics.spawnPoint(world, r)
  const ball = physics.addBall(world, { r, x: point.x, y: point.y, vy: 40 })
  check('la esfera nueva aparece arriba', ball.y < -70, true)
  for (let i = 0; i < 180; i++) physics.stepWorld(world, 1 / 60)
  check('la esfera nueva cae (baja más de 50 unidades hasta posarse sobre la pila)', ball.y > -35, true)
  check('la esfera nueva queda dentro de la urna', allInside(world), true)
  const count = world.balls.length
  physics.removeBall(world, ball.id)
  check('se puede quitar una esfera', [world.balls.length, world.balls.some(b => b.id === ball.id)], [count - 1, false])
}

{
  // Si la pestaña estuvo dormida, no se simula todo el tiempo perdido de golpe.
  const { world } = fill(20, 2)
  const t0 = world.time
  physics.stepWorld(world, 60)
  check('un salto de tiempo grande se descarta', world.time - t0 < 0.1, true)
}

{
  // Rendimiento: 150 esferas, dos segundos de simulación.
  const { world } = fill(150, 4)
  const start = process.hrtime.bigint()
  for (let i = 0; i < 120; i++) physics.stepWorld(world, 1 / 60)
  const ms = Number(process.hrtime.bigint() - start) / 1e6
  check(`150 esferas, 2 s simulados en ${ms.toFixed(0)} ms (menos de 1500)`, ms < 1500, true)
}

// ---------------------------------------------------------------------------
// Colores
// ---------------------------------------------------------------------------

check('mezclar a la mitad negro y blanco da gris', palette.mixHex('#000000', '#ffffff', 0.5), '#808080')
check('t = 0 y t = 1 devuelven los extremos', [palette.mixHex('#94a86a', '#ffffff', 0), palette.mixHex('#94a86a', '#ffffff', 1)], ['#94a86a', '#ffffff'])
check('aclarar y oscurecer dan colores hex válidos', palette.SPHERE_COLORS.every(c => /^#[0-9a-f]{6}$/.test(palette.lighten(c, 0.5)) && /^#[0-9a-f]{6}$/.test(palette.darken(c, 0.5))), true)
{
  const clashes = []
  for (let count = 2; count <= 40; count++) {
    for (let i = 0; i < count; i++) {
      const next = (i + 1) % count
      if (palette.segmentColor(i, count) === palette.segmentColor(next, count)) clashes.push(`${i}/${count}`)
    }
  }
  check('ruleta: dos segmentos vecinos nunca tienen el mismo color', clashes, [])
}

// ---------------------------------------------------------------------------
// Confeti
// ---------------------------------------------------------------------------

{
  const rng = physics.createRng(42)
  const particles = confetti.makeParticles({ count: 80, x: 100, y: 200, angle: 90, spread: 60, rng })
  check('se crean las partículas pedidas', particles.length, 80)
  check('salen hacia arriba (y decrece)', particles.every(p => p.vy < 0), true)
  check('los colores son los de la paleta', particles.every(p => confetti.CONFETTI_COLORS.includes(p.color)), true)

  const again = confetti.makeParticles({ count: 80, x: 100, y: 200, angle: 90, spread: 60, rng: physics.createRng(42) })
  check('con la misma semilla las ráfagas son iguales', JSON.stringify(again), JSON.stringify(particles))

  const first = particles[0]
  const vyStart = first.vy
  confetti.stepParticles(particles, 0.5)
  check('la gravedad frena la subida', first.vy > vyStart, true)

  let alive = particles.length
  for (let i = 0; i < 200 && alive > 0; i++) alive = confetti.stepParticles(particles, 0.05)
  check('el confeti se apaga solo en pocos segundos', alive, 0)
}

// ---------------------------------------------------------------------------
// Escena en vivo: cuenta regresiva y tablero de números
// ---------------------------------------------------------------------------

check('cuenta regresiva de menos de un día', stage.formatCountdown(((4 * 60 + 12) * 60 + 9) * 1000), '04:12:09')
check('cuenta regresiva con días', stage.formatCountdown((2 * 86400 + 3 * 3600 + 5 * 60 + 7) * 1000), '2 d 03:05:07')
check('cuenta regresiva nunca es negativa', stage.formatCountdown(-5000), '00:00:00')

{
  const ranges = [[1, 3], [5, 7], [20, 20]]
  check('un número dentro de un rango está asignado', [1, 3, 5, 7, 20].map(n => stage.isTicketTaken(n, ranges)), [true, true, true, true, true])
  check('un número en un hueco no está asignado', [0, 4, 8, 19, 21, 500].map(n => stage.isTicketTaken(n, ranges)), [false, false, false, false, false, false])
  check('sin rangos nada está asignado', stage.isTicketTaken(1, []), false)
  check('sin rangos de la API se asumen los primeros N', stage.ticketRanges(null, 4), [[1, 4]])
  check('sin tickets y sin rangos queda vacío', stage.ticketRanges(undefined, 0), [])
  check('los rangos de la API se respetan', stage.ticketRanges(ranges, 99), ranges)
  check('número más alto asignado', [stage.highestTicket(ranges), stage.highestTicket([])], [20, 0])
  check('bloque de un ticket', [1, 100, 101, 250].map(n => stage.blockOfTicket(n)), [0, 0, 1, 2])
  check('cantidad de bloques', [0, 1, 100, 101, 250].map(n => stage.boardBlockCount(n)), [1, 1, 1, 2, 3])

  const flags = stage.takenFlags([[1, 3], [5, 7], [100, 103]], 0)
  check('un bloque tiene 100 casilleros', flags.length, 100)
  check('casilleros asignados del primer bloque', flags.map((taken, i) => (taken ? i + 1 : null)).filter(Boolean), [1, 2, 3, 5, 6, 7, 100])
  check('el segundo bloque arranca en el 101', stage.takenFlags([[1, 3], [100, 103]], 1).slice(0, 4), [true, true, true, false])
}

check('barra de avance: casilleros asignados por bloque', [0, 1, 2, 3].map(b => stage.blockFill([[1, 3], [95, 230]], b)), [3 + 6, 100, 30, 0])
check('barra de avance: sin rangos no hay nada', stage.blockFill([], 0), 0)
check('barra de avance coincide con los casilleros marcados', stage.takenFlags([[1, 3], [95, 230]], 0).filter(Boolean).length, stage.blockFill([[1, 3], [95, 230]], 0))

{
  // La ruleta dibujada en el canvas frena con la flecha sobre el segmento del ganador.
  const TAU = Math.PI * 2
  let bad = []
  let notForward = []
  const rng = physics.createRng(99)
  for (const total of [1, 2, 3, 7, 24, 36, 37, 100, 842, 5000]) {
    for (const ticket of [1, 2, Math.ceil(total / 2), total]) {
      for (let k = 0; k < 6; k++) {
        const from = (rng() - 0.5) * 40 * TAU // cualquier ángulo de partida, también negativo
        const { final, winning, segments } = stage.wheelSpinTarget(from, ticket, total)
        if (stage.segmentUnderPointer(final, segments) !== winning) bad.push(`${ticket}/${total} desde ${from.toFixed(2)}`)
        if (!(final - from >= 5 * TAU && final - from < 6 * TAU + 1e-9)) notForward.push(`${ticket}/${total}`)
        if (winning !== stage.segmentOfTicket(ticket, total, segments)) bad.push(`segmento ${ticket}/${total}`)
      }
    }
  }
  check('la ruleta del canvas frena sobre el segmento del ganador (cualquier ángulo de partida)', bad, [])
  check('el giro es siempre hacia adelante y de 5 a 6 vueltas', notForward, [])

  // La flecha pasa por todos los segmentos, en orden, mientras la ruleta gira.
  const segments = 12
  const seen = []
  for (let r = 0; r < TAU; r += 0.01) {
    const index = stage.segmentUnderPointer(-r, segments) // girando en sentido horario, -rotación crece
    if (seen[seen.length - 1] !== index) seen.push(index)
  }
  check('la flecha recorre los segmentos uno por uno', seen.slice(0, 13), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0].slice(0, seen.slice(0, 13).length))
  check('con rotación 0, la flecha está sobre el primer segmento', stage.segmentUnderPointer(0, 12), 0)
}

{
  // Una esfera que flota por delante no choca ni mueve a las demás: el resultado
  // es idéntico al de un mundo igual, sin esa esfera.
  const build = withFloating => {
    const world = physics.createWorld({ seed: 4 })
    const r = physics.ballRadiusFor(40)
    const others = Array.from({ length: 40 }, () => physics.addBall(world, { r }))
    physics.scatterBottom(world, others)
    physics.settleWorld(world, 1)
    world.jet = 0
    const floating = withFloating ? physics.addBall(world, { r: 30, x: 0, y: 40, noCollide: true, fixed: true }) : null
    for (let i = 0; i < 120; i++) physics.stepWorld(world, 1 / 60)
    return { others, floating }
  }
  const withBall = build(true)
  const without = build(false)
  const worst = withBall.others.reduce((acc, b, i) => Math.max(acc, Math.hypot(b.x - without.others[i].x, b.y - without.others[i].y)), 0)
  check('una esfera sin colisión no empuja a las demás', worst < 1e-9, true)
  check('una esfera fija no se mueve sola', [withBall.floating.x, withBall.floating.y], [0, 40])
}

check('la ruleta de la escena usa los mismos segmentos que la del sorteo', [stage.wheelSegmentCount(5), stage.wheelSegmentCount(500)], [5, 36])
check('cada ticket cae en un segmento válido', [1, 17, 36, 400].every(t => {
  const seg = stage.segmentOfTicket(t, 400, 36)
  return seg >= 0 && seg < 36
}), true)

// ---------------------------------------------------------------------------
// Sonido (con un contexto de audio falso)
// ---------------------------------------------------------------------------

function installFakeAudio() {
  const log = { oscillators: 0, noises: 0, contexts: 0, resumed: 0, cutoffs: 0, stops: 0 }
  const param = () => ({ setValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {}, setTargetAtTime() { log.cutoffs++ }, value: 0 })

  class FakeAudioContext {
    constructor() {
      log.contexts++
      this.currentTime = 0
      this.sampleRate = 8000
      this.state = 'suspended'
      this.destination = {}
    }
    resume() {
      log.resumed++
      this.state = 'running'
      return Promise.resolve()
    }
    createGain() {
      return { gain: param(), connect() {} }
    }
    createOscillator() {
      return { type: '', frequency: param(), connect() {}, start() { log.oscillators++ }, stop() {} }
    }
    createBuffer(channels, length) {
      return { getChannelData: () => new Float32Array(length) }
    }
    createBufferSource() {
      return { buffer: null, connect() {}, start() { log.noises++ }, stop() { log.stops++ } }
    }
    createBiquadFilter() {
      return { type: '', Q: { value: 0 }, frequency: param(), connect() {} }
    }
  }

  const storage = new Map()
  globalThis.window = { AudioContext: FakeAudioContext }
  globalThis.localStorage = {
    getItem: key => (storage.has(key) ? storage.get(key) : null),
    setItem: (key, value) => storage.set(key, String(value)),
  }
  return { log, storage }
}

{
  const { log, storage } = installFakeAudio()
  const sound = loadLibModule('giveaways/sound.js', [
    'isSoundMuted',
    'setSoundMuted',
    'subscribeSound',
    'unlockAudio',
    'playTick',
    'playDrop',
    'playConfirm',
    'playRumble',
    'playWinner',
    'scheduleTicks',
  ])

  check('el sonido arranca activado', sound.isSoundMuted(), false)
  sound.playWinner()
  check('la revelación toca varias notas y un soplido', [log.oscillators >= 10, log.noises], [true, 1])
  check('se crea un solo contexto de audio y se reanuda', [log.contexts, log.resumed >= 1], [1, true])

  const before = log.oscillators
  sound.playDrop()
  sound.playConfirm()
  sound.playTick()
  check('cada sonido agrega notas', log.oscillators > before, true)
  const stopRumble = sound.playRumble(500)
  check('el redoble usa ruido y se puede cortar', [log.noises, typeof stopRumble, (stopRumble(), [log.cutoffs, log.stops])], [2, 'function', [1, 1]])

  let notified = 0
  const unsubscribe = sound.subscribeSound(() => notified++)
  sound.setSoundMuted(true)
  check('silenciar avisa a quien escucha y se guarda', [notified, storage.get('giveaway-sound'), sound.isSoundMuted()], [1, 'off', true])

  const silent = log.oscillators + log.noises
  sound.playWinner()
  sound.playDrop()
  sound.playTick()
  const silentStop = sound.playRumble(500)
  check('silenciado, el redoble devuelve una función que no hace nada', typeof silentStop, 'function')
  check('silenciado no suena nada', log.oscillators + log.noises, silent)

  sound.setSoundMuted(false)
  unsubscribe()
  sound.setSoundMuted(true)
  check('quien se desuscribió no recibe más avisos', notified, 2)
  check('se puede volver a activar', (sound.setSoundMuted(false), sound.isSoundMuted()), false)

  // Los clics programados se pueden cancelar.
  const ticks = log.oscillators
  const cancel = sound.scheduleTicks([5, 5, 5])
  cancel()
  check('cancelar los clics programados evita que suenen', log.oscillators, ticks)

  delete globalThis.window
  delete globalThis.localStorage
}

{
  // Sin Web Audio (navegador viejo o sin audio): no falla.
  globalThis.window = {}
  const sound = loadLibModule('giveaways/sound.js', ['playWinner', 'playTick', 'unlockAudio'])
  let error = null
  try {
    sound.unlockAudio()
    sound.playWinner()
    sound.playTick()
  } catch (e) {
    error = e.message
  }
  check('sin Web Audio los sonidos no hacen nada ni fallan', error, null)
  delete globalThis.window
}

if (failures > 0) {
  console.log(`\n${failures} caso(s) fallaron`)
  process.exitCode = 1
} else {
  console.log('\nTodos los casos pasaron')
}
