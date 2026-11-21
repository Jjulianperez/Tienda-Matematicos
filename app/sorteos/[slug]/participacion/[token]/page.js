'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { HiOutlineCheckCircle, HiOutlineClock, HiOutlineXCircle, HiOutlineTicket, HiOutlineTrophy } from 'react-icons/hi2'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import GeometricDecor from '@/components/ui/GeometricDecor'
import GiveawayStage from '@/components/giveaways/stage/GiveawayStage'
import { useToast, ToastStack } from '@/components/Modal'
import { formatDateTime } from '@/lib/format'
import { launchConfetti } from '@/lib/giveaways/confetti'
import { playWinner } from '@/lib/giveaways/sound'
import { useGiveawayStats } from '@/lib/giveaways/useGiveawayStats'
import {
  publicFetch,
  errorMessage,
  toMine,
  wasJustJoined,
  readWinCelebrated,
  markWinCelebrated,
  KIND_LABELS,
  SLOT_LABELS,
  STATUS_META,
} from '@/lib/giveaways/ui'

const MAX_BYTES = 4 * 1024 * 1024

const STATE_UI = {
  missing: { label: 'Pendiente', cls: 'text-white/50', icon: HiOutlineClock },
  pending_review: { label: 'En revisión', cls: 'text-amber-300', icon: HiOutlineClock },
  approved: { label: 'Aprobado', cls: 'text-primary-light', icon: HiOutlineCheckCircle },
  submitted: { label: 'Enviado', cls: 'text-primary-light', icon: HiOutlineCheckCircle },
  rejected: { label: 'Rechazado', cls: 'text-red-400', icon: HiOutlineXCircle },
}

// Un requisito y lo que la persona puede hacer con él.
function RequirementItem({ requirement, canAct, busy, onUpload, onAnswer }) {
  const [text, setText] = useState('')
  const ui = STATE_UI[requirement.state] || STATE_UI.missing
  const Icon = ui.icon
  const done = ['approved', 'submitted', 'pending_review'].includes(requirement.state)
  const canUpload = canAct && requirement.kind === 'evidence_upload' && !['approved', 'pending_review'].includes(requirement.state)

  return (
    <li className="card-dark p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-white font-medium">{requirement.title}</p>
          <p className="text-xs text-primary-light/80 mt-1">{KIND_LABELS[requirement.kind]}</p>
          {requirement.instructions && <p className="text-sm text-white/50 mt-2 leading-relaxed">{requirement.instructions}</p>}
        </div>
        <span className={`flex items-center gap-1.5 text-xs font-medium shrink-0 ${ui.cls}`}>
          <Icon size={16} />
          {ui.label}
        </span>
      </div>

      {requirement.state === 'rejected' && requirement.rejection_reason && (
        <p className="text-sm text-red-300/80 mt-3">Motivo: {requirement.rejection_reason}. Podés subir otra captura.</p>
      )}

      {canUpload && (
        <label className="btn-outline mt-4 inline-flex cursor-pointer">
          {busy ? 'Subiendo...' : requirement.state === 'rejected' ? 'Subir otra captura' : 'Subir captura'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={busy}
            onChange={e => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) onUpload(requirement, file)
            }}
          />
        </label>
      )}

      {canAct && !done && requirement.kind === 'declarative' && (
        <button type="button" disabled={busy} onClick={() => onAnswer(requirement, {})} className="btn-outline mt-4">
          {busy ? 'Enviando...' : 'Confirmo que lo hice'}
        </button>
      )}

      {canAct && !done && (requirement.kind === 'text_answer' || requirement.kind === 'external_link') && (
        <form
          className="mt-4 flex flex-col sm:flex-row gap-3"
          onSubmit={event => {
            event.preventDefault()
            onAnswer(requirement, requirement.kind === 'text_answer' ? { text } : { url: text })
          }}
        >
          <input
            className="input-dark flex-1"
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={requirement.kind === 'text_answer' ? 'Tu respuesta' : 'https://...'}
            type={requirement.kind === 'external_link' ? 'url' : 'text'}
            required
          />
          <button type="submit" disabled={busy} className="btn-outline">{busy ? 'Enviando...' : 'Enviar'}</button>
        </form>
      )}
    </li>
  )
}

