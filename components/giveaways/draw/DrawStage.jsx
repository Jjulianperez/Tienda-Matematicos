'use client'

import { useState, useEffect, useSyncExternalStore } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { HiOutlineSpeakerWave, HiOutlineSpeakerXMark } from 'react-icons/hi2'
import FormModal from '@/components/admin/FormModal'
import Wheel from '@/components/giveaways/draw/Wheel'
import Urn from '@/components/giveaways/draw/Urn'
import NumberRoll from '@/components/giveaways/draw/NumberRoll'
import { spinDurationMs } from '@/lib/giveaways/stage'
import { launchConfetti } from '@/lib/giveaways/confetti'
import {
  isSoundMuted,
  setSoundMuted,
  subscribeSound,
  unlockAudio,
  playWinner,
} from '@/lib/giveaways/sound'
import { usePrefersReducedMotion } from '@/lib/giveaways/useReducedMotion'

// Margen después de que termina el giro, antes de mostrar al ganador.
const SETTLE_MS = 400

function ResultList({ winners, alternates }) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-3">
          {winners.length === 1 ? 'Ganador' : 'Ganadores'}
        </h3>
        <ol className="space-y-2">
          {winners.map(w => (
            <li key={`${w.role}-${w.position}`} className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/5 p-4">
              <span className="font-medium text-white">{w.position}. {w.name}</span>
              <span className="text-xs text-primary-light">Ticket #{w.ticket_number}</span>
            </li>
          ))}
        </ol>
      </div>
      {alternates.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-3">Suplentes, en orden</h3>
          <ol className="space-y-1.5">
            {alternates.map(w => (
              <li key={`${w.role}-${w.position}`} className="flex items-center justify-between gap-3 px-1 text-sm text-white/70">
                <span>{w.position}. {w.name}</span>
                <span className="text-xs text-white/40">Ticket #{w.ticket_number}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}

/**
 * Presenta un sorteo YA realizado, ganador por ganador, en uno de los tres
 * formatos (ruleta, urna o números). No decide nada: recibe el resultado que
 * calculó y guardó el servidor y hace que la animación termine en ese ticket.
 *
 * Con "reducir movimiento" activado en el sistema, o si se toca "Saltar", se
 * muestra directamente el resultado completo.
 *
 * @param {object} props
 * @param {'ruleta'|'urna'|'numeros'} props.format
 * @param {{role: string, position: number, ticket_number: number, name: string}[]} props.winners ganadores y suplentes
 * @param {number} props.totalTickets
 * @param {string} props.title
 * @param {() => void} props.onClose
 */
export default function DrawStage({ format, winners, totalTickets, title, onClose }) {
  const reducedMotion = usePrefersReducedMotion()
  const main = winners.filter(w => w.role === 'winner').sort((a, b) => a.position - b.position)
  const alternates = winners.filter(w => w.role === 'alternate').sort((a, b) => a.position - b.position)

  const [step, setStep] = useState(0)
  const [phase, setPhase] = useState('spinning')
  const [skipped, setSkipped] = useState(false)
  const [showAll, setShowAll] = useState(false)

  const spinMs = spinDurationMs(main.length)
  const current = main[step]
  const finished = reducedMotion || skipped || showAll || !current
  const revealed = phase === 'revealed'

  const muted = useSyncExternalStore(subscribeSound, isSoundMuted, () => false)

  // Mientras gira, cada formato hace su propio sonido (redoble de la urna, clics
  // de la ruleta, tambores de los números). Cuando termina el giro se muestra al
  // ganador con fanfarria y confeti. El estado se cambia dentro del timeout (no
  // de forma sincrónica en el efecto). Al saltar o cerrar, el efecto se limpia.
  useEffect(() => {
    if (finished || phase !== 'spinning') return
    unlockAudio()
    const timer = setTimeout(() => {
      setPhase('revealed')
      playWinner()
      launchConfetti({ intensity: step === 0 ? 1 : 0.8 })
    }, spinMs + SETTLE_MS)
    return () => clearTimeout(timer)
  }, [finished, phase, step, spinMs])

  const next = () => {
    setStep(s => s + 1)
    setPhase('spinning')
  }

  const isLast = step >= main.length - 1

  const footer = (
    <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
      {!finished && (
        <button type="button" onClick={() => setSkipped(true)} className="btn-ghost">Saltar animación</button>
      )}
      {!finished && revealed && !isLast && (
        <button type="button" onClick={next} className="btn-primary">Siguiente ganador</button>
      )}
      {!finished && revealed && isLast && (
        <button type="button" onClick={() => setShowAll(true)} className="btn-primary">Ver resultado completo</button>
      )}
      {finished && <button type="button" onClick={onClose} className="btn-primary">Cerrar</button>}
    </div>
  )

  return (
    <FormModal open onClose={onClose} title="Sorteo en vivo" subtitle={title} maxWidth="max-w-2xl" footer={footer}>
      <div className="relative px-6 py-4 sm:px-8 sm:py-8">
        {/* Foco de luz detrás de la escena */}
        <div
          className="pointer-events-none absolute inset-x-0 top-6 h-[26rem]"
          style={{ background: 'radial-gradient(ellipse 55% 50% at 50% 45%, rgba(148,168,106,0.2), rgba(148,168,106,0) 70%)' }}
          aria-hidden="true"
        />
        <button
          type="button"
          onClick={() => {
            unlockAudio()
            setSoundMuted(!muted)
          }}
          className="absolute right-4 top-3 rounded-lg p-2 text-white/40 transition-colors hover:bg-white/5 hover:text-white"
          aria-label={muted ? 'Activar el sonido' : 'Silenciar el sonido'}
          aria-pressed={muted}
        >
          {muted ? <HiOutlineSpeakerXMark size={20} /> : <HiOutlineSpeakerWave size={20} />}
        </button>
        {finished ? (
          <ResultList winners={main} alternates={alternates} />
        ) : (
          <>
            <p className="mb-4 text-center text-xs uppercase tracking-widest text-white/40 sm:mb-6">
              {main.length > 1 ? `Ganador ${step + 1} de ${main.length}` : 'Ganador'}
            </p>

            {/* key: cada ganador empieza su animación desde cero */}
            <div key={step}>
              {format === 'urna' ? (
                <Urn
                  ticketNumber={current.ticket_number}
                  totalTickets={totalTickets}
                  spinMs={spinMs}
                  drawn={main.slice(0, step).map(w => w.ticket_number)}
                />
              ) : format === 'numeros' ? (
                <NumberRoll ticketNumber={current.ticket_number} totalTickets={totalTickets} spinMs={spinMs} revealed={revealed} />
              ) : (
                <Wheel ticketNumber={current.ticket_number} totalTickets={totalTickets} spinMs={spinMs} />
              )}
            </div>

            {/* Lo leen los lectores de pantalla; la animación en sí está oculta para ellos. */}
            <div className="mt-4 min-h-[4.5rem] text-center sm:mt-8 sm:min-h-[5.5rem]" role="status" aria-live="polite">
              <AnimatePresence>
                {revealed ? (
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                  >
                    <p className="font-display text-3xl font-bold text-white sm:text-4xl">{current.name}</p>
                    <p className="mt-2 text-primary-light">Ticket #{current.ticket_number}</p>
                  </motion.div>
                ) : (
                  <p className="text-sm text-white/40">Sorteando...</p>
                )}
              </AnimatePresence>
            </div>
          </>
        )}
      </div>
    </FormModal>
  )
}
