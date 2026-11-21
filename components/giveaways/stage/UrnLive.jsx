'use client'

import { useEffect, useRef } from 'react'
import { createUrnEngine } from '@/components/giveaways/stage/urnEngine'
import { useEngine } from '@/components/giveaways/stage/useEngine'

/**
 * Urna de vidrio con una esfera por oportunidad. Las esferas se mezclan con un
 * chorro de aire; cuando llega una nueva cae desde arriba. Cada esfera es una
 * oportunidad ya asignada (con muchas, se dibujan hasta 150 para que corra
 * bien en un celular). La de la persona que mira es dorada y lleva su nombre.
 * El dibujo y la simulación están en urnEngine.js.
 *
 * @param {object} props
 * @param {number} props.tickets oportunidades en total
 * @param {{name: string, tickets: number[], pending: boolean} | null} props.mine
 * @param {number} props.jet intensidad de la mezcla (0 = quieta, 1 = mezclando)
 * @param {boolean} props.reducedMotion dibuja una imagen quieta
 */
export default function UrnLive({ tickets, mine, jet = 1, reducedMotion = false }) {
  const latest = useRef({ tickets, mine, jet })

  // Valor para detectar cambios en lo de la persona sin depender de la identidad del objeto.
  const mineKey = mine ? `${mine.name}|${mine.tickets.join(',')}|${mine.pending ? 1 : 0}` : ''

  useEffect(() => {
    latest.current = { tickets, mine, jet }
  })

  const { wrapRef, canvasRef, engineRef } = useEngine(createUrnEngine, {
    reducedMotion,
    init: engine => engine.update(latest.current),
  })

  useEffect(() => {
    engineRef.current?.update(latest.current)
  }, [tickets, mineKey, jet, engineRef])

  return (
    <div ref={wrapRef} className="mx-auto w-full max-w-[520px]" aria-hidden="true">
      <canvas ref={canvasRef} className="mx-auto block" />
    </div>
  )
}
