'use client'

import { SectionCard } from '@/components/admin/fields'
import GiveawayStage from '@/components/giveaways/stage/GiveawayStage'

// La misma escena que ve el público (urna, ruleta o números), con las cifras
// del sorteo. Cuando se aprueba una evidencia y el panel se actualiza, la esfera
// nueva cae, el segmento crece o el número se tacha, igual que en la web.
export default function StagePanel({ data, className = '' }) {
  const { giveaway, stats, overview } = data

  // Las cifras vienen del detalle; si faltan (migración 009 sin aplicar), se
  // usan los conteos del resumen del panel.
  const tickets = stats?.tickets ?? overview?.tickets ?? 0
  const participants = stats?.participants ?? null

  return (
    <SectionCard
      title="Así lo ve el público"
      description="Se actualiza sola mientras el sorteo está abierto."
      className={className}
    >
      <GiveawayStage
        format={giveaway.format}
        status={giveaway.status}
        participants={participants}
        tickets={tickets}
        ranges={stats?.ranges ?? null}
        mine={null}
        startsAt={giveaway.starts_at}
        endsAt={giveaway.ends_at}
        size="md"
      />
      {giveaway.status === 'draft' && (
        <p className="mt-5 text-center text-xs leading-relaxed text-white/40">
          Es un borrador: todavía no lo ve nadie. Al publicarlo, esta escena aparece en la web.
        </p>
      )}
    </SectionCard>
  )
}
