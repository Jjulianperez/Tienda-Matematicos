'use client'

import { useEffect, useRef } from 'react'
import { createWheelEngine } from '@/components/giveaways/stage/wheelEngine'
import { useEngine } from '@/components/giveaways/stage/useEngine'

/**
 * Ruleta con un segmento por oportunidad (hasta 36; con más, cada segmento es
 * un rango de oportunidades). Gira despacio; cuando entra alguien el segmento
 * nuevo crece y se hace lugar. El de la persona que mira es dorado y lleva su
 * nombre. El dibujo y la animación están en wheelEngine.js.
 *
 * @param {object} props
 * @param {number} props.tickets oportunidades en total
 * @param {{name: string, tickets: number[], pending: boolean} | null} props.mine
 * @param {number} props.spin multiplicador de la velocidad de giro (0 = quieta)
 * @param {boolean} props.reducedMotion dibuja una imagen quieta
 */
export default function WheelLive({ tickets, mine, spin = 1, reducedMotion = false }) {
  const latest = useRef({ tickets, mine, spin })
  const mineKey = mine ? `${mine.name}|${mine.tickets.join(',')}|${mine.pending ? 1 : 0}` : ''

  useEffect(() => {
    latest.current = { tickets, mine, spin }
  })

  const { wrapRef, canvasRef, engineRef } = useEngine(createWheelEngine, {
    reducedMotion,
    init: engine => engine.update(latest.current),
  })

  useEffect(() => {
    engineRef.current?.update(latest.current)
  }, [tickets, mineKey, spin, engineRef])

  return (
    <div ref={wrapRef} className="mx-auto w-full max-w-[520px]" aria-hidden="true">
      <canvas ref={canvasRef} className="mx-auto block" />
    </div>
  )
}