// La escena del sorteo con la participación de esta persona. No se vuelve a
// crear al recargar el comprobante: así, cuando se aprueba un requisito, se ve
// cómo su esfera (o su lugar) pasa de "en revisión" a confirmada.
function ParticipationStage({ slug, data, celebrate, onStatusChange }) {
  const giveaway = data.giveaway
  const stats = useGiveawayStats(slug, data.stats, {
    status: giveaway.status,
    enabled: giveaway.status !== 'completed',
    onStatusChange,
  })
  return (
    <GiveawayStage
      format={giveaway.format}
      status={giveaway.status}
      participants={stats.participants}
      tickets={stats.tickets}
      ranges={stats.ranges}
      mine={toMine(data)}
      celebrate={celebrate}
      startsAt={giveaway.starts_at}
      endsAt={giveaway.ends_at}
      size="md"
    />
  )
}

export default function ParticipacionPage() {
  const { slug, token } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  // true si la persona recién se inscribió: su esfera entra con animación.
  const [celebrate] = useState(() => wasJustJoined(slug))
  const { toasts, show, dismiss } = useToast()

  const toastRef = useRef(show)
  useEffect(() => { toastRef.current = show }, [show])

  useEffect(() => {
    let cancelled = false
    publicFetch(`/api/giveaways/public/${slug}/participation`, { token }).then(result => {
      if (cancelled) return
      if (result.ok) setData(result.data)
      else setMissing(true)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [slug, token, reloadKey])

  const reload = () => setReloadKey(k => k + 1)

  // Si esta persona ganó, se festeja una vez (después, cada visita sería repetir).
  useEffect(() => {
    if (data?.winner?.role !== 'winner' || readWinCelebrated(slug)) return
    markWinCelebrated(slug)
    launchConfetti()
    playWinner()
  }, [data, slug])

  const upload = async (requirement, file) => {
    if (file.size > MAX_BYTES) return toastRef.current('La captura supera los 4 MB', 'error')
    setBusyId(requirement.id)
    const form = new FormData()
    form.append('requirement_id', requirement.id)
    form.append('image', file)
    const result = await publicFetch(`/api/giveaways/public/${slug}/evidence`, { method: 'POST', body: form, token })
    setBusyId(null)
    if (!result.ok) return toastRef.current(errorMessage(result, 'No se pudo subir la captura'), 'error')
    toastRef.current('Captura enviada. Un administrador la va a revisar', 'success')
    reload()
  }

  const answer = async (requirement, payload) => {
    setBusyId(requirement.id)
    const result = await publicFetch(`/api/giveaways/public/${slug}/answer`, {
      method: 'POST',
      token,
      body: { requirement_id: requirement.id, payload },
    })
    setBusyId(null)
    if (!result.ok) return toastRef.current(errorMessage(result, 'No se pudo enviar la respuesta'), 'error')
    toastRef.current(result.data.entries_created > 0 ? '¡Conseguiste una oportunidad!' : 'Respuesta enviada', 'success')
    reload()
  }

  const giveaway = data?.giveaway
  const canAct = giveaway?.status === 'active'
  const meta = giveaway ? STATUS_META[giveaway.status] || { label: giveaway.status, cls: 'badge-new' } : null

  return (
    <>
      <Header />
      <main className="flex-1 bg-carbon min-h-screen relative">
        <GeometricDecor variant="blueprint" className="absolute inset-0 w-full h-full opacity-30" />
        <div className="relative container-page py-14 sm:py-20 max-w-2xl">
          {loading ? (
            <div className="flex justify-center py-24">
              <span className="animate-spin border-2 border-white/20 border-t-primary w-8 h-8 rounded-full" />
            </div>
          ) : missing || !data ? (
            <div className="card-dark p-6">
              <p className="text-sm text-white/70 leading-relaxed">
                No encontramos esta participación. Revisá que el enlace esté completo, o volvé a{' '}
                <Link href={`/sorteos/${slug}`} className="text-primary-light underline">la página del sorteo</Link>.
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              <header>
                <span className={`badge ${meta.cls}`}>{meta.label}</span>
                <h1 className="font-display font-bold text-3xl text-white leading-tight mt-4">{giveaway.title}</h1>
                <p className="text-white/50 mt-2">Participación de <span className="text-white">{data.participant.full_name}</span>{data.participant.ig_handle && ` · ${data.participant.ig_handle}`}</p>
                <p className="text-xs text-white/40 mt-3 leading-relaxed">
                  Guardá esta página: es tu comprobante y la única forma de volver a ver tu participación.
                </p>
              </header>

              {celebrate && (
                <p className="card-dark p-5 text-sm leading-relaxed text-white/70">
                  <span className="font-semibold text-white">¡Listo, {data.participant.full_name.trim().split(/s+/)[0]}!</span>{' '}
                  {data.entries.length === 0
                    ? 'Reservamos tu lugar. Cumplí los requisitos de abajo para que cuente en el sorteo.'
                    : 'Ya estás participando.'}
                </p>
              )}

              <ParticipationStage slug={slug} data={data} celebrate={celebrate} onStatusChange={reload} />

              {data.winner && (
                <div className="card-dark p-6 border border-primary/40">
                  <p className="flex items-center gap-2 text-primary-light font-display font-semibold text-lg">
                    <HiOutlineTrophy />
                    {data.winner.role === 'winner' ? '¡Ganaste!' : `Quedaste como suplente (puesto ${data.winner.position})`}
                  </p>
                  <p className="text-sm text-white/60 mt-2 leading-relaxed">
                    {data.winner.role === 'winner'
                      ? 'Nos vamos a comunicar con vos por el teléfono que dejaste.'
                      : 'Si algún ganador no puede recibir el premio, te vamos a avisar.'}
                  </p>
                </div>
              )}

              <section>
                <h2 className="font-display font-semibold text-white text-xl flex items-center gap-2.5">
                  <HiOutlineTicket className="text-primary-light" />
                  Tus oportunidades
                </h2>
                {data.entries.length === 0 ? (
                  <p className="text-sm text-white/50 mt-3 leading-relaxed">Todavía no tenés ninguna. Cumplí los requisitos de abajo para conseguirlas.</p>
                ) : (
                  <ul className="mt-4 flex flex-wrap gap-3">
                    {data.entries.map(entry => (
                      <li key={entry.slot} className="card-dark px-5 py-3 text-center">
                        <span className="block text-xs text-white/40 uppercase tracking-widest">{SLOT_LABELS[entry.slot]}</span>
                        <span className="block text-2xl font-display font-bold text-primary-light mt-1">#{entry.ticket_number}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {[1, 2].filter(slot => data.requirements.some(r => r.slot === slot)).map(slot => (
                <section key={slot}>
                  <h2 className="font-display font-semibold text-white text-xl">
                    {SLOT_LABELS[slot]}{slot === 2 && ' (opcional)'}
                  </h2>
                  <ul className="mt-4 space-y-3">
                    {data.requirements.filter(r => r.slot === slot).map(r => (
                      <RequirementItem
                        key={r.id}
                        requirement={r}
                        canAct={canAct}
                        busy={busyId === r.id}
                        onUpload={upload}
                        onAnswer={answer}
                      />
                    ))}
                  </ul>
                </section>
              ))}

              {!canAct && (
                <p className="text-sm text-white/40 leading-relaxed">
                  {giveaway.status === 'scheduled'
                    ? `El sorteo se abre el ${formatDateTime(giveaway.starts_at)}.`
                    : 'La inscripción cerró: ya no se pueden subir capturas ni responder requisitos.'}
                </p>
              )}

              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={reload} className="btn-outline">Actualizar estado</button>
                <Link href={`/sorteos/${slug}`} className="btn-ghost">Ver el sorteo</Link>
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
      <ToastStack toasts={toasts} onClose={dismiss} />
    </>
  )
}
