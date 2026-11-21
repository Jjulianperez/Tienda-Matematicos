// Motor de la urna de vidrio con esferas: simulación y dibujo en un canvas.
// Lo usan la escena en vivo (UrnLive) y la revelación del ganador (draw/Urn).
//
// Todo vive acá, fuera de React: los componentes solo crean el motor, le avisan
// de los cambios y lo destruyen al salir.
//
// Las esferas son decoración: cada una representa una oportunidad ya asignada.
// Nada de lo que se ve decide quién gana; en la revelación, el ticket ganador
// llega ya decidido por el servidor y la animación solo lo presenta.

import {
  createWorld,
  addBall,
  removeBall,
  spawnPoint,
  scatterBottom,
  stepWorld,
  settleWorld,
  ballRadiusFor,
  visibleBallCount,
} from '@/lib/giveaways/physics'
import { SPHERE_COLORS, MINE_COLOR, lighten, darken } from '@/lib/giveaways/palette'
import { playDrop, playConfirm } from '@/lib/giveaways/sound'
import { TAU, roundedRect, drawPill } from './canvasUtils'

const MINE_FACTOR = 1.3 // la esfera de la persona es más grande para encontrarla
const GHOST_FACTOR = 1.15
const SPAWN_GAP = 0.11 // segundos entre esferas cuando llegan varias juntas
const WINNER_RADIUS = 0.36 // radio de la esfera ganadora, como fracción de la urna

const easeInOutCubic = p => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2)

// Esfera con volumen: degradado radial con la luz arriba a la izquierda, un
// reflejo de rebote abajo a la derecha y un brillo especular. Se dibuja una vez
// por color y tamaño y después solo se copia (más barato que un degradado por
// esfera y por cuadro).
function makeSprite(color, radius) {
  const size = Math.ceil(radius * 2) + 4
  const sprite = document.createElement('canvas')
  sprite.width = size
  sprite.height = size
  const c = sprite.getContext('2d')
  const m = size / 2

  const body = c.createRadialGradient(m - radius * 0.36, m - radius * 0.42, radius * 0.05, m, m, radius)
  body.addColorStop(0, lighten(color, 0.8))
  body.addColorStop(0.3, lighten(color, 0.2))
  body.addColorStop(0.72, color)
  body.addColorStop(1, darken(color, 0.55))
  c.fillStyle = body
  c.beginPath()
  c.arc(m, m, radius, 0, TAU)
  c.fill()

  c.save()
  c.beginPath()
  c.arc(m, m, radius, 0, TAU)
  c.clip()
  const bounce = c.createRadialGradient(m + radius * 0.5, m + radius * 0.6, radius * 0.05, m + radius * 0.5, m + radius * 0.6, radius * 0.85)
  bounce.addColorStop(0, 'rgba(255,255,255,0.3)')
  bounce.addColorStop(1, 'rgba(255,255,255,0)')
  c.fillStyle = bounce
  c.fillRect(0, 0, size, size)
  c.restore()

  c.fillStyle = 'rgba(255,255,255,0.88)'
  c.beginPath()
  c.ellipse(m - radius * 0.36, m - radius * 0.44, radius * 0.22, radius * 0.13, -0.65, 0, TAU)
  c.fill()
  return sprite
}

