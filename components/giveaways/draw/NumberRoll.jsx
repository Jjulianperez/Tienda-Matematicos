'use client'

import { useState, useEffect } from 'react'
import { numberBlock, rollDelays } from '@/lib/giveaways/stage'

// Vista de números: un contador que cambia cada vez más despacio hasta frenar
// en el ticket ganador, y debajo el bloque de 100 números que lo contiene (con
// miles de tickets no se dibuja una grilla entera). Los números intermedios son
// solo decoración; el final es el ticket que decidió el servidor.
export default function NumberRoll({ ticketNumber, totalTickets, spinMs }) {
  const block = numberBlock(ticketNumber, totalTickets)
  const [value, setValue] = useState(block.start)
  const [lit, setLit] = useState(-1)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const delays = rollDelays(spinMs)
    const total = Math.max(totalTickets, 1)
    let index = 0
    let timer

    const tick = () => {
      if (index >= delays.length - 1) {
        setValue(ticketNumber)
        setLit(block.offset)
        setDone(true)
        return
      }
      setValue(1 + Math.floor(Math.random() * total))
      setLit(Math.floor(Math.random() * block.count))
      timer = setTimeout(tick, delays[index])
      index += 1
    }

    // Se arranca con un timeout (no en línea) para no cambiar estado de forma
    // sincrónica dentro del efecto.
    timer = setTimeout(tick, 0)
    return () => clearTimeout(timer)
  }, [ticketNumber, totalTickets, spinMs, block.count, block.offset])

  const width = String(Math.max(totalTickets, 1)).length

  return (
    <div className="mx-auto max-w-[15rem] text-center" aria-hidden="true">
      <div
        className={`font-mono text-5xl sm:text-6xl font-bold tabular-nums transition-colors duration-500 ${
          done ? 'text-primary-light' : 'text-white/80'
        }`}
      >
        {String(value).padStart(width, '0')}
      </div>

      <p className="mt-4 mb-2 text-xs uppercase tracking-widest text-white/40">
        Bloque {block.start}–{block.end}
      </p>
      <div className="grid grid-cols-10 gap-1">
        {Array.from({ length: block.count }, (_, i) => (
          <span
            key={i}
            className={`aspect-square rounded-sm transition-colors duration-150 ${
              i === lit
                ? done ? 'bg-primary-light' : 'bg-white/70'
                : done ? 'bg-white/5' : 'bg-white/10'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
