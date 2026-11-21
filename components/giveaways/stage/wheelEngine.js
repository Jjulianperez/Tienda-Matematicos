// Motor de la ruleta: simulación y dibujo en un canvas. Lo usan la escena en
// vivo (WheelLive) y la revelación del ganador (draw/Wheel).
//
// Cada segmento es una oportunidad (con muchas, un rango de ellas, igual que en
// el sorteo). En vivo gira despacio y, cuando entra alguien, el segmento nuevo
// crece y los demás se hacen lugar. En la revelación gira rápido y frena con la
// flecha sobre el segmento del ticket ganador, que ya decidió el servidor: la
// animación solo lo presenta.

import {
  wheelSegmentCount,
  segmentOfTicket,
  segmentRange,
  segmentUnderPointer,
  wheelSpinTarget,
} from '@/lib/giveaways/stage'
import { MINE_COLOR, segmentColor } from '@/lib/giveaways/palette'
import { playDrop, playConfirm } from '@/lib/giveaways/sound'
import { TAU, drawPill } from './canvasUtils'

const IDLE_SPIN = 0.14 // radianes por segundo (una vuelta cada ~45 s)
const STUDS = 28
const MIN_TICK_SLOTS = 12 // con pocos segmentos igual suenan clics (como mínimo 12 por vuelta)
const MIN_TICK_GAP = 0.035 // segundos entre clics: al principio, que gira muy rápido, no se juntan

const easeOutQuart = p => 1 - (1 - p) ** 4

/**
 * Crea el motor de la ruleta sobre un canvas.
 *
 * Métodos: update(props), spinTo(options), resize(width), setVisible(bool),
 * start(), destroy().
 *
 * props de update:
 *   tickets  oportunidades en total
 *   mine     { name, tickets: number[], pending: boolean } | null
 *   spin     multiplicador de la velocidad de giro en reposo (0 = quieta)
 */
