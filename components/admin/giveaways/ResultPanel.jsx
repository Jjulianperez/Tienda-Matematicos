'use client'

import { useState, useEffect } from 'react'
import { SectionCard } from '@/components/admin/fields'
import VerifyDraw from '@/components/giveaways/VerifyDraw'
import DrawStage from '@/components/giveaways/draw/DrawStage'
import { formatDateTime } from '@/lib/format'
import { unlockAudio } from '@/lib/giveaways/sound'

function WinnerList({ title, items }) {
  if (items.length === 0) return null
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-3">{title}</h4>
      <ul className="space-y-2">
        {items.map(w => (
          <li key={w.id} className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-white/5 border border-white/5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-white">
                {w.position}. {w.participant?.full_name || 'Participante'}
                {w.participant?.ig_handle && <span className="text-white/40 font-normal"> · {w.participant.ig_handle}</span>}
              </p>
              <p className="text-xs text-white/50 mt-0.5">
                {w.participant?.phone_display}
                {w.participant?.email && ` · ${w.participant.email}`}
              </p>
            </div>
            <span className="text-xs text-primary-light">Ticket #{w.ticket_number}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// Resultado del sorteo. Los ganadores se muestran con sus datos de contacto
// (solo en el panel; la web pública solo muestra el nombre de pila).
export default function ResultPanel({ giveaway, winners, draws, autoPlay = false, onAutoPlayDone }) {
  const [publicData, setPublicData] = useState(null)
  const [playing, setPlaying] = useState(false)

  // Se abre al tocar el botón, o solo (una vez) justo después de ejecutar el sorteo.
  const showStage = winners.length > 0 && (playing || autoPlay)
  const closeStage = () => {
    setPlaying(false)
    onAutoPlayDone?.()
  }

  // Los mismos datos públicos que usa cualquier persona para verificar.
  useEffect(() => {
    if (giveaway.status !== 'completed') return
    let cancelled = false
    fetch(`/api/giveaways/public/${giveaway.slug}`)
      .then(res => (res.ok ? res.json() : null))
      .then(data => { if (!cancelled) setPublicData(data) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [giveaway.slug, giveaway.status])

  const completed = draws.find(d => d.status === 'completed')
  const failedAttempts = draws.filter(d => d.status === 'failed')

  const group = role => winners.filter(w => w.role === role)

  return (
    <div className="space-y-6">
      <SectionCard
        title="Resultado"
        description={completed?.completed_at ? `Realizado el ${formatDateTime(completed.completed_at)}` : 'El sorteo todavía no se realizó'}
      >
        {winners.length === 0 ? (
          <p className="text-sm text-white/40">Todavía no hay ganadores.</p>
        ) : (
          <div className="space-y-6">
            <WinnerList title="Ganadores" items={group('winner')} />
            <WinnerList title="Suplentes (en orden)" items={group('alternate')} />
            {giveaway.status === 'completed' && (
              <button type="button" onClick={() => { unlockAudio(); setPlaying(true) }} className="btn-outline">
                Reproducir el sorteo
              </button>
            )}
          </div>
        )}

        {failedAttempts.length > 0 && (
          <p className="text-xs text-white/40 mt-6">
            Hubo {failedAttempts.length} {failedAttempts.length === 1 ? 'intento' : 'intentos'} que no terminaron ({failedAttempts.map(a => a.failed_reason).filter(Boolean).join('; ') || 'sin detalle'}). No afectan al resultado.
          </p>
        )}
      </SectionCard>

      {giveaway.status === 'completed' && publicData && <VerifyDraw data={publicData} />}

      {showStage && (
        <DrawStage
          format={giveaway.format}
          totalTickets={giveaway.tickets_count || 1}
          title={giveaway.title}
          winners={winners.map(w => ({
            role: w.role,
            position: w.position,
            ticket_number: w.ticket_number,
            name: w.participant?.full_name || 'Participante',
          }))}
          onClose={closeStage}
        />
      )}
    </div>
  )
}
