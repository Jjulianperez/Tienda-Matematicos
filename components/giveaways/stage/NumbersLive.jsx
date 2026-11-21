'use client'

import { useState, useEffect, useRef } from 'react'
import { HiOutlineChevronLeft, HiOutlineChevronRight } from 'react-icons/hi2'
import {
  NUMBER_BLOCK_SIZE,
  ticketRanges,
  highestTicket,
  blockOfTicket,
  boardBlockCount,
  takenFlags,
  blockFill,
} from '@/lib/giveaways/stage'
import { playDrop, playConfirm } from '@/lib/giveaways/sound'

const MAX_STRIP_BLOCKS = 60 // con más bloques no se dibuja la barra de avance

// Un bloque de 100 números. Vive aparte para que, al cambiar de bloque, se
// vuelva a armar desde cero y los números se tachen en cascada. Después de ese
// primer momento, un número que se asigna se tacha solo, con un pequeño salto.
function Board({ block, flags, mineSet, ghostNumber }) {
  const [settled, setSettled] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setSettled(true), 1800)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="grid grid-cols-10 gap-1 sm:gap-1.5" role="presentation">
      {flags.map((taken, i) => {
        const number = block * NUMBER_BLOCK_SIZE + i + 1
        const mine = mineSet.has(number)
        const ghost = number === ghostNumber
        const cls = [
          'num-cell',
          taken && !mine ? 'num-cell--taken' : '',
          mine ? 'num-cell--mine' : '',
          mine && settled ? 'num-cell--arrive' : '',
          ghost ? 'num-cell--ghost' : '',
        ].join(' ')
        return (
          <span key={number} className={cls} style={settled ? undefined : { '--d': `${i * 14}ms` }}>
            {ghost ? '?' : number}
          </span>
        )
      })}
    </div>
  )
}

/**
 * Tablero de números: cada oportunidad asignada aparece tachada. Se muestra de
 * a 100 números; con más, se pasa de bloque con las flechas. El número de la
 * persona que mira se destaca en dorado.
 *
 * @param {object} props
 * @param {number} props.tickets oportunidades en total
 * @param {number[][] | null} props.ranges rangos [desde, hasta] de números asignados
 * @param {{name: string, tickets: number[], pending: boolean} | null} props.mine
 */
export default function NumbersLive({ tickets, ranges, mine }) {
  const taken = ticketRanges(ranges, tickets)
  const highest = highestTicket(taken)
  const mineTickets = mine?.tickets ?? []
  const pending = Boolean(mine?.pending) && mineTickets.length === 0
  const ghostNumber = pending ? highest + 1 : null

  const blocks = boardBlockCount(Math.max(highest, ghostNumber ?? 0))
  const autoBlock = mineTickets.length > 0 ? blockOfTicket(mineTickets[0]) : pending ? blockOfTicket(ghostNumber) : blockOfTicket(highest)
  const [chosen, setChosen] = useState(null)
  const block = Math.min(Math.max(chosen ?? autoBlock, 0), blocks - 1)

  // Sonido cuando aparece el número de la persona (no al abrir la página).
  const previous = useRef(null)
  useEffect(() => {
    const before = previous.current
    previous.current = { count: mineTickets.length, pending }
    if (!before) return
    if (mineTickets.length > before.count) playConfirm()
    else if (pending && !before.pending) playDrop()
  }, [mineTickets.length, pending])

  const flags = takenFlags(taken, block)
  const mineSet = new Set(mineTickets)
  const start = block * NUMBER_BLOCK_SIZE + 1
  const mineBlock = mineTickets.length > 0 ? blockOfTicket(mineTickets[0]) : null

  return (
    <div className="mx-auto w-full max-w-[460px]" aria-hidden="true">
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setChosen(Math.max(0, block - 1))}
          disabled={block === 0}
          className="rounded-lg p-2 text-white/60 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-30"
          aria-label="Bloque anterior"
          tabIndex={-1}
        >
          <HiOutlineChevronLeft size={18} />
        </button>
        <p className="text-center text-xs uppercase tracking-widest text-white/50">
          Números {start}–{start + NUMBER_BLOCK_SIZE - 1}
          {blocks > 1 && <span className="text-white/30"> · bloque {block + 1} de {blocks}</span>}
        </p>
        <button
          type="button"
          onClick={() => setChosen(Math.min(blocks - 1, block + 1))}
          disabled={block >= blocks - 1}
          className="rounded-lg p-2 text-white/60 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-30"
          aria-label="Bloque siguiente"
          tabIndex={-1}
        >
          <HiOutlineChevronRight size={18} />
        </button>
      </div>

      <Board key={block} block={block} flags={flags} mineSet={mineSet} ghostNumber={ghostNumber} />

      {blocks > 1 && blocks <= MAX_STRIP_BLOCKS && (
        <div className="mt-4 flex gap-1" role="presentation">
          {Array.from({ length: blocks }, (_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setChosen(i)}
              tabIndex={-1}
              aria-label={`Ir al bloque ${i + 1}`}
              className={`relative h-2 flex-1 overflow-hidden rounded-full bg-white/10 ${i === block ? 'ring-1 ring-white/60' : ''}`}
            >
              <span
                className="absolute inset-y-0 left-0 bg-primary-light/70"
                style={{ width: `${blockFill(taken, i)}%` }}
              />
            </button>
          ))}
        </div>
      )}

      {mineBlock !== null && mineBlock !== block && (
        <button type="button" onClick={() => setChosen(mineBlock)} className="btn-outline mt-4 w-full" tabIndex={-1}>
          Ir a mi número (#{mineTickets[0]})
        </button>
      )}
    </div>
  )
}
