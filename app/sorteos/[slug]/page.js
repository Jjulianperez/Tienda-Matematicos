'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { HiOutlineTrophy, HiOutlineClock, HiOutlineShieldCheck } from 'react-icons/hi2'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import GeometricDecor from '@/components/ui/GeometricDecor'
import VerifyDraw from '@/components/giveaways/VerifyDraw'
import { formatDateTime } from '@/lib/format'
import { publicFetch, readStoredToken, STATUS_META, KIND_LABELS, SLOT_LABELS } from '@/lib/giveaways/ui'

function Message({ children }) {
  return <p className="card-dark p-6 text-sm text-white/70 leading-relaxed">{children}</p>
}

export default function SorteoPage() {
  const { slug } = useParams()
  const router = useRouter()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    let cancelled = false
    publicFetch(`/api/giveaways/public/${slug}`).then(result => {
      if (cancelled) return
      if (result.ok) setData(result.data)
      else setMissing(true)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [slug])

  // El comprobante se guarda en este navegador al inscribirse; si no está, se
  // manda al formulario.
  const goToParticipation = () => {
    const token = readStoredToken(slug)
    router.push(token ? `/sorteos/${slug}/participacion/${token}` : `/sorteos/${slug}/participar`)
  }

  const giveaway = data?.giveaway
  const meta = giveaway ? STATUS_META[giveaway.status] || { label: giveaway.status, cls: 'badge-new' } : null
  const winners = data?.winners?.filter(w => w.role === 'winner') || []
  const alternates = data?.winners?.filter(w => w.role === 'alternate') || []

  return (
    <>
      <Header />
      <main className="flex-1 bg-carbon min-h-screen relative">
        <GeometricDecor variant="blueprint" className="absolute inset-0 w-full h-full opacity-30" />
        <div className="relative container-page py-14 sm:py-20 max-w-4xl">
          <Link href="/sorteos" className="text-sm text-white/50 hover:text-white">← Todos los sorteos</Link>

          {loading ? (
            <div className="flex justify-center py-24">
              <span className="animate-spin border-2 border-white/20 border-t-primary w-8 h-8 rounded-full" />
            </div>
          ) : missing || !giveaway ? (
            <div className="mt-10"><Message>No encontramos este sorteo.</Message></div>
          ) : (
            <div className="mt-8 space-y-10">
              <header>
                <span className={`badge ${meta.cls}`}>{meta.label}</span>
                <h1 className="font-display font-bold text-3xl sm:text-5xl text-white text-balance leading-[1.15] mt-5">{giveaway.title}</h1>
                <p className="text-primary-light text-lg mt-3">{giveaway.prize_name}</p>
                {giveaway.description && <p className="text-white/50 mt-5 leading-relaxed max-w-2xl whitespace-pre-line">{giveaway.description}</p>}
              </header>

              {giveaway.prize_image_url && (
                // eslint-disable-next-line @next/next/no-img-element -- la imagen la carga el admin desde cualquier https.
                <img src={giveaway.prize_image_url} alt={giveaway.prize_name} className="w-full max-h-96 object-cover rounded-2xl border border-white/10" />
              )}

              {giveaway.prize_description && <p className="text-white/60 leading-relaxed whitespace-pre-line">{giveaway.prize_description}</p>}

              {/* Estado y llamado a la acción */}
              <section className="space-y-4">
                <p className="flex items-center gap-2 text-sm text-white/50">
                  <HiOutlineClock size={16} />
                  {formatDateTime(giveaway.starts_at)} → {formatDateTime(giveaway.ends_at)}
                </p>

                {giveaway.status === 'scheduled' && <Message>Todavía no empezó. Se abre el {formatDateTime(giveaway.starts_at)}.</Message>}
                {giveaway.status === 'active' && (
                  <div className="flex flex-wrap gap-3">
                    <Link href={`/sorteos/${slug}/participar`} className="btn-primary">Participar</Link>
                    <button type="button" onClick={goToParticipation} className="btn-outline">Ver mi participación</button>
                  </div>
                )}
                {giveaway.status === 'closing' && (
                  <>
                    <Message>La inscripción cerró. Estamos revisando las participaciones para armar la lista final.</Message>
                    <button type="button" onClick={goToParticipation} className="btn-outline">Ver mi participación</button>
                  </>
                )}
                {(giveaway.status === 'ready' || giveaway.status === 'drawing') && (
                  <>
                    <Message>
                      La lista de participantes está cerrada ({giveaway.tickets_count} {giveaway.tickets_count === 1 ? 'oportunidad' : 'oportunidades'}).
                      El sorteo se realiza en breve.
                    </Message>
                    <button type="button" onClick={goToParticipation} className="btn-outline">Ver mi participación</button>
                  </>
                )}
              </section>

              {/* Resultado */}
              {giveaway.status === 'completed' && (
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

              {giveaway.status === 'completed' && <VerifyDraw data={data} />}

              {/* Bases */}
              {giveaway.terms_text && (
                <details className="card-dark p-5 sm:p-6">
                  <summary className="cursor-pointer font-display font-semibold text-white">Bases y condiciones</summary>
                  <p className="text-sm text-white/60 mt-4 leading-relaxed whitespace-pre-line">{giveaway.terms_text}</p>
                </details>
              )}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  )
}
