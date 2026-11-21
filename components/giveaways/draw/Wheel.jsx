'use client'

import { useEffect, useRef } from 'react'
import { createWheelEngine } from '@/components/giveaways/stage/wheelEngine'
import { useEngine } from '@/components/giveaways/stage/useEngine'
import { playTick } from '@/lib/giveaways/sound'

/**
 * Ruleta de la revelación: la misma ruleta con volumen de la escena en vivo
 * (aro con luces, segmentos sombreados, flecha que se sacude), pero girando
 * rápido y frenando con la flecha sobre el segmento del ticket ganador, que ya
 * decidió el servidor. Suena un clic cada vez que la flecha pasa un segmento.
 * Con muchos tickets, cada segmento representa un rango.
 *
 * @param {object} props
 * @param {number} props.ticketNumber ticket ganador
 * @param {number} props.totalTickets oportunidades en total
 * @param {number} props.spinMs duración del giro
 */
export default function Wheel({ ticketNumber, totalTickets, spinMs }) {
  const latest = useRef({ ticketNumber, totalTickets, spinMs })

  useEffect(() => {
    latest.current = { ticketNumber, totalTickets, spinMs }
  })

  const { wrapRef, canvasRef } = useEngine(createWheelEngine, {
    init: engine => {
      const { ticketNumber, totalTickets, spinMs } = latest.current
      engine.update({ tickets: Math.max(totalTickets, 1), mine: null, spin: 0.6 })
      engine.spinTo({
        ticket: ticketNumber,
        tickets: Math.max(totalTickets, 1),
        durationMs: spinMs,
        onTick: () => playTick(),
      })
    },
  })

  return (
    <div ref={wrapRef} className="mx-auto w-full max-w-[320px] sm:max-w-[380px]" aria-hidden="true">
      <canvas ref={canvasRef} className="mx-auto block" />
    </div>
  )
}
