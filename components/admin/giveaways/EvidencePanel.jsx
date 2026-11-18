'use client'

import { useState, useEffect } from 'react'
import { HiOutlineCheck, HiOutlineXMark, HiOutlineEye, HiOutlineChevronLeft, HiOutlineChevronRight } from 'react-icons/hi2'
import FormModal from '@/components/admin/FormModal'
import { TextArea, Tabs, FormActions, SectionCard } from '@/components/admin/fields'
import { formatDateTime } from '@/lib/format'
import { adminFetch, errorMessage } from '@/lib/giveaways/ui'

const TABS = [
  { id: 'pending', label: 'Pendientes' },
  { id: 'approved', label: 'Aprobadas' },
  { id: 'rejected', label: 'Rechazadas' },
]

const PER_PAGE = 20

// Cola de revisión. La captura se abre con una URL firmada que vence a los 60
// segundos: no existe una dirección pública de las imágenes.
function EvidenceViewer({ giveawayId, evidence, onClose, toast }) {
  const [url, setUrl] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    adminFetch(`/api/giveaways/${giveawayId}/evidence/${evidence.id}`).then(result => {
      if (cancelled) return
      if (result.ok) setUrl(result.data.url)
      else {
        setFailed(true)
        toast(errorMessage(result, 'No se pudo abrir la captura'), 'error')
      }
    })
    return () => { cancelled = true }
  }, [giveawayId, evidence.id, toast])

  return (
    <FormModal
      open
      onClose={onClose}
      title="Captura"
      subtitle={`${evidence.participant?.full_name || 'Participante'} · ${evidence.requirement?.title || ''}`}
      maxWidth="max-w-3xl"
    >
      <div className="p-6 flex justify-center min-h-[12rem] items-center">
        {failed ? (
          <p className="text-sm text-red-400">No se pudo cargar la imagen.</p>
        ) : !url ? (
          <span className="animate-spin border-2 border-white/20 border-t-primary w-8 h-8 rounded-full" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- URL firmada que vence: no se optimiza.
          <img src={url} alt="Captura enviada por la persona" className="max-h-[70vh] rounded-xl border border-white/10" />
        )}
      </div>
    </FormModal>
  )
}

function RejectForm({ onSubmit, onCancel, saving }) {
  const [reason, setReason] = useState('')
  return (
    <FormModal
      open
      onClose={onCancel}
      title="Rechazar captura"
      subtitle="La persona va a poder subir otra"
      footer={<FormActions formId="reject-form" onCancel={onCancel} saving={saving} submitText="Rechazar" />}
    >
      <form
        id="reject-form"
        onSubmit={event => {
          event.preventDefault()
          onSubmit(reason)
        }}
        className="px-6 sm:px-8 py-6"
      >
        <TextArea label="Motivo" required value={reason} onChange={e => setReason(e.target.value)} rows={3} placeholder="No se ve que sigas la cuenta" hint="Lo ve la persona en su comprobante." />
      </form>
    </FormModal>
  )
}

export default function EvidencePanel({ giveaway, canReview, onChanged, toast }) {
  const [tab, setTab] = useState('pending')
  const [page, setPage] = useState(1)
  const [data, setData] = useState({ evidence: [], total: 0 })
  const [loading, setLoading] = useState(true)
  const [viewing, setViewing] = useState(null)
  const [rejecting, setRejecting] = useState(null)
  const [busy, setBusy] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    // Si se solapan dos cargas (cambio de pestaña o de página), la vieja no pisa a la nueva.
    let cancelled = false

    const fetchEvidence = async () => {
      const result = await adminFetch(`/api/giveaways/${giveaway.id}/evidence?status=${tab}&page=${page}&perPage=${PER_PAGE}`)
      if (cancelled) return
      if (result.ok) setData(result.data)
      else toast(errorMessage(result, 'No se pudieron cargar las evidencias'), 'error')
      setLoading(false)
    }

    fetchEvidence()
    return () => { cancelled = true }
  }, [giveaway.id, tab, page, reloadKey, toast])

  const load = () => setReloadKey(k => k + 1)

  const review = async (evidence, decision, reason) => {
    setBusy(true)
    const result = await adminFetch(`/api/giveaways/${giveaway.id}/evidence/${evidence.id}/review`, {
      method: 'POST',
      body: { decision, reason },
    })
    setBusy(false)
    if (!result.ok) return toast(errorMessage(result, 'No se pudo guardar la decisión'), 'error')

    setRejecting(null)
    const created = result.data.entries_created
    toast(
      decision === 'approved'
        ? created > 0 ? `Aprobada. Se entregó ${created === 1 ? 'una oportunidad' : `${created} oportunidades`}` : 'Aprobada'
        : 'Rechazada',
      'success'
    )
    load()
    onChanged()
  }

  const pages = Math.max(Math.ceil(data.total / PER_PAGE), 1)

  return (
    <SectionCard title="Evidencias" description="Capturas que subieron las personas para cumplir los requisitos.">
      <Tabs
        tabs={TABS}
        active={tab}
        onChange={id => { setTab(id); setPage(1); setLoading(true) }}
        className="mb-5"
      />

      {loading ? (
        <div className="flex justify-center py-12">
          <span className="animate-spin border-2 border-white/20 border-t-primary w-7 h-7 rounded-full" />
        </div>
      ) : data.evidence.length === 0 ? (
        <p className="text-sm text-white/40 py-8 text-center">
          {tab === 'pending' ? 'No hay capturas por revisar.' : 'No hay capturas en esta lista.'}
        </p>
      ) : (
        <ul className="space-y-3">
          {data.evidence.map(e => (
            <li key={e.id} className="p-4 rounded-xl bg-white/5 border border-white/5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white">
                    {e.participant?.full_name || 'Participante'}
                    {e.participant?.ig_handle && <span className="text-white/40 font-normal"> · {e.participant.ig_handle}</span>}
                  </p>
                  <p className="text-xs text-white/50 mt-0.5">
                    {e.requirement?.title} · intento {e.attempt_no} · {formatDateTime(e.created_at)}
                  </p>
                  {e.status === 'rejected' && e.rejection_reason && (
                    <p className="text-xs text-red-300/80 mt-1">Motivo: {e.rejection_reason}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button type="button" onClick={() => setViewing(e)} className="btn-outline">
                    <HiOutlineEye size={16} />
                    Ver captura
                  </button>
                  {canReview && e.status === 'pending' && (
                    <>
                      <button type="button" disabled={busy} onClick={() => review(e, 'approved')} className="btn-primary" aria-label="Aprobar">
                        <HiOutlineCheck size={16} />
                      </button>
                      <button type="button" disabled={busy} onClick={() => setRejecting(e)} className="btn-outline" aria-label="Rechazar">
                        <HiOutlineXMark size={16} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6 text-sm text-white/50">
          <button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="p-2 rounded-lg hover:bg-white/5 disabled:opacity-30" aria-label="Página anterior">
            <HiOutlineChevronLeft size={16} />
          </button>
          Página {page} de {pages}
          <button type="button" disabled={page >= pages} onClick={() => setPage(p => p + 1)} className="p-2 rounded-lg hover:bg-white/5 disabled:opacity-30" aria-label="Página siguiente">
            <HiOutlineChevronRight size={16} />
          </button>
        </div>
      )}

      {viewing && <EvidenceViewer giveawayId={giveaway.id} evidence={viewing} onClose={() => setViewing(null)} toast={toast} />}
      {rejecting && (
        <RejectForm saving={busy} onCancel={() => setRejecting(null)} onSubmit={reason => review(rejecting, 'rejected', reason)} />
      )}
    </SectionCard>
  )
}
