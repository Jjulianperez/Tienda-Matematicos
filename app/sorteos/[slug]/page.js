'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { HiOutlineTrophy, HiOutlineClock, HiOutlineShieldCheck, HiOutlineSparkles } from 'react-icons/hi2'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import GeometricDecor from '@/components/ui/GeometricDecor'
import VerifyDraw from '@/components/giveaways/VerifyDraw'
import DrawStage from '@/components/giveaways/draw/DrawStage'
import GiveawayStage from '@/components/giveaways/stage/GiveawayStage'
import { formatDateTime } from '@/lib/format'
import { unlockAudio } from '@/lib/giveaways/sound'
import { useGiveawayStats } from '@/lib/giveaways/useGiveawayStats'
import {
  publicFetch,
  readStoredToken,
  readRevealed,
  markRevealed,
  toMine,
  STATUS_META,
  KIND_LABELS,
  SLOT_LABELS,
  FORMAT_LABELS,
} from '@/lib/giveaways/ui'

function Message({ children }) {
  return <p className="card-dark p-6 text-sm text-white/70 leading-relaxed">{children}</p>
}

// Todo lo que se ve cuando el sorteo ya cargó. Vive aparte para que la página
// lo vuelva a armar desde cero cuando cambia el estado (se abre, se cierra, se
// realiza) y todo arranque con los datos nuevos.
function SorteoView({ slug, data, mine, autoReveal, onStatusChange }) {
  const router = useRouter()
  const giveaway = data.giveaway
  const meta = STATUS_META[giveaway.status] || { label: giveaway.status, cls: 'badge-new' }
  const completed = giveaway.status === 'completed'

  // Cifras en vivo: personas, oportunidades y números asignados.
  const [fallbackStats] = useState(() => ({ participants: null, tickets: giveaway.tickets_count || 0, ranges: null }))
  const stats = useGiveawayStats(slug, data.stats || fallbackStats, {
    status: giveaway.status,
    enabled: !completed,
    onStatusChange,
  })

  // El resultado queda detrás del botón "Revelar" hasta que la persona lo ve.
  // Si el sorteo se realizó mientras miraba la página, la revelación arranca sola.
  const [revealed, setRevealed] = useState(() => (autoReveal ? false : readRevealed(slug)))
  const [playing, setPlaying] = useState(autoReveal)

  const winners = data.winners?.filter(w => w.role === 'winner') || []
  const alternates = data.winners?.filter(w => w.role === 'alternate') || []

  const goToParticipation = () => {
    const token = readStoredToken(slug)
    router.push(token ? `/sorteos/${slug}/participacion/${token}` : `/sorteos/${slug}/participar`)
  }

  const startReveal = () => {
    unlockAudio() // dentro del toque: habilita el sonido
    setPlaying(true)
  }

  const showResult = () => {
    markRevealed(slug)
    setRevealed(true)
  }

  const closeReveal = () => {
    setPlaying(false)
    showResult()
  }

  return (
    <>
      <div className="mt-6 sm:mt-8 grid gap-x-12 gap-y-8 sm:gap-y-10 lg:grid-cols-2 lg:items-center">
        {/* Título y premio */}
        <header className="lg:col-start-1 lg:row-start-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`badge ${meta.cls}`}>{meta.label}</span>
            <span className="badge badge-geo">{FORMAT_LABELS[giveaway.format] || 'Sorteo'}</span>
          </div>
          <h1 className="font-display font-bold text-3xl sm:text-5xl text-white text-balance leading-[1.15] mt-4 sm:mt-5">{giveaway.title}</h1>
          <div className="mt-3 sm:mt-4 flex items-center gap-3">
            {giveaway.prize_image_url && (
              // eslint-disable-next-line @next/next/no-img-element -- la imagen la carga el admin desde cualquier https.
              <img src={giveaway.prize_image_url} alt="" className="h-12 w-12 rounded-xl border border-white/10 object-cover" />
            )}
            <p className="text-primary-light text-lg">{giveaway.prize_name}</p>
          </div>
          {giveaway.description && (
            <p className="text-white/50 mt-3 sm:mt-5 leading-relaxed max-w-xl whitespace-pre-line line-clamp-2 sm:line-clamp-5">{giveaway.description}</p>
          )}
          <p className="flex items-start gap-2 text-xs sm:text-sm text-white/40 mt-3 sm:mt-5">
            <HiOutlineClock size={16} className="mt-0.5 shrink-0" />
            <span>{formatDateTime(giveaway.starts_at)} → {formatDateTime(giveaway.ends_at)}</span>
          </p>
        </header>

        {/* La escena: lo primero que se ve */}
        <div className="lg:col-start-2 lg:row-start-1 lg:row-span-2">
          <GiveawayStage
            format={giveaway.format}
            status={giveaway.status}
            participants={stats.participants}
            tickets={stats.tickets}
            ranges={stats.ranges}
            mine={mine}
            startsAt={giveaway.starts_at}
            endsAt={giveaway.ends_at}
          />
        </div>

        {/* Qué se puede hacer ahora */}
        <section className="space-y-4 lg:col-start-1 lg:row-start-2 lg:self-start">
          {giveaway.status === 'scheduled' && (
            <Message>Todavía no empezó. Se abre el {formatDateTime(giveaway.starts_at)}.</Message>
          )}

          {giveaway.status === 'active' && (
            <div className="flex flex-wrap gap-3">
              {mine ? (
                <button type="button" onClick={goToParticipation} className="btn-primary">Ver mi participación</button>
              ) : (
                <Link href={`/sorteos/${slug}/participar`} className="btn-primary">Participar</Link>
              )}
            </div>
          )}

          {giveaway.status === 'closing' && (
            <>
              <Message>La inscripción cerró. Estamos revisando las participaciones para armar la lista final.</Message>
              {mine && <button type="button" onClick={goToParticipation} className="btn-outline">Ver mi participación</button>}
            </>
          )}

          {(giveaway.status === 'ready' || giveaway.status === 'drawing') && (
            <>
              <Message>
                La lista de participantes está cerrada ({stats.tickets} {stats.tickets === 1 ? 'oportunidad' : 'oportunidades'}).
                El sorteo se realiza en breve: esta página se actualiza sola.
              </Message>
              {mine && <button type="button" onClick={goToParticipation} className="btn-outline">Ver mi participación</button>}
            </>
          )}

          {completed && !revealed && (
            <div className="space-y-4">
              <Message>El sorteo ya se realizó. ¿Querés ver quién ganó?</Message>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                <button type="button" onClick={startReveal} className="btn-primary">
                  <HiOutlineSparkles size={18} />
                  Revelar ganador
                </button>
                <button type="button" onClick={showResult} className="text-sm text-white/50 underline underline-offset-4 hover:text-white">
                  Ver el resultado sin animación
                </button>
              </div>
            </div>
          )}

          {completed && revealed && (
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={startReveal} className="btn-outline">Ver el sorteo de nuevo</button>
              {mine && <button type="button" onClick={goToParticipation} className="btn-ghost">Ver mi participación</button>}
            </div>
          )}
        </section>
      </div>

      <div className="mt-16 max-w-4xl space-y-12">
        {/* El premio */}
        {(giveaway.prize_image_url || giveaway.prize_description) && (
          <section className="card-dark overflow-hidden sm:grid sm:grid-cols-[minmax(0,260px)_1fr]">
            {giveaway.prize_image_url && (
              // eslint-disable-next-line @next/next/no-img-element -- la imagen la carga el admin desde cualquier https.
              <img src={giveaway.prize_image_url} alt={giveaway.prize_name} className="h-56 w-full object-cover sm:h-full" />
            )}
            <div className="p-6 sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-widest text-white/40">El premio</p>
              <h2 className="font-display font-semibold text-white text-2xl mt-2">{giveaway.prize_name}</h2>
              {giveaway.prize_description && (
                <p className="text-white/60 leading-relaxed mt-3 whitespace-pre-line">{giveaway.prize_description}</p>
              )}
            </div>
          </section>
        )}

        {/* Resultado (después de revelarlo) */}
        {completed && revealed && (
          <section>
            <h2 className="font-display font-semibold text-white text-2xl flex items-center gap-3">
              <HiOutlineTrophy className="text-primary-light" />
              {winners.length === 1 ? 'Ganador' : 'Ganadores'}
            </h2>
            <ol className="mt-5 grid gap-3 sm:grid-cols-2">
              {winners.map(w => (
                <li key={w.participant_id} className="card-dark p-5 flex items-center justify-between gap-3">
                  <span className="text-white font-medium">{w.position}. {w.first_name}</span>
                  <span className="text-xs text-primary-light">Ticket #{w.ticket_number}</span>
                </li>
              ))}
            </ol>
            {alternates.length > 0 && (
              <div className="mt-8">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-3">Suplentes, en orden</h3>
                <ol className="space-y-2">
                  {alternates.map(w => (
                    <li key={w.participant_id} className="flex items-center justify-between gap-3 text-sm text-white/70 px-1">
                      <span>{w.position}. {w.first_name}</span>
                      <span className="text-xs text-white/40">Ticket #{w.ticket_number}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </section>
        )}

        {/* Requisitos */}
        <section>
          <h2 className="font-display font-semibold text-white text-2xl">Cómo participar</h2>
          <div className="mt-5 space-y-6">
            {[1, 2].filter(slot => data.requirements.some(r => r.slot === slot)).map(slot => (
              <div key={slot}>
                <h3 className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-3">
                  {SLOT_LABELS[slot]}{slot === 2 && ' (opcional)'}
                </h3>
                <ul className="space-y-2">
                  {data.requirements.filter(r => r.slot === slot).map(r => (
                    <li key={r.id} className="card-dark p-4">
                      <p className="text-white font-medium">{r.title}</p>
                      <p className="text-xs text-primary-light/80 mt-1">{KIND_LABELS[r.kind]}</p>
                      {r.instructions && <p className="text-sm text-white/50 mt-2 leading-relaxed">{r.instructions}</p>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="text-sm text-white/40 mt-5 leading-relaxed">
            Cada oportunidad es un ticket con la misma probabilidad. Quien consigue las dos tiene dos tickets.
            Se sortean {giveaway.winners_count} {giveaway.winners_count === 1 ? 'ganador' : 'ganadores'}
            {giveaway.alternates_count > 0 && ` y ${giveaway.alternates_count} ${giveaway.alternates_count === 1 ? 'suplente' : 'suplentes'}`}; una persona no puede ganar dos veces.
          </p>
        </section>

        {/* Transparencia */}
        <section>
          <h2 className="font-display font-semibold text-white text-2xl flex items-center gap-3">
            <HiOutlineShieldCheck className="text-primary-light" />
            Transparencia
          </h2>
          <p className="text-sm text-white/50 mt-4 leading-relaxed max-w-2xl">
            Antes de abrir el sorteo publicamos una huella de la semilla secreta que usaremos. Al cerrar,
            publicamos la huella de la lista de tickets. Al sortear revelamos la semilla: con eso cualquiera
            puede comprobar que el resultado no se manipuló.
          </p>
          <dl className="mt-4 space-y-3 text-xs">
            <div>
              <dt className="text-white/40 uppercase tracking-widest">Huella de la semilla (compromiso)</dt>
              <dd className="font-mono text-white/60 break-all mt-1">{giveaway.seed_commitment}</dd>
            </div>
            {giveaway.tickets_hash && (
              <div>
                <dt className="text-white/40 uppercase tracking-widest">Huella de la lista de tickets</dt>
                <dd className="font-mono text-white/60 break-all mt-1">{giveaway.tickets_hash}</dd>
              </div>
            )}
          </dl>
        </section>

        {completed && revealed && <VerifyDraw data={data} />}

        {/* Bases */}
        {giveaway.terms_text && (
          <details className="card-dark p-5 sm:p-6">
            <summary className="cursor-pointer font-display font-semibold text-white">Bases y condiciones</summary>
            <p className="text-sm text-white/60 mt-4 leading-relaxed whitespace-pre-line">{giveaway.terms_text}</p>
          </details>
        )}
      </div>

      {playing && (
        <DrawStage
          format={giveaway.format}
          totalTickets={giveaway.tickets_count || stats.tickets || 1}
          title={giveaway.title}
          winners={(data.winners || []).map(w => ({
            role: w.role,
            position: w.position,
            ticket_number: w.ticket_number,
            name: w.first_name,
          }))}
          onClose={closeReveal}
        />
      )}
    </>
  )
}

export default function SorteoPage() {
  const { slug } = useParams()
  const [view, setView] = useState({ data: null, mine: null, version: 0 })
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  // true cuando el sorteo se realizó mientras la persona miraba la página.
  const [liveReveal, setLiveReveal] = useState(false)

  useEffect(() => {
    let cancelled = false
    const token = readStoredToken(slug)

    // El sorteo y, si esta persona se inscribió desde este navegador, su
    // participación: se piden juntos para que su esfera esté desde el primer cuadro.
    Promise.all([
      publicFetch(`/api/giveaways/public/${slug}`),
      token ? publicFetch(`/api/giveaways/public/${slug}/participation`, { token }) : Promise.resolve(null),
    ]).then(([main, participation]) => {
      if (cancelled) return
      if (main.ok) {
        setView(prev => ({
          data: main.data,
          mine: participation?.ok ? toMine(participation.data) : null,
          version: prev.version + 1,
        }))
        setMissing(false)
      } else {
        setMissing(true)
      }
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [slug, reloadKey])

  const handleStatusChange = status => {
    if (status === 'completed') setLiveReveal(true)
    setReloadKey(k => k + 1)
  }

  const { data, mine, version } = view

  return (
    <>
      <Header />
      <main className="flex-1 bg-carbon min-h-screen relative overflow-x-clip">
        <GeometricDecor variant="blueprint" className="absolute inset-0 w-full h-full opacity-30" />
        <div className="relative container-page py-6 sm:py-16 max-w-6xl">
          <Link href="/sorteos" className="text-sm text-white/50 hover:text-white">← Todos los sorteos</Link>

          {loading ? (
            <div className="flex justify-center py-24">
              <span className="animate-spin border-2 border-white/20 border-t-primary w-8 h-8 rounded-full" />
            </div>
          ) : missing || !data?.giveaway ? (
            <div className="mt-10"><Message>No encontramos este sorteo.</Message></div>
          ) : (
            <SorteoView
              key={version}
              slug={slug}
              data={data}
              mine={mine}
              autoReveal={liveReveal && data.giveaway.status === 'completed'}
              onStatusChange={handleStatusChange}
            />
          )}
        </div>
      </main>
      <Footer />
    </>
  )
}
