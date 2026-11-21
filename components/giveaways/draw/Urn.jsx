'use client'

import { useEffect, useRef } from 'react'
import { createUrnEngine } from '@/components/giveaways/stage/urnEngine'
import { useEngine } from '@/components/giveaways/stage/useEngine'
import { playRumble } from '@/lib/giveaways/sound'

/**
 * Urna de la revelación: la misma urna de vidrio con esferas de la escena en
 * vivo. Las esferas se mezclan con fuerza (con un redoble de fondo) y, al
 * final, la del ticket ganador se separa, sube al centro, crece y se vuelve
 * dorada con su número. El ticket ya lo decidió el servidor; acá solo se
 * presenta. Con hasta 150 oportunidades cada esfera lleva su número; con más se
 * dibujan 150 y una de ellas hace de ganadora.
 *
 * @param {object} props
 * @param {number} props.ticketNumber ticket ganador
 * @param {number} props.totalTickets oportunidades en total
 * @param {number} props.spinMs duración de la mezcla
 * @param {number[]} [props.drawn] tickets de ganadores anteriores: sus esferas ya salieron
 */
export default function Urn({ ticketNumber, totalTickets, spinMs, drawn = [] }) {
  const latest = useRef({ ticketNumber, totalTickets, spinMs, drawn })

  useEffect(() => {
    latest.current = { ticketNumber, totalTickets, spinMs, drawn }
  })

  const { wrapRef, canvasRef } = useEngine(createUrnEngine, {
    init: engine => {
      const { ticketNumber, totalTickets, spinMs, drawn } = latest.current
      engine.update({ tickets: Math.max(totalTickets, 1), excluded: drawn, mine: null, jet: 1 })
      engine.reveal({ ticket: ticketNumber, durationMs: spinMs })
    },
  })

  // Redoble mientras mezcla; al saltar o cerrar, se corta.
  useEffect(() => playRumble(spinMs * 0.8), [spinMs])

  return (
    <div ref={wrapRef} className="mx-auto w-full max-w-[320px] sm:max-w-[380px]" aria-hidden="true">
      <canvas ref={canvasRef} className="mx-auto block" />
    </div>
  )
}
