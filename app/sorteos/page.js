'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { HiOutlineGift, HiOutlineClock, HiOutlineUserGroup } from 'react-icons/hi2'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import GeometricDecor from '@/components/ui/GeometricDecor'
import { formatDateTime } from '@/lib/format'
import { publicFetch, STATUS_META, FORMAT_LABELS } from '@/lib/giveaways/ui'

// Orden y títulos de cada grupo en la página.
const GROUPS = [
  { title: 'Sorteos abiertos', statuses: ['active'] },
  { title: 'Próximos', statuses: ['scheduled'] },
  { title: 'En revisión', statuses: ['closing', 'ready', 'drawing'] },
  { title: 'Finalizados', statuses: ['completed'] },
]

function GiveawayCard({ giveaway }) {
  const meta = STATUS_META[giveaway.status] || { label: giveaway.status, cls: 'badge-new' }
  return (
    <Link href={`/sorteos/${giveaway.slug}`} className="card-dark block overflow-hidden h-full">
      {giveaway.prize_image_url && (
        // eslint-disable-next-line @next/next/no-img-element -- la imagen la carga el admin desde cualquier https.
        <img src={giveaway.prize_image_url} alt="" className="w-full h-44 object-cover" loading="lazy" />
      )}
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display font-semibold text-white text-lg leading-snug">{giveaway.title}</h3>
          <span className={`badge ${meta.cls} shrink-0`}>{meta.label}</span>
        </div>
        <p className="text-primary-light text-sm mt-2">{giveaway.prize_name}</p>
        {giveaway.description && <p className="text-sm text-white/50 mt-3 line-clamp-2 leading-relaxed">{giveaway.description}</p>}
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/50 mt-4">
          {giveaway.participants_count !== null && giveaway.participants_count !== undefined && (
            <span className="inline-flex items-center gap-1.5">
              <HiOutlineUserGroup size={14} />
              {giveaway.participants_count} {giveaway.participants_count === 1 ? 'persona participando' : 'personas participando'}
            </span>
          )}
          <span>{FORMAT_LABELS[giveaway.format] || 'Sorteo'}</span>
        </p>
        <p className="flex items-center gap-1.5 text-xs text-white/40 mt-2">
          <HiOutlineClock size={14} />
          {giveaway.status === 'scheduled'
            ? `Empieza ${formatDateTime(giveaway.starts_at)}`
            : giveaway.status === 'active'
              ? `Cierra ${formatDateTime(giveaway.ends_at)}`
              : `Cerró ${formatDateTime(giveaway.ends_at)}`}
        </p>
      </div>
    </Link>
  )
}

export default function SorteosPage() {
  const [giveaways, setGiveaways] = useState([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    publicFetch('/api/giveaways/public').then(result => {
      if (cancelled) return
      if (result.ok && Array.isArray(result.data)) setGiveaways(result.data)
      else setFailed(true)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  return (
    <>
      <Header />
      <main className="flex-1 bg-carbon min-h-screen relative">
        <GeometricDecor variant="blueprint" className="absolute inset-0 w-full h-full opacity-30" />
        <div className="relative container-page py-16 sm:py-20">
          <header className="mb-12 sm:mb-16">
            <span className="badge badge-geo mb-6 inline-flex">Sorteos</span>
            <h1 className="font-display font-bold text-4xl sm:text-5xl text-white text-balance leading-[1.15]">
              Participá y <span className="text-primary-light">ganá</span>
            </h1>
            <p className="mt-6 text-white/40 max-w-2xl leading-relaxed">
              Cada sorteo publica sus reglas antes de empezar y su resultado se puede verificar:
              cualquiera puede recalcular quién ganó.
            </p>
          </header>

          {loading ? (
            <div className="flex justify-center py-20">
              <span className="animate-spin border-2 border-white/20 border-t-primary w-8 h-8 rounded-full" />
            </div>
          ) : failed ? (
            <p className="text-white/50">No pudimos cargar los sorteos. Probá de nuevo en un momento.</p>
          ) : giveaways.length === 0 ? (
            <div className="card-dark p-10 text-center max-w-lg">
              <HiOutlineGift size={36} className="mx-auto text-primary-light/60" />
              <p className="text-white/70 mt-4">Por ahora no hay sorteos. Volvé pronto.</p>
            </div>
          ) : (
            <div className="space-y-14">
              {GROUPS.map(group => {
                const items = giveaways.filter(g => group.statuses.includes(g.status))
                if (items.length === 0) return null
                return (
                  <section key={group.title}>
                    <h2 className="font-display font-semibold text-white text-xl mb-5">{group.title}</h2>
                    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                      {items.map(g => <GiveawayCard key={g.id} giveaway={g} />)}
                    </div>
                  </section>
                )
              })}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  )
}
