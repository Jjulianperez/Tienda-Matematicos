// Confeti para la revelación del ganador, dibujado en un canvas que cubre la
// pantalla y se borra solo. Sin dependencias. Código de navegador.
//
// Con "reducir movimiento" activado en el sistema no se lanza nada.

export const CONFETTI_COLORS = ['#94a86a', '#c9db9f', '#f4c95d', '#d7b98e', '#75aadb', '#f7f2e8', '#dcb06e', '#a5c9e8']

const GRAVITY = 1500 // px/s²
const DRAG = 0.9 // fracción de velocidad que se conserva por segundo

/**
 * Crea las partículas de una ráfaga. `rng` devuelve números en [0, 1).
 * `angle` es la dirección central en grados (0 = derecha, 90 = arriba) y
 * `spread` la apertura total del abanico.
 */
export function makeParticles({ count, x, y, angle = 90, spread = 70, power = 1, rng = Math.random, colors = CONFETTI_COLORS }) {
  const particles = []
  for (let i = 0; i < count; i++) {
    const heading = ((angle + (rng() - 0.5) * spread) * Math.PI) / 180
    const speed = (500 + rng() * 700) * power
    particles.push({
      x,
      y,
      vx: Math.cos(heading) * speed,
      vy: -Math.sin(heading) * speed,
      size: 6 + rng() * 7,
      color: colors[Math.floor(rng() * colors.length)],
      round: rng() < 0.3,
      rotation: rng() * Math.PI * 2,
      spin: (rng() - 0.5) * 14,
      wobble: rng() * Math.PI * 2,
      wobbleSpeed: 4 + rng() * 6,
      life: 0,
      ttl: 2.2 + rng() * 1.6,
    })
  }
  return particles
}

/** Avanza las partículas `dt` segundos. Devuelve cuántas siguen vivas. */
export function stepParticles(particles, dt) {
  let alive = 0
  const drag = Math.pow(DRAG, dt)
  for (const p of particles) {
    p.life += dt
    if (p.life >= p.ttl) continue
    p.vx *= drag
    p.vy = p.vy * drag + GRAVITY * dt
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.rotation += p.spin * dt
    p.wobble += p.wobbleSpeed * dt
    alive++
  }
  return alive
}

function reducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/**
 * Lanza confeti: una ráfaga desde el centro y dos cañones laterales.
 * Devuelve una función que lo corta antes de tiempo.
 */
export function launchConfetti({ intensity = 1 } = {}) {
  if (typeof document === 'undefined' || reducedMotion()) return () => {}

  const canvas = document.createElement('canvas')
  canvas.setAttribute('aria-hidden', 'true')
  Object.assign(canvas.style, {
    position: 'fixed',
    inset: '0',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: '70', // por encima de los modales (z-50)
  })
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const width = window.innerWidth
  const height = window.innerHeight
  canvas.width = Math.floor(width * dpr)
  canvas.height = Math.floor(height * dpr)
  document.body.appendChild(canvas)

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    canvas.remove()
    return () => {}
  }
  ctx.scale(dpr, dpr)

  const scale = Math.min(1, width / 700) // en el celular, un poco menos de fuerza
  const n = Math.round(90 * intensity)
  const particles = [
    ...makeParticles({ count: n, x: width / 2, y: height * 0.55, angle: 90, spread: 80, power: 0.9 * (0.6 + 0.4 * scale) }),
    ...makeParticles({ count: Math.round(n * 0.6), x: 0, y: height * 0.8, angle: 60, spread: 40, power: 1.1 * (0.6 + 0.4 * scale) }),
    ...makeParticles({ count: Math.round(n * 0.6), x: width, y: height * 0.8, angle: 120, spread: 40, power: 1.1 * (0.6 + 0.4 * scale) }),
  ]

  let frame = 0
  let last = performance.now()
  let stopped = false

  const stop = () => {
    if (stopped) return
    stopped = true
    cancelAnimationFrame(frame)
    canvas.remove()
  }

  const draw = now => {
    const dt = Math.min((now - last) / 1000, 0.05)
    last = now
    const alive = stepParticles(particles, dt)

    ctx.clearRect(0, 0, width, height)
    for (const p of particles) {
      if (p.life >= p.ttl) continue
      const fade = Math.min(1, (p.ttl - p.life) / 0.6)
      ctx.save()
      ctx.globalAlpha = fade
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rotation)
      ctx.fillStyle = p.color
      if (p.round) {
        ctx.beginPath()
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2)
        ctx.fill()
      } else {
        // El ancho oscila: simula el papel girando en el aire.
        ctx.fillRect(-p.size / 2, (-p.size * 0.35) * Math.abs(Math.cos(p.wobble)), p.size, p.size * 0.7 * Math.abs(Math.cos(p.wobble)) + 1)
      }
      ctx.restore()
    }

    if (alive === 0) return stop()
    frame = requestAnimationFrame(draw)
  }

  frame = requestAnimationFrame(draw)
  return stop
}
