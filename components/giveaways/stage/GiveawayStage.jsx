'use client'

import { useState, useEffect, useRef } from 'react'
import { HiOutlineUserGroup, HiOutlineTicket, HiOutlineClock } from 'react-icons/hi2'
import UrnLive from '@/components/giveaways/stage/UrnLive'
import WheelLive from '@/components/giveaways/stage/WheelLive'
import NumbersLive from '@/components/giveaways/stage/NumbersLive'
import { formatCountdown } from '@/lib/giveaways/stage'
import { usePrefersReducedMotion } from '@/lib/giveaways/useReducedMotion'

// Cuánto se mueve la escena según el estado del sorteo: mientras se espera el
// resultado se mezcla más fuerte; ya terminado, queda tranquila.
const MOTION = {
  draft: { jet: 0.6, spin: 0.8 },
  scheduled: { jet: 0.6, spin: 0.8 },
  active: { jet: 1, spin: 1 },
  closing: { jet: 0.8, spin: 0.9 },
  ready: { jet: 1, spin: 2 },
  drawing: { jet: 1, spin: 2.4 },
  completed: { jet: 0.35, spin: 0.35 },
}

const MINE_TEXT = {
  urna: { label: 'Tu esfera', pending: 'Tu esfera está en revisión' },
  ruleta: { label: 'Tu lugar en la ruleta', pending: 'Tu lugar está en revisión' },
  numeros: { label: 'Tu número', pending: 'Tu número se asigna al aprobarse' },
}

// Hora actual, refrescada cada segundo. Es null hasta que la página se monta,
// así no se dibuja un reloj distinto en el servidor y en el navegador.
function useNow(active) {
  const [now, setNow] = useState(null)
  useEffect(() => {
    if (!active) return
    const tick = () => setNow(Date.now())
    const first = setTimeout(tick, 0)
    const timer = setInterval(tick, 1000)
    return () => {
      clearTimeout(first)
      clearInterval(timer)
    }
  }, [active])
  return now
}

