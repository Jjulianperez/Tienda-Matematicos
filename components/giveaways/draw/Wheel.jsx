'use client'

import { motion } from 'framer-motion'
import {
  wheelSegmentCount,
  segmentOfTicket,
  segmentRange,
  wheelTargetRotation,
} from '@/lib/giveaways/stage'

const CENTER = 100
const RADIUS = 92

// Punto del círculo a `angle` grados desde arriba, en sentido horario.
function point(radius, angle) {
  const rad = (angle * Math.PI) / 180
  return [CENTER + radius * Math.sin(rad), CENTER - radius * Math.cos(rad)]
}

function segmentPath(index, arc) {
  const [x0, y0] = point(RADIUS, index * arc)
  const [x1, y1] = point(RADIUS, (index + 1) * arc)
  return `M${CENTER} ${CENTER} L${x0} ${y0} A${RADIUS} ${RADIUS} 0 ${arc > 180 ? 1 : 0} 1 ${x1} ${y1} Z`
}

// Ruleta. Con muchos tickets, cada segmento representa un rango (no se dibuja
// un ticket por segmento). La rotación final se calcula para frenar justo sobre
// el segmento del ticket ganador, que ya fue decidido por el servidor.
export default function Wheel({ ticketNumber, totalTickets, spinMs, revealed }) {
  const segments = wheelSegmentCount(totalTickets)
  const winning = segmentOfTicket(ticketNumber, totalTickets, segments)
  const arc = 360 / segments
  const target = wheelTargetRotation(winning, segments, ticketNumber)
  const showLabels = segments <= 24

  return (
    <div className="relative mx-auto w-72 h-72 sm:w-80 sm:h-80" aria-hidden="true">
      {/* Flecha fija arriba */}
      <div
        className="absolute left-1/2 -top-1 z-10 -translate-x-1/2"
        style={{
          width: 0,
          height: 0,
          borderLeft: '10px solid transparent',
          borderRight: '10px solid transparent',
          borderTop: '18px solid #c9db9f',
        }}
      />
      <motion.svg
        viewBox="0 0 200 200"
        className="w-full h-full drop-shadow-lg"
        initial={{ rotate: 0 }}
        animate={{ rotate: target }}
        transition={{ duration: spinMs / 1000, ease: [0.12, 0.7, 0.14, 1] }}
      >
        <circle cx={CENTER} cy={CENTER} r={RADIUS + 4} fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.18)" />
        {segments === 1 ? (
          <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="rgba(148,168,106,0.35)" />
        ) : (
          Array.from({ length: segments }, (_, i) => {
            const isWinner = revealed && i === winning
            return (
              <path
                key={i}
                d={segmentPath(i, arc)}
                fill={isWinner ? 'rgba(148,168,106,0.85)' : i % 2 === 0 ? 'rgba(148,168,106,0.28)' : 'rgba(255,255,255,0.07)'}
                stroke="rgba(255,255,255,0.18)"
                strokeWidth="0.6"
              />
            )
          })
        )}
        {showLabels &&
          Array.from({ length: segments }, (_, i) => {
            const { start, end } = segmentRange(i, totalTickets, segments)
            const mid = (i + 0.5) * arc
            return (
              <text
                key={i}
                x={CENTER}
                y={CENTER - 62}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="6.5"
                fill="rgba(255,255,255,0.75)"
                transform={`rotate(${mid} ${CENTER} ${CENTER})`}
              >
                {start === end ? start : `${start}-${end}`}
              </text>
            )
          })}
        <circle cx={CENTER} cy={CENTER} r="9" fill="#1a1d16" stroke="rgba(255,255,255,0.3)" />
      </motion.svg>
    </div>
  )
}
