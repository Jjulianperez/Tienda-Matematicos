// Motor mínimo de esferas dentro de una urna circular (integración de Verlet
// con colisiones por posición). Es solo decoración: las esferas no deciden nada
// del sorteo; cada una representa una oportunidad ya asignada.
//
// Todo está en "unidades del mundo": la urna es un círculo de radio 100 con el
// centro en (0, 0), y el eje y crece hacia ABAJO (igual que en un canvas). El
// dibujo lo escala al tamaño real. El paso de tiempo es fijo (1/120 s), así que
// con la misma semilla la simulación es siempre la misma y se puede probar.

export const WORLD_RADIUS = 100
export const MAX_BALLS = 150

const H = 1 / 120 // paso fijo
const MAX_SUBSTEPS = 8 // por llamada: si la pestaña estuvo dormida no se recupera todo el tiempo perdido
const ITERATIONS = 4 // pasadas del resolvedor de colisiones por paso
const DAMPING = 0.9993 // fracción de velocidad que se conserva por paso
const STIFFNESS = 0.92 // qué parte de la superposición se corrige por pasada
const FILL = 0.4 // fracción del área de la urna que ocupan las esferas
const MIN_BALL = 5.2
const MAX_BALL = 16

/** Generador pseudoaleatorio determinista (mulberry32). Devuelve números en [0, 1). */
export function createRng(seed) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Radio de cada esfera para que `count` ocupen más o menos la mitad de la urna. */
export function ballRadiusFor(count, worldRadius = WORLD_RADIUS) {
  const n = Math.max(count, 1)
  return Math.min(MAX_BALL, Math.max(MIN_BALL, worldRadius * Math.sqrt(FILL / n)))
}

/** Cuántas esferas se dibujan para `tickets` oportunidades (tope para que corra bien en un celular). */
export function visibleBallCount(tickets) {
  return Math.min(Math.max(Math.trunc(tickets) || 0, 0), MAX_BALLS)
}

export function createWorld({ radius = WORLD_RADIUS, seed = 7, gravity = 520 } = {}) {
  return {
    radius,
    gravity,
    rng: createRng(seed),
    balls: [],
    time: 0,
    pending: 0, // tiempo acumulado que todavía no se simuló
    nextId: 1,
    jet: 1, // 0 = sin chorro de aire (las esferas descansan), 1 = mezclando
  }
}

/** Agrega una esfera. `r` es obligatorio; el resto tiene valores por defecto. */
export function addBall(world, ball) {
  const vx = ball.vx ?? 0
  const vy = ball.vy ?? 0
  const x = ball.x ?? 0
  const y = ball.y ?? 0
  const added = {
    ...ball,
    id: world.nextId++,
    x,
    y,
    px: x - vx * H, // posición anterior: de ahí sale la velocidad en Verlet
    py: y - vy * H,
  }
  world.balls.push(added)
  return added
}

export function removeBall(world, id) {
  const index = world.balls.findIndex(b => b.id === id)
  if (index >= 0) world.balls.splice(index, 1)
}

/** Punto donde aparece una esfera nueva: arriba de la urna, un poco al costado al azar. */
export function spawnPoint(world, r) {
  return {
    x: (world.rng() - 0.5) * world.radius * 0.55,
    y: -(world.radius - r - 3),
  }
}

/** Reparte las esferas al azar en la mitad de abajo (para empezar ya asentadas). */
export function scatterBottom(world, balls) {
  for (const ball of balls) {
    const r = ball.r
    const angle = world.rng() * Math.PI
    const dist = Math.sqrt(world.rng()) * (world.radius - r - 1)
    ball.x = Math.cos(angle) * dist
    ball.y = Math.abs(Math.sin(angle)) * dist * 0.9 // 0..R hacia abajo
    ball.px = ball.x
    ball.py = ball.y
  }
}

function collide(world) {
  const balls = world.balls
  for (let i = 0; i < balls.length; i++) {
    const a = balls[i]
    if (a.noCollide) continue
    for (let j = i + 1; j < balls.length; j++) {
      const b = balls[j]
      if (b.noCollide) continue
      const dx = b.x - a.x
      const dy = b.y - a.y
      const min = a.r + b.r
      const d2 = dx * dx + dy * dy
      if (d2 >= min * min) continue

      const d = Math.sqrt(d2)
      let nx = 1
      let ny = 0
      if (d > 1e-6) {
        nx = dx / d
        ny = dy / d
      }
      const overlap = (min - d) * STIFFNESS
      const massA = a.r * a.r
      const massB = b.r * b.r
      const weightA = massB / (massA + massB) // la más liviana se mueve más
      const weightB = massA / (massA + massB)
      a.x -= nx * overlap * weightA
      a.y -= ny * overlap * weightA
      b.x += nx * overlap * weightB
      b.y += ny * overlap * weightB
    }
  }
}

function keepInside(world) {
  for (const b of world.balls) {
    if (b.fixed) continue
    const max = world.radius - b.r
    const d = Math.hypot(b.x, b.y)
    if (d > max) {
      const k = max / d
      b.x *= k
      b.y *= k
    }
  }
}

function substep(world) {
  const { balls, radius, gravity } = world
  world.time += H

  // Chorro de aire que sube por el centro y "respira": las esferas se mezclan
  // como en una urna de bingo, sin quedarse siempre en el mismo lugar.
  const breathe = 0.5 + 0.5 * Math.sin(world.time * 1.1)
  const jetPower = world.jet * gravity * 2.7 * (0.25 + 0.75 * breathe * breathe)
  const jetWidth = radius * 0.42

  for (const b of balls) {
    if (b.fixed) continue
    const vx = (b.x - b.px) * DAMPING
    const vy = (b.y - b.py) * DAMPING
    let ax = 0
    let ay = gravity

    if (jetPower > 0) {
      const k = 1 - Math.min(1, Math.abs(b.x) / jetWidth)
      if (k > 0 && b.y > -radius * 0.5) {
        ay -= jetPower * k
        // Turbulencia lateral determinista, distinta para cada esfera.
        ax += Math.sin(world.time * 2.6 + b.id * 1.7) * jetPower * 0.3 * k
      }
    }

    b.px = b.x
    b.py = b.y
    b.x += vx + ax * H * H
    b.y += vy + ay * H * H
  }

  for (let i = 0; i < ITERATIONS; i++) {
    collide(world)
    keepInside(world)
  }
}

/** Avanza la simulación `dt` segundos (pasos fijos). */
export function stepWorld(world, dt) {
  world.pending += Math.max(0, dt)
  let steps = 0
  while (world.pending >= H && steps < MAX_SUBSTEPS) {
    substep(world)
    world.pending -= H
    steps++
  }
  // Si quedó mucho atrasado (pestaña dormida), se descarta en vez de acumular.
  if (world.pending > H * MAX_SUBSTEPS) world.pending = 0
}

/** Simula `seconds` segundos sin dibujar, con el chorro apagado: deja todo asentado. */
export function settleWorld(world, seconds = 2) {
  const jet = world.jet
  world.jet = 0
  const steps = Math.ceil(seconds / H)
  for (let i = 0; i < steps; i++) substep(world)
  world.jet = jet
}