// Número que sube o baja contando, en vez de saltar.
function AnimatedNumber({ value, reducedMotion }) {
  const [shown, setShown] = useState(value)
  const current = useRef(value)

  useEffect(() => {
    if (reducedMotion) return
    const from = current.current
    const startedAt = performance.now()
    let frame = 0
    const tick = now => {
      const progress = Math.min(1, (now - startedAt) / 700)
      const eased = 1 - (1 - progress) ** 3
      current.current = Math.round(from + (value - from) * eased)
      setShown(current.current)
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value, reducedMotion])

  return <>{(reducedMotion ? value : shown).toLocaleString('es-AR')}</>
}

function Chip({ icon: Icon, children, tone = 'default' }) {
  const tones = {
    default: 'border-white/10 bg-white/5 text-white/80',
    warn: 'border-amber-300/40 bg-amber-300/10 text-amber-200',
  }
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm ${tones[tone]}`}>
      <Icon size={16} className="shrink-0 opacity-70" />
      {children}
    </span>
  )
}

function mineSummary(format, mine) {
  const text = MINE_TEXT[format] || MINE_TEXT.urna
  if (!mine) return null
  if (mine.tickets.length === 0) return mine.pending ? text.pending : null
  const numbers = mine.tickets.map(n => `#${n}`).join(' y ')
  return `${text.label}: ${numbers}`
}

/**
 * Escena del sorteo: una urna con esferas, una ruleta o un tablero de números,
 * según el formato, con la cantidad de personas, la cuenta regresiva y, si hay
 * una persona mirando, su lugar destacado. Se actualiza sola cuando cambian los
 * datos que recibe (la página los refresca cada pocos segundos).
 *
 * Solo muestra datos agregados: el único nombre que aparece es el de la persona
 * que está mirando (lo conoce porque guardó su comprobante en este navegador).
 *
 * @param {object} props
 * @param {'urna'|'ruleta'|'numeros'} props.format
 * @param {string} props.status estado del sorteo
 * @param {number|null} props.participants personas con al menos una oportunidad (null si no se sabe)
 * @param {number} props.tickets oportunidades en total
 * @param {number[][]|null} props.ranges rangos de números asignados (formato números)
 * @param {{name: string, tickets: number[], pending: boolean}|null} props.mine
 * @param {boolean} props.celebrate si es true, la esfera de la persona entra con una animación al abrir
 * @param {string} props.startsAt
 * @param {string} props.endsAt
 * @param {'lg'|'md'} props.size
 * @param {React.ReactNode} props.children se muestra debajo (por ejemplo, el botón de revelar)
 */
export default function GiveawayStage({
  format,
  status,
  participants,
  tickets,
  ranges = null,
  mine = null,
  celebrate = false,
  startsAt,
  endsAt,
  size = 'lg',
  children,
}) {
  const reducedMotion = usePrefersReducedMotion()
  const motion = MOTION[status] || MOTION.active
  const [mineReady, setMineReady] = useState(!celebrate)

  // Con `celebrate`, la esfera de la persona entra un instante después de abrir
  // la página, para que se vea caer.
  useEffect(() => {
    if (!celebrate) return
    const timer = setTimeout(() => setMineReady(true), 1100)
    return () => clearTimeout(timer)
  }, [celebrate])

  const shownMine = mineReady ? mine : null

  const needsClock = status === 'scheduled' || status === 'active'
  const now = useNow(needsClock)
  const target = status === 'scheduled' ? startsAt : endsAt
  const remaining = needsClock && now !== null && target ? new Date(target).getTime() - now : null

  const empty = tickets === 0 && !shownMine
  const summary = mineSummary(format, shownMine)
  const maxWidth = size === 'md' ? 'max-w-[380px]' : 'max-w-[520px]'

  return (
    <div>
      <div className={`relative mx-auto w-full ${maxWidth}`}>
        {format === 'ruleta' ? (
          <WheelLive tickets={tickets} mine={shownMine} spin={motion.spin} reducedMotion={reducedMotion} />
        ) : format === 'numeros' ? (
          <NumbersLive tickets={tickets} ranges={ranges} mine={shownMine} />
        ) : (
          <UrnLive tickets={tickets} mine={shownMine} jet={motion.jet} reducedMotion={reducedMotion} />
        )}

        {empty && (
          <p className="pointer-events-none absolute inset-x-0 top-[44%] -translate-y-1/2 px-10 text-center text-sm text-white/55 text-balance">
            {status === 'active' ? 'Todavía no hay nadie. Sé el primero en participar.' : 'Acá van a aparecer las participaciones.'}
          </p>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
        {participants !== null && participants !== undefined && (
          <Chip icon={HiOutlineUserGroup}>
            <span>
              <strong className="font-semibold text-white"><AnimatedNumber value={participants} reducedMotion={reducedMotion} /></strong>{' '}
              {participants === 1 ? 'persona participando' : 'personas participando'}
            </span>
          </Chip>
        )}
        <Chip icon={HiOutlineTicket}>
          <span>
            <strong className="font-semibold text-white"><AnimatedNumber value={tickets} reducedMotion={reducedMotion} /></strong>{' '}
            {tickets === 1 ? 'oportunidad' : 'oportunidades'}
          </span>
        </Chip>
        {remaining !== null && (
          <Chip icon={HiOutlineClock} tone={status === 'active' && remaining < 3600_000 ? 'warn' : 'default'}>
            <span>
              {remaining <= 0
                ? status === 'scheduled' ? 'Abriendo...' : 'Cerrando...'
                : <>{status === 'scheduled' ? 'Abre en' : 'Cierra en'} <strong className="font-semibold tabular-nums text-white">{formatCountdown(remaining)}</strong></>}
            </span>
          </Chip>
        )}
        {status === 'closing' && <Chip icon={HiOutlineClock}>Inscripción cerrada</Chip>}
      </div>

      {summary && (
        <p className="mx-auto mt-4 flex max-w-md items-center justify-center gap-2.5 text-center text-sm text-amber-200">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#f4c95d] shadow-[0_0_10px_#f4c95d]" aria-hidden="true" />
          {shownMine?.name && <span className="text-white/70">{shownMine.name} ·</span>}
          {summary}
        </p>
      )}

      {/* Lo que no ven quienes usan lector de pantalla: la escena es solo visual. */}
      <p className="sr-only" role="status">
        {participants !== null && participants !== undefined ? `${participants} personas participando con ` : ''}
        {tickets} {tickets === 1 ? 'oportunidad' : 'oportunidades'} en total.
        {summary ? ` ${summary}.` : ''}
      </p>

      {children}
    </div>
  )
}
