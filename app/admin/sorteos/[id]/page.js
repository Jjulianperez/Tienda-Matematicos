'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { HiOutlineChevronLeft } from 'react-icons/hi2'
import AdminLayout from '@/components/admin/AdminLayout'
import { Tabs, SectionCard } from '@/components/admin/fields'
import { useToast, ToastStack } from '@/components/Modal'
import GiveawayFormModal from '@/components/admin/giveaways/GiveawayFormModal'
import ActionsPanel from '@/components/admin/giveaways/ActionsPanel'
import RequirementsPanel from '@/components/admin/giveaways/RequirementsPanel'
import EvidencePanel from '@/components/admin/giveaways/EvidencePanel'
import ParticipantsPanel from '@/components/admin/giveaways/ParticipantsPanel'
import ResultPanel from '@/components/admin/giveaways/ResultPanel'
import { formatDateTime } from '@/lib/format'
import { adminFetch, errorMessage } from '@/lib/giveaways/ui'

const AUDIT_LABELS = {
  giveaway_scheduled: 'Sorteo publicado',
  giveaway_activated: 'Se abrieron las inscripciones',
  giveaway_closing: 'Se cerraron las inscripciones',
  giveaway_extended: 'Se extendió el plazo',
  giveaway_frozen: 'Se congeló la lista de tickets',
  giveaway_cancelled: 'Sorteo cancelado',
  evidence_approved: 'Evidencia aprobada',
  evidence_rejected: 'Evidencia rechazada',
  draw_started: 'Empezó el sorteo',
  draw_completed: 'Sorteo realizado',
  draw_aborted: 'Sorteo interrumpido',
}

function AuditPanel({ audit }) {
  return (
    <SectionCard title="Registro de actividad" description="Quién hizo qué y cuándo. No se puede editar ni borrar.">
      {audit.length === 0 ? (
        <p className="text-sm text-white/40">Todavía no hay actividad.</p>
      ) : (
        <ul className="divide-y divide-white/5">
          {audit.map(entry => (
            <li key={entry.id} className="py-3 flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm text-white/80">
                {AUDIT_LABELS[entry.action] || entry.action}
                {entry.reason && <span className="text-white/40"> — {entry.reason}</span>}
              </span>
              <span className="text-xs text-white/40">{formatDateTime(entry.created_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  )
}

export default function AdminSorteoDetalle() {
  const { id } = useParams()
  const router = useRouter()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('resumen')
  const [editing, setEditing] = useState(false)
  const { toasts, show, dismiss } = useToast()

  // show cambia de identidad en cada render: se guarda en un ref y se le pasa
  // a los hijos una función estable.
  const toastRef = useRef(show)
  useEffect(() => { toastRef.current = show }, [show])
  const toast = useCallback((message, type) => toastRef.current(message, type), [])

  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!localStorage.getItem('token')) {
      router.push('/admin/login')
      return
    }

    // Si se solapan dos cargas, la vieja no tiene que pisar a la nueva.
    let cancelled = false

    const fetchDetail = async () => {
      const result = await adminFetch(`/api/giveaways/${id}`)
      if (cancelled) return
      if (result.status === 401) {
        localStorage.removeItem('token')
        router.push('/admin/login')
        return
      }
      if (!result.ok) {
        toast(errorMessage(result, 'No se pudo cargar el sorteo'), 'error')
        if (result.status === 404) router.push('/admin/sorteos')
        return
      }
      setData(result.data)
      setLoading(false)
    }

    fetchDetail()
    return () => { cancelled = true }
  }, [id, reloadKey, router, toast])

  // Recarga el detalle (después de cualquier acción).
  const load = () => setReloadKey(k => k + 1)

  const handleChanged = options => {
    if (options?.deleted) return router.push('/admin/sorteos')
    load()
  }

  const handleDrawn = () => {
    setTab('resultado')
    load()
  }

  const giveaway = data?.giveaway
  const isOwner = data?.admin_role === 'owner'
  const status = giveaway?.status
  const showResult = ['ready', 'drawing', 'completed'].includes(status) || (data?.draws?.length ?? 0) > 0
  const pending = data?.overview?.pending_evidence ?? 0

  const tabs = [
    { id: 'resumen', label: 'Resumen' },
    { id: 'requisitos', label: 'Requisitos' },
    { id: 'evidencias', label: pending > 0 ? `Evidencias (${pending})` : 'Evidencias' },
    { id: 'participantes', label: 'Participantes' },
    ...(showResult ? [{ id: 'resultado', label: 'Resultado' }] : []),
    { id: 'actividad', label: 'Actividad' },
  ]

  return (
    <AdminLayout title={giveaway?.title || 'Sorteo'}>
      <div className="p-4 sm:p-8 lg:p-10 max-w-5xl">
        <Link href="/admin/sorteos" className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white mb-6">
          <HiOutlineChevronLeft size={16} />
          Todos los sorteos
        </Link>

        {loading || !data ? (
          <div className="flex justify-center py-20">
            <span className="animate-spin border-2 border-white/20 border-t-primary w-8 h-8 rounded-full" />
          </div>
        ) : (
          <>
            <Tabs tabs={tabs} active={tab} onChange={setTab} className="mb-6" />

            {tab === 'resumen' && (
              <ActionsPanel
                data={data}
                isOwner={isOwner}
                onEdit={() => setEditing(true)}
                onChanged={handleChanged}
                onDrawn={handleDrawn}
                toast={toast}
              />
            )}
            {tab === 'requisitos' && (
              <RequirementsPanel
                giveaway={giveaway}
                requirements={data.requirements}
                canEdit={isOwner && ['draft', 'scheduled'].includes(status)}
                onChanged={load}
                toast={toast}
              />
            )}
            {tab === 'evidencias' && (
              <EvidencePanel giveaway={giveaway} canReview={['active', 'closing'].includes(status)} onChanged={load} toast={toast} />
            )}
            {tab === 'participantes' && <ParticipantsPanel giveaway={giveaway} toast={toast} />}
            {tab === 'resultado' && <ResultPanel giveaway={giveaway} winners={data.winners} draws={data.draws} />}
            {tab === 'actividad' && <AuditPanel audit={data.audit} />}
          </>
        )}
      </div>

      {editing && giveaway && (
        <GiveawayFormModal
          giveaway={giveaway}
          onCancel={() => setEditing(false)}
          onError={message => toast(message, 'error')}
          onSaved={message => {
            setEditing(false)
            toast(message, 'success')
            load()
          }}
        />
      )}

      <ToastStack toasts={toasts} onClose={dismiss} />
    </AdminLayout>
  )
}
