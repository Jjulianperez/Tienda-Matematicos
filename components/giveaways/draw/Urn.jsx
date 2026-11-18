'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'

const SIZE = 288
const BALLS = 90
const COLORS = ['#94a86a', '#c9db9f', '#d7b98e', '#75aadb', '#dcb06e', '#a5c9e8']

// Generador pseudoaleatorio determinista: las bolillas ocupan siempre los
// mismos lugares, así el dibujo no cambia entre renderizados.
function seeded(seed) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function buildBalls() {
  const rand = seeded(20260101)
  return Array.from({ length: BALLS }, (_, i) => {
    const size = 14 + Math.floor(rand() * 8)
    const span = SIZE - size
    const pick = () => Math.floor(rand() * span)
    return {
      id: i,
      size,
      color: COLORS[i % COLORS.length],
      xs: [pick(), pick(), pick(), pick()],
      ys: [pick(), pick(), pick(), pick()],
      duration: 1.1 + rand() * 1.3,
      // Posición de reposo: apiladas en el fondo.
      rest: { x: Math.floor(rand() * span), y: span - Math.floor(rand() * 60) },
    }
  })
}

// Urna: las bolillas se mezclan mientras corre la animación y, al terminar, el
// ticket ganador aparece al frente. Son 90 elementos (no uno por ticket): con
// miles de participantes dibujar todo sería inviable en un celular.
export default function Urn({ ticketNumber, running }) {
  const balls = useMemo(() => buildBalls(), [])

  return (
    <div
      className="relative mx-auto overflow-hidden rounded-full border border-white/20 bg-white/5"
      style={{ width: SIZE, height: SIZE, maxWidth: '100%' }}
      aria-hidden="true"
    >
      {balls.map(ball => (
        <motion.span
          key={ball.id}
          className="absolute left-0 top-0 rounded-full"
          style={{ width: ball.size, height: ball.size, background: ball.color, opacity: 0.85 }}
          initial={{ x: ball.xs[0], y: ball.ys[0] }}
          animate={running ? { x: ball.xs, y: ball.ys } : { x: ball.rest.x, y: ball.rest.y }}
          transition={
            running
              ? { duration: ball.duration, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }
              : { duration: 0.9, ease: 'easeOut' }
          }
        />
      ))}

      {!running && (
        <motion.div
          className="absolute left-1/2 top-1/2 flex h-28 w-28 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-primary-light bg-carbon font-display text-2xl font-bold text-primary-light shadow-xl"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 160, damping: 14 }}
        >
          #{ticketNumber}
        </motion.div>
      )}
    </div>
  )
}
