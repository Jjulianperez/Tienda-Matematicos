'use client'

import { useState, useEffect } from 'react'
import { NUMBER_BLOCK_SIZE, rollDelays } from '@/lib/giveaways/stage'
import { playTick, scheduleTicks } from '@/lib/giveaways/sound'

const FACE_HEIGHT = 64 // alto de cada cara del tambor, en píxeles
const DRUM_WIDTH = 50
const FACES = 10
// Radio del cilindro para que las 10 caras (una por dígito) queden pegadas.
const RADIUS = Math.round(FACE_HEIGHT / 2 / Math.tan(Math.PI / FACES))

// Un tambor 3D con los dígitos del 0 al 9 en un cilindro. Gira varias vueltas y
// frena con el dígito pedido de frente. El movimiento es una transición CSS (la
// hace el navegador) con una curva que arranca rápido y frena de a poco.
function Drum({ digit, durationMs, extraTurns, go, revealed }) {
  const angle = -(digit * (360 / FACES)) - 360 * extraTurns
  return (
    <div
      className={`relative overflow-hidden rounded-xl border bg-[#0d0e0f] transition-[border-color,box-shadow] duration-500 ${
        revealed
          ? 'border-[#f4c95d] shadow-[0_0_30px_rgba(244,201,93,0.55)]'
          : 'border-white/15 shadow-[inset_0_0_18px_rgba(0,0,0,0.85)]'
      }`}
      style={{ width: DRUM_WIDTH, height: FACE_HEIGHT * 1.9, perspective: 520 }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: '50%',
          height: FACE_HEIGHT,
          marginTop: -FACE_HEIGHT / 2,
          transformStyle: 'preserve-3d',
          transform: `translateZ(${-RADIUS}px) rotateX(${go ? angle : 0}deg)`,
          transition: go ? `transform ${durationMs}ms cubic-bezier(0.12, 0.75, 0.16, 1)` : 'none',
        }}
      >
        {Array.from({ length: FACES }, (_, i) => (
          <div
            key={i}
            className="font-display text-4xl font-bold tabular-nums text-white"
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(180deg, #34373c 0%, #1b1c1f 50%, #34373c 100%)',
              transform: `rotateX(${i * (360 / FACES)}deg) translateZ(${RADIUS}px)`,
              backfaceVisibility: 'hidden',
            }}
          >
            {i}
          </div>
        ))}
      </div>
      {/* Sombra arriba y abajo: el cilindro se curva y se aleja */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'linear-gradient(180deg, rgba(10,10,10,0.96) 0%, rgba(10,10,10,0) 32%, rgba(10,10,10,0) 68%, rgba(10,10,10,0.96) 100%)' }}
      />
      <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 border-y border-white/10" style={{ height: FACE_HEIGHT }} />
    </div>
  )
}

// Un bloque de 100 números: los asignados están tachados. Mientras giran los
// tambores, una luz salta de número en número; al terminar, el del ganador se
// destaca en dorado.
function RevealBoard({ ticket, total, spinMs, revealed }) {
  const block = Math.floor((ticket - 1) / NUMBER_BLOCK_SIZE)
  const start = block * NUMBER_BLOCK_SIZE + 1
  const [scan, setScan] = useState(-1)

  useEffect(() => {
    if (revealed) return
    const delays = rollDelays(spinMs)
    let index = 0
    let timer
    const tick = () => {
      setScan(Math.floor(Math.random() * NUMBER_BLOCK_SIZE))
      if (index < delays.length) {
        timer = setTimeout(tick, delays[index])
        index += 1
      }
    }
    timer = setTimeout(tick, 0)
    return () => clearTimeout(timer)
  }, [revealed, spinMs])

  return (
    <div className="grid grid-cols-10 gap-1 sm:gap-1.5">
      {Array.from({ length: NUMBER_BLOCK_SIZE }, (_, i) => {
        const number = start + i
        const isWinner = number === ticket
        const taken = number <= Math.max(total, ticket)
        const cls = [
          'num-cell',
          taken && !(isWinner && revealed) ? 'num-cell--taken' : '',
          isWinner && revealed ? 'num-cell--mine num-cell--arrive' : '',
          !revealed && scan === i ? 'num-cell--scan' : '',
        ].join(' ')
        return (
          <span key={number} className={cls} style={{ '--d': `${i * 12}ms` }}>
            {number}
          </span>
        )
      })}
    </div>
  )
}

/**
 * Revelación en el formato de números: tambores 3D que giran y frenan, de
 * izquierda a derecha, en las cifras del ticket ganador, y debajo el bloque de
 * 100 números que lo contiene. Los números del medio son decoración; el final
 * es el ticket que decidió el servidor.
 *
 * @param {object} props
 * @param {number} props.ticketNumber ticket ganador
 * @param {number} props.totalTickets oportunidades en total
 * @param {number} props.spinMs duración del giro
 * @param {boolean} props.revealed true cuando termina el giro y se muestra al ganador
 */
export default function NumberRoll({ ticketNumber, totalTickets, spinMs, revealed }) {
  const digitCount = String(Math.max(totalTickets, ticketNumber)).length
  const digits = String(ticketNumber).padStart(digitCount, '0').split('').map(Number)
  const [go, setGo] = useState(false)

  // Los tambores se quedan quietos un instante y después arrancan: así el
  // navegador anima el cambio de ángulo en vez de saltar directo al final.
  useEffect(() => {
    const timer = setTimeout(() => setGo(true), 60)
    return () => clearTimeout(timer)
  }, [])

  // Sonido: clics que se espacian mientras giran y un golpe seco cuando frena cada tambor.
  useEffect(() => {
    const stopTicks = scheduleTicks(rollDelays(spinMs), 0.8)
    const stops = digits.map((_, i) =>
      setTimeout(() => playTick(2.6), 60 + spinMs * (0.6 + 0.4 * (digitCount === 1 ? 1 : i / (digitCount - 1))))
    )
    return () => {
      stopTicks()
      stops.forEach(clearTimeout)
    }
    // digits depende solo de ticketNumber y totalTickets.
  }, [spinMs, digitCount, ticketNumber, totalTickets]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mx-auto w-full max-w-[15rem] text-center sm:max-w-[20rem]" aria-hidden="true">
      <div className="flex items-center justify-center gap-2 sm:gap-2.5" style={{ perspective: 900 }}>
        {digits.map((digit, i) => (
          <Drum
            key={i}
            digit={digit}
            go={go}
            revealed={revealed}
            extraTurns={2 + i}
            durationMs={Math.round(spinMs * (0.6 + 0.4 * (digitCount === 1 ? 1 : i / (digitCount - 1))))}
          />
        ))}
      </div>

      <p className="mb-2 mt-5 text-xs uppercase tracking-widest text-white/40">
        Números {Math.floor((ticketNumber - 1) / NUMBER_BLOCK_SIZE) * NUMBER_BLOCK_SIZE + 1}–
        {(Math.floor((ticketNumber - 1) / NUMBER_BLOCK_SIZE) + 1) * NUMBER_BLOCK_SIZE}
      </p>
      <RevealBoard ticket={ticketNumber} total={totalTickets} spinMs={spinMs} revealed={revealed} />
    </div>
  )
}