export function createWheelEngine(canvas, { reducedMotion }) {
  const ctx = canvas.getContext('2d')
  const fontFamily = getComputedStyle(canvas).fontFamily || 'sans-serif'
  const state = {
    width: 0,
    height: 0,
    dpr: 1,
    visible: true,
    raf: 0,
    last: 0,
    clock: 0, // segundos, en la misma escala que performance.now()
    time: 0,
    lights: 0, // fase de las luces del aro
    rotation: 0,
    kick: 0,
    display: 0, // cantidad de segmentos que se dibujan (con decimales mientras crece uno)
    target: 0,
    props: null,
    pulse: null, // { index, value }: destello sobre un segmento
    spin: null, // giro de la revelación en curso o terminado
    winnerIndex: null, // segmento ganador, una vez que la ruleta frenó
    pointerKick: 0, // sacudida de la flecha cada vez que pasa un segmento
    destroyed: false,
  }

  const realSegments = () => (state.props?.tickets > 0 ? wheelSegmentCount(state.props.tickets) : 0)
  const spinning = () => Boolean(state.spin && !state.spin.done)

  function update(props) {
    const first = !state.props
    const previous = state.props
    state.props = props

    const mineTickets = props.mine?.tickets ?? []
    const ghost = props.mine?.pending && mineTickets.length === 0 ? 1 : 0
    const real = realSegments()
    const target = real + ghost
    const grew = target > state.target
    state.target = target

    if (first || reducedMotion) {
      state.display = target
    } else {
      if (grew) {
        state.kick = Math.min(state.kick + 0.9, 1.6)
        state.pulse = { index: Math.max(0, Math.ceil(target) - 1), value: 1 }
      }
      const hadGhost = previous?.mine?.pending && (previous.mine.tickets ?? []).length === 0
      if (ghost && !hadGhost) playDrop()
      if (mineTickets.length > (previous?.mine?.tickets?.length ?? 0)) {
        playConfirm()
        state.pulse = { index: segmentOfTicket(mineTickets[mineTickets.length - 1], props.tickets, real), value: 1.2 }
      }
    }
    if (reducedMotion) render()
  }

  // Gira `turns` vueltas y frena con la flecha sobre el segmento del ticket.
  // `onTick` se llama cuando la flecha pasa de un segmento al siguiente (para
  // hacer sonar un clic) y `onDone` cuando se detuvo.
  function spinTo({ ticket, tickets, durationMs, onTick, onDone }) {
    const { final, winning, segments } = wheelSpinTarget(state.rotation, ticket, tickets)
    const slots = Math.max(segments, MIN_TICK_SLOTS)
    state.spin = {
      from: state.rotation,
      delta: final - state.rotation,
      startedAt: performance.now() / 1000,
      duration: durationMs / 1000,
      segments,
      slots,
      lastSlot: segmentUnderPointer(state.rotation, slots),
      lastTick: 0,
      winning,
      ticket,
      onTick,
      onDone,
      done: false,
    }
    state.winnerIndex = null
  }

  function tickSpin() {
    const sp = state.spin
    if (sp.done) return
    const progress = Math.min(1, Math.max(0, (state.clock - sp.startedAt) / sp.duration))
    state.rotation = sp.from + sp.delta * easeOutQuart(progress)

    const slot = segmentUnderPointer(state.rotation, sp.slots)
    if (slot !== sp.lastSlot) {
      sp.lastSlot = slot
      if (state.clock - sp.lastTick > MIN_TICK_GAP) {
        sp.lastTick = state.clock
        sp.onTick?.()
        state.pointerKick = 1
      } else {
        state.pointerKick = Math.max(state.pointerKick, 0.6)
      }
    }

    if (progress >= 1) {
      sp.done = true
      state.rotation = sp.from + sp.delta
      state.winnerIndex = sp.winning
      state.pulse = { index: sp.winning, value: 1.4 }
      sp.onDone?.()
    }
  }

  function render() {
    const { width, height, dpr } = state
    if (!width) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)

    const cx = width / 2
    const cy = width * 0.53
    const radius = width * 0.39
    const t = state.time
    const display = state.display
    const props = state.props || { tickets: 0, mine: null }
    const real = realSegments()
    const mineTickets = props.mine?.tickets ?? []
    const ghost = props.mine?.pending && mineTickets.length === 0
    const mineSegments = new Set(mineTickets.map(ticket => segmentOfTicket(ticket, props.tickets, Math.max(real, 1))))
    const winnerIndex = state.winnerIndex
    const winnerPulse = 0.5 + 0.5 * Math.sin(t * 4)

    // Sombra y aro exterior
    ctx.fillStyle = 'rgba(0,0,0,0.35)'
    ctx.beginPath()
    ctx.ellipse(cx, cy + radius * 1.12, radius * 0.9, radius * 0.07, 0, 0, TAU)
    ctx.fill()

    const bezel = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius)
    bezel.addColorStop(0, '#4a4d52')
    bezel.addColorStop(0.5, '#25272b')
    bezel.addColorStop(1, '#3b3e43')
    ctx.fillStyle = bezel
    ctx.beginPath()
    ctx.arc(cx, cy, radius + width * 0.042, 0, TAU)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.14)'
    ctx.lineWidth = 1
    ctx.stroke()

    // Luces del aro: corren alrededor como en una ruleta de feria (más rápido al girar)
    for (let i = 0; i < STUDS; i++) {
      const angle = (i / STUDS) * TAU
      const glow = reducedMotion ? 0.6 : 0.5 + 0.5 * Math.sin(state.lights - i * 0.55)
      ctx.fillStyle = i % 2 === 0 ? `rgba(244,201,93,${0.35 + glow * 0.65})` : `rgba(247,242,232,${0.25 + glow * 0.5})`
      ctx.beginPath()
      ctx.arc(cx + Math.cos(angle) * (radius + width * 0.021), cy + Math.sin(angle) * (radius + width * 0.021), width * 0.0075, 0, TAU)
      ctx.fill()
    }

    // Segmentos (con el último creciendo mientras entra uno nuevo)
    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, radius, 0, TAU)
    ctx.clip()
    ctx.fillStyle = '#17181b'
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2)

    if (display > 0.01) {
      const full = Math.floor(display + 1e-6)
      const partial = display - full
      const arc = TAU / display
      const drawn = partial > 0.01 ? full + 1 : full
      const total = Math.max(1, Math.ceil(display))
      const start = state.rotation - Math.PI / 2

      for (let i = 0; i < drawn; i++) {
        const a0 = start + i * arc
        const a1 = start + (i < full ? (i + 1) * arc : i * arc + partial * arc)
        const isGhost = ghost && i === Math.ceil(state.target) - 1
        const isWinner = winnerIndex === i
        const isMine = !isGhost && mineSegments.has(i)

        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.arc(cx, cy, radius, a0, a1)
        ctx.closePath()
        ctx.fillStyle = isGhost ? 'rgba(244,201,93,0.28)' : isWinner || isMine ? MINE_COLOR : segmentColor(i, total)
        ctx.fill()
        if (winnerIndex !== null && !isWinner) {
          // Con el ganador a la vista, el resto se apaga.
          ctx.fillStyle = 'rgba(17,17,17,0.55)'
          ctx.fill()
        }
        if (isWinner) {
          ctx.fillStyle = `rgba(255,248,214,${0.1 + winnerPulse * 0.3})`
          ctx.fill()
        }
        if (state.pulse && state.pulse.index === i && state.pulse.value > 0) {
          ctx.fillStyle = `rgba(255,255,255,${Math.min(1, state.pulse.value) * 0.7})`
          ctx.fill()
        }
        ctx.strokeStyle = 'rgba(0,0,0,0.38)'
        ctx.lineWidth = 1
        ctx.stroke()
        if (isGhost) {
          ctx.save()
          ctx.setLineDash([5, 4])
          ctx.lineDashOffset = -t * 14
          ctx.strokeStyle = 'rgba(244,201,93,0.95)'
          ctx.lineWidth = 1.6
          ctx.stroke()
          ctx.restore()
        }
      }

      // Números de cada segmento (solo si entran)
      if (full <= 24 && partial < 0.01) {
        const labelRadius = radius * 0.9
        const fontSize = Math.max(9, Math.min(radius * 0.14, radius * arc * 0.34))
        ctx.textBaseline = 'middle'
        ctx.textAlign = 'right'
        for (let i = 0; i < full; i++) {
          const isGhost = ghost && i === Math.ceil(state.target) - 1
          let label
          if (isGhost) label = '?'
          else {
            const { start: from, end: to } = segmentRange(i, props.tickets, Math.max(real, 1))
            label = from === to ? String(from) : `${from}-${to}`
          }
          const mid = start + (i + 0.5) * arc
          const highlighted = mineSegments.has(i) || winnerIndex === i
          ctx.save()
          ctx.translate(cx, cy)
          ctx.rotate(mid)
          ctx.fillStyle = highlighted || isGhost ? 'rgba(26,29,22,0.95)' : 'rgba(20,24,12,0.72)'
          ctx.font = `${highlighted ? 800 : 600} ${fontSize}px ${fontFamily}`
          ctx.fillText(label, labelRadius, 0)
          ctx.restore()
        }
      }
    }

    // Volumen: sombreado hacia el borde y brillo
    const shade = ctx.createRadialGradient(cx, cy, radius * 0.25, cx, cy, radius)
    shade.addColorStop(0, 'rgba(255,255,255,0.1)')
    shade.addColorStop(0.7, 'rgba(0,0,0,0)')
    shade.addColorStop(1, 'rgba(0,0,0,0.38)')
    ctx.fillStyle = shade
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2)
    const sheen = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius * 0.3, cy + radius * 0.3)
    sheen.addColorStop(0, 'rgba(255,255,255,0.16)')
    sheen.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = sheen
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2)
    ctx.restore()

    // Centro: el total de oportunidades y, al frenar, el ticket ganador
    const hub = ctx.createRadialGradient(cx - radius * 0.05, cy - radius * 0.06, radius * 0.02, cx, cy, radius * 0.27)
    hub.addColorStop(0, '#3a3d42')
    hub.addColorStop(1, '#141517')
    ctx.fillStyle = hub
    ctx.beginPath()
    ctx.arc(cx, cy, radius * 0.27, 0, TAU)
    ctx.fill()
    ctx.save()
    if (winnerIndex !== null) {
      ctx.shadowColor = MINE_COLOR
      ctx.shadowBlur = 14 + winnerPulse * 12
    }
    ctx.strokeStyle = winnerIndex !== null ? MINE_COLOR : 'rgba(244,201,93,0.55)'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.restore()

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    if (winnerIndex !== null && state.spin) {
      const text = `#${state.spin.ticket}`
      ctx.fillStyle = MINE_COLOR
      ctx.font = `800 ${Math.round(radius * (text.length > 4 ? 0.15 : 0.2))}px ${fontFamily}`
      ctx.fillText(text, cx, cy - radius * 0.02)
      ctx.fillStyle = 'rgba(247,242,232,0.55)'
      ctx.font = `600 ${Math.max(7, Math.round(radius * 0.05))}px ${fontFamily}`
      ctx.fillText('GANADOR', cx, cy + radius * 0.13)
    } else {
      ctx.fillStyle = '#f7f2e8'
      ctx.font = `700 ${Math.round(radius * (props.tickets > 999 ? 0.17 : 0.22))}px ${fontFamily}`
      ctx.fillText(String(props.tickets), cx, cy - radius * 0.025)
      ctx.fillStyle = 'rgba(247,242,232,0.5)'
      ctx.font = `600 ${Math.max(7, Math.round(radius * 0.05))}px ${fontFamily}`
      ctx.fillText(props.tickets === 1 ? 'OPORTUNIDAD' : 'OPORTUNIDADES', cx, cy + radius * 0.13)
    }

    // Flecha fija arriba: se sacude cada vez que pasa un segmento
    const tipY = cy - radius - width * 0.006
    const flapHeight = width * 0.066
    ctx.save()
    ctx.translate(cx, tipY - flapHeight)
    ctx.rotate(-state.pointerKick * 0.5)
    ctx.shadowColor = 'rgba(0,0,0,0.5)'
    ctx.shadowBlur = 8
    ctx.shadowOffsetY = 3
    ctx.fillStyle = '#f7f2e8'
    ctx.beginPath()
    ctx.moveTo(0, flapHeight)
    ctx.lineTo(-width * 0.034, 0)
    ctx.lineTo(width * 0.034, 0)
    ctx.closePath()
    ctx.fill()
    ctx.shadowColor = 'transparent'
    ctx.strokeStyle = 'rgba(244,201,93,0.9)'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.restore()

    // Etiqueta con el nombre sobre el segmento de la persona
    if (display > 0.01 && (mineSegments.size > 0 || ghost)) {
      const arc = TAU / display
      const font = `600 12px ${fontFamily}`
      const indices = ghost ? [Math.ceil(state.target) - 1] : [...mineSegments]
      for (const index of indices) {
        const mid = state.rotation - Math.PI / 2 + (index + 0.5) * arc
        const x = cx + Math.cos(mid) * (radius + width * 0.075)
        const y = cy + Math.sin(mid) * (radius + width * 0.075)
        drawPill(ctx, font, ghost ? `${props.mine.name} · en revisión` : props.mine.name, x, y, { width, height }, {
          border: MINE_COLOR,
          color: '#f7f2e8',
        })
      }
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
    state.lights += dt * (spinning() ? 10 : 3.4)
    state.display += (state.target - state.display) * (1 - Math.exp(-dt * 5))
    if (Math.abs(state.target - state.display) < 0.004) state.display = state.target
    state.pointerKick *= Math.exp(-dt * 16)

    if (state.spin) {
      tickSpin()
    } else {
      state.kick *= Math.exp(-dt * 2.2)
      state.rotation += (IDLE_SPIN * (state.props?.spin ?? 1) + state.kick) * dt
    }

    if (state.pulse) {
      state.pulse.value -= dt * 1.6
      if (state.pulse.value <= 0) state.pulse = null
    }
    render()
  }

  return {
    update,
    spinTo,
    resize(cssWidth) {
      const width = Math.max(220, Math.min(520, Math.round(cssWidth)))
      const height = Math.round(width * 1.02)
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      if (width === state.width && dpr === state.dpr) return
      state.width = width
      state.height = height
      state.dpr = dpr
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
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