// Resplandor y rayos de luz detrás de la esfera ganadora.
function drawHalo(ctx, x, y, radius, time) {
  const glow = radius * 2.7
  const gradient = ctx.createRadialGradient(x, y, radius * 0.7, x, y, glow)
  gradient.addColorStop(0, 'rgba(244,201,93,0.6)')
  gradient.addColorStop(0.5, 'rgba(244,201,93,0.18)')
  gradient.addColorStop(1, 'rgba(244,201,93,0)')
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(x, y, glow, 0, TAU)
  ctx.fill()

  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(time * 0.45)
  ctx.fillStyle = 'rgba(255,238,175,0.12)'
  for (let i = 0; i < 14; i++) {
    ctx.rotate(TAU / 14)
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(glow * 1.15, -glow * 0.075)
    ctx.lineTo(glow * 1.15, glow * 0.075)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
}

/**
 * Crea el motor de la urna sobre un canvas.
 *
 * Métodos: update(props), reveal(options), resize(width), setVisible(bool),
 * start(), destroy().
 *
 * props de update:
 *   tickets   oportunidades en total
 *   mine      { name, tickets: number[], pending: boolean } | null
 *   excluded  números de ticket que ya salieron (en la revelación, los ganadores
 *             anteriores): sus esferas ya no están en la urna
 *   jet       intensidad de la mezcla (0 = descansan, 1 = mezclando)
 */
export function createUrnEngine(canvas, { reducedMotion }) {
  const ctx = canvas.getContext('2d')
  const world = createWorld({ seed: 20260101 })
  const fontFamily = getComputedStyle(canvas).fontFamily || 'sans-serif'
  const sprites = new Map()
  const state = {
    width: 0,
    height: 0,
    dpr: 1,
    visible: true,
    raf: 0,
    last: 0,
    clock: 0, // segundos, en la misma escala que performance.now()
    time: 0,
    queue: [],
    queueWait: 0,
    effects: [],
    seq: 0,
    props: null,
    reveal: null,
    destroyed: false,
  }

  const ofKind = kind => world.balls.filter(b => b.kind === kind)

  function spriteFor(color, radiusPx) {
    // Se agrupan los tamaños de a medio píxel: mientras una esfera crece o se
    // achica no se crea un sprite nuevo por cuadro.
    const radius = Math.max(2, Math.round(radiusPx * 2) / 2)
    const key = `${color}|${radius}`
    let sprite = sprites.get(key)
    if (!sprite) {
      if (sprites.size > 160) sprites.clear()
      sprite = makeSprite(color, radius)
      sprites.set(key, sprite)
    }
    return sprite
  }

  const factorOf = kind => (kind === 'mine' ? MINE_FACTOR : kind === 'ghost' ? GHOST_FACTOR : 1)

  function retarget(snap) {
    const baseRadius = ballRadiusFor(world.balls.length)
    for (const ball of world.balls) {
      if (ball.kind === 'winner') continue
      ball.targetR = baseRadius * factorOf(ball.kind)
      if (snap || ball.r === undefined) ball.r = ball.targetR
    }
  }

  function createBall(kind, { animate }) {
    const color = kind === 'anon' ? SPHERE_COLORS[state.seq % SPHERE_COLORS.length] : MINE_COLOR
    const r = ballRadiusFor(world.balls.length + 1) * factorOf(kind)
    const ball = addBall(world, { r, targetR: r, kind, color, seq: state.seq++, flash: 0 })
    if (animate) {
      const point = spawnPoint(world, r)
      ball.x = point.x
      ball.y = point.y
      ball.px = point.x
      ball.py = point.y - 1.2 // empuje inicial hacia abajo
      state.effects.push({ x: point.x, y: point.y, age: 0, life: 0.7, color })
    } else {
      scatterBottom(world, [ball])
    }
    return ball
  }

  function processQueue(dt) {
    if (state.queue.length === 0) return
    state.queueWait -= dt
    if (state.queueWait > 0) return
    state.queueWait = SPAWN_GAP
    const job = state.queue.shift()
    if (job === 'anon') createBall('anon', { animate: true })
    retarget(false)
    assignLabels()
  }

  // Cada esfera "común" lleva un número de oportunidad (los que no son de la
  // persona que mira ni de ganadores anteriores), como una bolilla de bingo.
  function assignLabels() {
    const props = state.props
    if (!props) return
    const skip = new Set([...(props.mine?.tickets ?? []), ...(props.excluded ?? [])])
    const others = []
    for (let n = 1; others.length < world.balls.length && n <= props.tickets + skip.size + 1; n++) {
      if (!skip.has(n)) others.push(n)
    }
    ofKind('anon')
      .sort((a, b) => a.seq - b.seq)
      .forEach((ball, i) => { ball.number = others[i] })
    ofKind('mine').forEach((ball, i) => {
      ball.number = props.mine.tickets[i]
      ball.name = props.mine.name
    })
    ofKind('ghost').forEach(ball => { ball.name = props.mine?.name })
  }

  function update(props) {
    const first = !state.props
    const animate = !first && !reducedMotion
    state.props = props
    if (!state.reveal) world.jet = reducedMotion ? 0 : props.jet ?? 1

    const mineNumbers = props.mine?.tickets ?? []
    const ghostWanted = Boolean(props.mine?.pending) && mineNumbers.length === 0
    const remaining = Math.max(1, props.tickets - (props.excluded?.length ?? 0))
    const total = Math.max(visibleBallCount(props.tickets === 0 ? 0 : remaining), mineNumbers.length)
    const anonWanted = Math.max(0, total - mineNumbers.length)

    // La esfera de la persona: si estaba "en revisión" se confirma; si no, cae una nueva.
    while (ofKind('mine').length < mineNumbers.length) {
      const ghost = ofKind('ghost')[0]
      if (ghost) {
        ghost.kind = 'mine'
        ghost.color = MINE_COLOR
        ghost.flash = 1
        state.effects.push({ x: ghost.x, y: ghost.y, age: 0, life: 0.8, color: MINE_COLOR })
        if (animate) playConfirm()
      } else {
        createBall('mine', { animate })
        if (animate) playDrop()
      }
    }
    while (ofKind('mine').length > mineNumbers.length) removeBall(world, ofKind('mine').pop().id)

    if (ghostWanted && ofKind('ghost').length === 0) {
      createBall('ghost', { animate })
      if (animate) playDrop()
    }
    if (!ghostWanted) ofKind('ghost').forEach(ball => removeBall(world, ball.id))

    // Las demás: se agregan de a una (si llegan varias juntas) o se sacan de golpe.
    const anon = ofKind('anon')
    state.queue = state.queue.filter(job => job !== 'anon')
    if (anon.length < anonWanted) {
      const missing = anonWanted - anon.length
      if (animate) {
        for (let i = 0; i < Math.min(missing, 40); i++) state.queue.push('anon')
        for (let i = 40; i < missing; i++) createBall('anon', { animate: false })
      } else {
        for (let i = 0; i < missing; i++) createBall('anon', { animate: false })
      }
    } else if (anon.length > anonWanted) {
      anon.sort((a, b) => b.seq - a.seq).slice(0, anon.length - anonWanted).forEach(ball => removeBall(world, ball.id))
    }

    retarget(first || reducedMotion)
    assignLabels()

    if (first || reducedMotion) {
      // Empieza ya asentada: no se ve caer todo al abrir la página.
      settleWorld(world, 2.5)
      if (reducedMotion) render()
    }
  }

  // ---- Revelación del ganador -------------------------------------------
  //
  // 1. La urna mezcla con fuerza (el chorro de aire va subiendo).
  // 2. Al final del tiempo, la esfera del ticket ganador se separa, sube al
  //    centro, crece y se pone dorada con su número; las demás caen y se
  //    acomodan abajo.
  // Termina justo cuando se cumple `durationMs`, que es cuando la pantalla
  // muestra el nombre.

  function reveal({ ticket, durationMs, onDone }) {
    const anon = ofKind('anon')
    // Con hasta 150 oportunidades cada esfera lleva su número: se elige la que
    // corresponde al ticket. Con más, una cualquiera (siempre la misma para el
    // mismo ticket) y se le pone el número ganador.
    const chosen = anon.find(ball => ball.number === ticket) || anon[Math.abs(ticket) % Math.max(anon.length, 1)] || world.balls[0]
    if (!chosen) {
      onDone?.()
      return
    }
    const duration = durationMs / 1000
    const captureDur = Math.max(1.1, duration * 0.3)
    state.reveal = {
      phase: 'mix',
      startedAt: performance.now() / 1000,
      captureAt: Math.max(0.2, duration - captureDur),
      captureDur,
      ball: chosen,
      ticket,
      onDone,
      from: null,
    }
  }

  function startCapture() {
    const rv = state.reveal
    const ball = rv.ball
    ball.kind = 'winner'
    ball.color = MINE_COLOR
    ball.number = rv.ticket
    ball.fixed = true // ya no lo mueve la física: lo lleva la animación
    ball.noCollide = true // flota por delante, sin empujar a las demás
    ball.flash = 1
    rv.from = { x: ball.x, y: ball.y, r: ball.r }
    rv.phase = 'capture'
    world.jet = 0 // las demás caen y descansan
    state.effects.push({ x: ball.x, y: ball.y, age: 0, life: 0.9, color: MINE_COLOR })
  }

  function tickReveal() {
    const rv = state.reveal
    const elapsed = state.clock - rv.startedAt

    if (rv.phase === 'mix') {
      world.jet = Math.min(1.8, 0.5 + elapsed * 1.4)
      if (elapsed >= rv.captureAt) startCapture()
    }

    if (rv.phase === 'capture') {
      const progress = Math.min(1, (elapsed - rv.captureAt) / rv.captureDur)
      const eased = easeInOutCubic(progress)
      const ball = rv.ball
      ball.x = rv.from.x * (1 - eased)
      ball.y = rv.from.y + (-4 - rv.from.y) * eased
      ball.r = rv.from.r + (world.radius * WINNER_RADIUS - rv.from.r) * eased
      ball.px = ball.x
      ball.py = ball.y
      if (progress >= 1) {
        rv.phase = 'done'
        rv.onDone?.()
      }
    }
  }

  // ---- Dibujo ------------------------------------------------------------

  function render() {
    const { width, height, dpr } = state
    if (!width) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)

    const globeRadius = width * 0.455
    const cx = width / 2
    const cy = globeRadius + width * 0.03
    const k = globeRadius / world.radius
    const t = state.time

    // Base y sombra
    ctx.fillStyle = 'rgba(0,0,0,0.38)'
    ctx.beginPath()
    ctx.ellipse(cx, width * 1.035, width * 0.3, width * 0.028, 0, 0, TAU)
    ctx.fill()
    const baseTop = width * 0.905
    const baseGradient = ctx.createLinearGradient(0, baseTop, 0, width * 1.0)
    baseGradient.addColorStop(0, '#3a3d42')
    baseGradient.addColorStop(1, '#1b1c1f')
    roundedRect(ctx, cx - width * 0.23, baseTop, width * 0.46, width * 0.1, width * 0.03)
    ctx.fillStyle = baseGradient
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.09)'
    ctx.lineWidth = 1
    ctx.stroke()

    // Vidrio (fondo) y esferas, recortadas al círculo
    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, globeRadius, 0, TAU)
    const glass = ctx.createRadialGradient(cx, cy - globeRadius * 0.25, globeRadius * 0.1, cx, cy, globeRadius)
    glass.addColorStop(0, 'rgba(255,255,255,0.025)')
    glass.addColorStop(0.7, 'rgba(255,255,255,0.05)')
    glass.addColorStop(1, 'rgba(148,168,106,0.2)')
    ctx.fillStyle = glass
    ctx.fill()
    ctx.clip()

    const anonCount = ofKind('anon').length
    const showNumbers = anonCount <= 60
    const order = { anon: 0, ghost: 1, mine: 2, winner: 3 }
    const balls = [...world.balls].sort((a, b) => order[a.kind] - order[b.kind])
    const font = `600 12px ${fontFamily}`

    for (const ball of balls) {
      const x = cx + ball.x * k
      const y = cy + ball.y * k
      const radiusPx = ball.r * k

      if (ball.kind === 'winner') drawHalo(ctx, x, y, radiusPx, t)

      const sprite = spriteFor(ball.color, radiusPx * state.dpr)
      const size = sprite.width / state.dpr

      ctx.globalAlpha = ball.kind === 'ghost' ? 0.5 : 1
      ctx.drawImage(sprite, x - size / 2, y - size / 2, size, size)
      ctx.globalAlpha = 1

      if (ball.kind === 'anon' && showNumbers && radiusPx >= 11 && ball.number) {
        ctx.fillStyle = 'rgba(255,255,255,0.84)'
        ctx.beginPath()
        ctx.arc(x, y, radiusPx * 0.52, 0, TAU)
        ctx.fill()
        ctx.fillStyle = '#1a1d16'
        ctx.font = `700 ${Math.round(radiusPx * (ball.number > 99 ? 0.5 : 0.62))}px ${fontFamily}`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(String(ball.number), x, y + 0.5)
      }

      if (ball.kind === 'mine' || ball.kind === 'winner') {
        const pulse = 0.5 + 0.5 * Math.sin(t * 3.2)
        ctx.save()
        ctx.shadowColor = MINE_COLOR
        ctx.shadowBlur = (ball.kind === 'winner' ? 18 : 10) + pulse * 8
        ctx.strokeStyle = `rgba(244,201,93,${0.65 + pulse * 0.35})`
        ctx.lineWidth = ball.kind === 'winner' ? 3 : 2
        ctx.beginPath()
        ctx.arc(x, y, radiusPx + 2 + pulse * 1.5, 0, TAU)
        ctx.stroke()
        ctx.restore()
        if (ball.number) {
          ctx.fillStyle = 'rgba(26,29,22,0.9)'
          const digits = String(ball.number).length
          ctx.font = `800 ${Math.round(radiusPx * (ball.kind === 'winner' ? (digits > 3 ? 0.46 : 0.58) : 0.7))}px ${fontFamily}`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(`#${ball.number}`, x, y + 0.5)
        }
      }

      if (ball.kind === 'ghost') {
        ctx.save()
        ctx.setLineDash([5, 4])
        ctx.lineDashOffset = -t * 14
        ctx.strokeStyle = 'rgba(244,201,93,0.95)'
        ctx.lineWidth = 1.6
        ctx.beginPath()
        ctx.arc(x, y, radiusPx + 2, 0, TAU)
        ctx.stroke()
        ctx.restore()
      }

      if (ball.flash > 0) {
        ctx.fillStyle = `rgba(255,255,255,${ball.flash * 0.7})`
        ctx.beginPath()
        ctx.arc(x, y, radiusPx, 0, TAU)
        ctx.fill()
      }
    }
    ctx.restore()

    // Vidrio (frente): borde, brillo y reflejo
    const rim = ctx.createLinearGradient(cx - globeRadius, cy - globeRadius, cx + globeRadius, cy + globeRadius)
    rim.addColorStop(0, 'rgba(255,255,255,0.5)')
    rim.addColorStop(0.45, 'rgba(255,255,255,0.12)')
    rim.addColorStop(1, 'rgba(148,168,106,0.45)')
    ctx.lineWidth = 2.5
    ctx.strokeStyle = rim
    ctx.beginPath()
    ctx.arc(cx, cy, globeRadius, 0, TAU)
    ctx.stroke()

    ctx.lineCap = 'round'
    ctx.lineWidth = Math.max(3, width * 0.016)
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'
    ctx.beginPath()
    ctx.arc(cx, cy, globeRadius * 0.86, Math.PI * 1.08, Math.PI * 1.38)
    ctx.stroke()
    ctx.strokeStyle = 'rgba(255,255,255,0.14)'
    ctx.lineWidth = Math.max(2, width * 0.009)
    ctx.beginPath()
    ctx.arc(cx, cy, globeRadius * 0.86, Math.PI * 1.43, Math.PI * 1.5)
    ctx.stroke()
    ctx.lineCap = 'butt'

    // Aros de llegada de una esfera nueva
    for (const effect of state.effects) {
      const progress = effect.age / effect.life
      ctx.strokeStyle = effect.color
      ctx.globalAlpha = Math.max(0, 1 - progress) * 0.8
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(cx + effect.x * k, cy + effect.y * k, 8 + progress * 42, 0, TAU)
      ctx.stroke()
    }
    ctx.globalAlpha = 1

    // Nombre de la persona (y estado) sobre su esfera
    for (const ball of balls) {
      if (ball.kind === 'anon' || ball.kind === 'winner' || !ball.name) continue
      const x = cx + ball.x * k
      const y = cy + ball.y * k
      const radiusPx = ball.r * k
      const above = y - radiusPx - 17
      const label = ball.kind === 'ghost' ? `${ball.name} · en revisión` : ball.name
      drawPill(ctx, font, label, x, above < 14 ? y + radiusPx + 17 : above, { width, height }, {
        border: MINE_COLOR,
        color: '#f7f2e8',
      })
    }
  }

  function frame(now) {
    if (state.destroyed) return
    state.raf = requestAnimationFrame(frame)
    const dt = Math.min((now - state.last) / 1000, 0.05)
    state.last = now
    state.clock = now / 1000
    if (!state.visible || document.hidden) return

    state.time += dt
    processQueue(dt)
    if (state.reveal) tickReveal()

    for (const ball of world.balls) {
      if (ball.kind !== 'winner') ball.r += (ball.targetR - ball.r) * Math.min(1, dt * 6)
      if (ball.flash > 0) ball.flash = Math.max(0, ball.flash - dt * 1.8)
    }
    state.effects = state.effects.filter(effect => (effect.age += dt) < effect.life)

    stepWorld(world, dt)
    render()
  }

  return {
    update,
    reveal,
    resize(cssWidth) {
      const width = Math.max(200, Math.min(520, Math.round(cssWidth)))
      const height = Math.round(width * 1.08)
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      if (width === state.width && dpr === state.dpr) return
      state.width = width
      state.height = height
      state.dpr = dpr
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      sprites.clear()
      render()
    },
    setVisible(value) {
      state.visible = value
    },
    start() {
      if (reducedMotion || state.raf) return
      state.last = performance.now()
      state.raf = requestAnimationFrame(frame)
    },
    destroy() {
      state.destroyed = true
      cancelAnimationFrame(state.raf)
      state.raf = 0
    },
  }
}
