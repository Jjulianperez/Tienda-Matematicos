'use client'

import { useState } from 'react'
import { HiOutlineCheckCircle, HiOutlineXCircle } from 'react-icons/hi2'
import FormModal from '@/components/admin/FormModal'
import { TextInput, TextArea, FormActions, SectionCard, DateTimeField } from '@/components/admin/fields'
import { unlockAudio } from '@/lib/giveaways/sound'
import { Confirm } from '@/components/Modal'
import { formatDateTime } from '@/lib/format'
import {
  adminFetch,
  errorMessage,
  fromLocalInput,
  publishChecklist,
  STATUS_META,
  FORMAT_LABELS,
} from '@/lib/giveaways/ui'

function Stat({ label, value, highlight }) {
  return (
    <div className={`rounded-xl py-4 text-center ${highlight ? 'bg-primary/15 border border-primary/30' : 'bg-white/5'}`}>
      <dd className="text-2xl font-semibold text-white">{value}</dd>
      <dt className="text-[0.65rem] uppercase tracking-widest text-white/40 mt-0.5">{label}</dt>
    </div>
  )
}

// Un modal con un campo de motivo (y, opcionalmente, una fecha).
function ReasonForm({ title, subtitle, submitText, withDate, saving, onSubmit, onCancel }) {
  const [reason, setReason] = useState('')
  const [endsAt, setEndsAt] = useState('')
  return (
    <FormModal
      open
      onClose={onCancel}
      title={title}
      subtitle={subtitle}
      footer={<FormActions formId="reason-form" onCancel={onCancel} saving={saving} submitText={submitText} />}
    >
      <form
        id="reason-form"
        onSubmit={event => {
          event.preventDefault()
          onSubmit({ reason, ends_at: endsAt })
        }}
        className="space-y-5 px-6 sm:px-8 py-6"
      >
        {withDate && (
          <DateTimeField label="Nueva fecha de cierre" required value={endsAt} onChange={setEndsAt} />
        )}
        <TextArea
          label="Motivo"
          required
          value={reason}
          onChange={e => setReason(e.target.value)}
          rows={3}
          hint="Queda en el registro de auditoría."
        />
      </form>
    </FormModal>
  )
}

// Ejecutar el sorteo exige escribir el enlace: evita ejecutarlo por un toque
// accidental y deja claro cuál es.
function DrawForm({ giveaway, tickets, saving, onSubmit, onCancel }) {
  const [typed, setTyped] = useState('')
  const matches = typed.trim() === giveaway.slug
  return (
    <FormModal
      open
      onClose={onCancel}
      title="Ejecutar el sorteo"
      subtitle={giveaway.title}
      footer={
        <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
          <button type="button" onClick={onCancel} className="btn-ghost">Cancelar</button>
          <button type="button" disabled={!matches || saving} onClick={() => { unlockAudio(); onSubmit(typed.trim()) }} className="btn-primary">
            {saving ? 'Sorteando...' : 'Ejecutar sorteo'}
          </button>
        </div>
      }
    >
      <div className="space-y-4 px-6 sm:px-8 py-6">
        <p className="text-sm text-white/70 leading-relaxed">
          Se sortean <strong>{giveaway.winners_count}</strong> {giveaway.winners_count === 1 ? 'ganador' : 'ganadores'}
          {giveaway.alternates_count > 0 && <> y <strong>{giveaway.alternates_count}</strong> {giveaway.alternates_count === 1 ? 'suplente' : 'suplentes'}</>}
          {' '}entre <strong>{tickets}</strong> tickets. Es definitivo: no se puede repetir ni cambiar el resultado.
        </p>
        <TextInput
          label={`Para confirmar, escribí: ${giveaway.slug}`}
          value={typed}
          onChange={e => setTyped(e.target.value)}
          placeholder={giveaway.slug}
          autoComplete="off"
        />
      </div>
    </FormModal>
  )
}

export default function ActionsPanel({ data, isOwner, onEdit, onChanged, onDrawn, toast }) {
  const { giveaway, requirements, overview } = data
  const [modal, setModal] = useState(null)
  const [busy, setBusy] = useState(false)

  const meta = STATUS_META[giveaway.status] || { label: giveaway.status, cls: 'badge-new' }
  const checklist = giveaway.status === 'draft' ? publishChecklist(giveaway, requirements) : null

  const act = async (body, successMessage, { drawn = false } = {}) => {
    setBusy(true)
    const result = await adminFetch(`/api/giveaways/${giveaway.id}/actions`, { method: 'POST', body })
    setBusy(false)
    if (!result.ok) {
      toast(errorMessage(result), 'error')
      return false
    }
    setModal(null)
    toast(successMessage, 'success')
    if (drawn) onDrawn()
    else onChanged()
    return true
  }

  const remove = async () => {
    setModal(null)
    const result = await adminFetch(`/api/giveaways/${giveaway.id}`, { method: 'DELETE' })
    if (!result.ok) return toast(errorMessage(result, 'No se pudo borrar el sorteo'), 'error')
    toast('Sorteo borrado', 'success')
    onChanged({ deleted: true })
  }

  const status = giveaway.status
  const canCancel = ['draft', 'scheduled', 'active', 'closing', 'ready'].includes(status)

  return (
    <SectionCard title="Estado del sorteo" description={`${FORMAT_LABELS[giveaway.format] || giveaway.format} · ${giveaway.winners_count} ${giveaway.winners_count === 1 ? 'ganador' : 'ganadores'}`}>
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <span className={`badge ${meta.cls}`}>{meta.label}</span>
        <span className="text-xs text-white/40">
          {giveaway.starts_at ? formatDateTime(giveaway.starts_at) : 'Sin fecha'} → {giveaway.ends_at ? formatDateTime(giveaway.ends_at) : 'Sin fecha'}
        </span>
      </div>

      <dl className="grid grid-cols-3 gap-3 mb-6">
        <Stat label="Personas" value={overview?.participants ?? 0} />
        <Stat label="Tickets" value={overview?.tickets ?? 0} />
        <Stat label="Por revisar" value={overview?.pending_evidence ?? 0} highlight={(overview?.pending_evidence ?? 0) > 0} />
      </dl>

      {giveaway.seed_commitment && (
        <p className="text-xs text-white/40 mb-6 break-all">
          Compromiso de la semilla: <span className="font-mono text-white/60">{giveaway.seed_commitment}</span>
        </p>
      )}
      {giveaway.status === 'cancelled' && giveaway.cancelled_reason && (
        <p className="text-sm text-red-300/80 mb-6">Cancelado: {giveaway.cancelled_reason}</p>
      )}

      {checklist && (
        <div className="mb-6 p-4 rounded-xl bg-white/5 border border-white/5">
          <h4 className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-3">Para poder publicar</h4>
          <ul className="space-y-1.5">
            {checklist.items.map(item => (
              <li key={item.label} className={`flex items-center gap-2 text-sm ${item.ok ? 'text-white/70' : 'text-white/50'}`}>
                {item.ok ? <HiOutlineCheckCircle className="text-primary-light" size={16} /> : <HiOutlineXCircle className="text-red-400/80" size={16} />}
                {item.label}
              </li>
            ))}
          </ul>
        </div>
      )}

      {status === 'closing' && (
        <p className="text-sm text-white/60 leading-relaxed mb-6">
          La inscripción cerró. Revisá las evidencias pendientes y, cuando no quede ninguna, congelá la lista de tickets.
        </p>
      )}
      {status === 'ready' && (
        <p className="text-sm text-white/60 leading-relaxed mb-6">
          La lista está congelada ({giveaway.tickets_count} tickets) y su huella es pública. Cuando estés listo, ejecutá el sorteo.
        </p>
      )}
      {status === 'drawing' && (
        <p className="text-sm text-amber-300/80 leading-relaxed mb-6">
          Hay un sorteo en curso que no terminó. Volvé a ejecutarlo para reanudarlo: no se genera otro resultado.
        </p>
      )}

      {isOwner ? (
        <div className="flex flex-wrap gap-3">
          {(status === 'draft' || status === 'scheduled') && (
            <button type="button" onClick={onEdit} className="btn-outline">Editar datos</button>
          )}
          {status === 'draft' && (
            <button type="button" disabled={!checklist.ready} onClick={() => setModal('schedule')} className="btn-primary">Publicar</button>
          )}
          {status === 'closing' && (
            <>
              <button type="button" disabled={(overview?.pending_evidence ?? 0) > 0} onClick={() => setModal('freeze')} className="btn-primary">Congelar lista</button>
              <button type="button" onClick={() => setModal('extend')} className="btn-outline">Extender plazo</button>
            </>
          )}
          {(status === 'ready' || status === 'drawing') && (
            <button type="button" onClick={() => setModal('draw')} className="btn-primary">
              {status === 'drawing' ? 'Reanudar sorteo' : 'Ejecutar sorteo'}
            </button>
          )}
          {canCancel && <button type="button" onClick={() => setModal('cancel')} className="btn-ghost">Cancelar sorteo</button>}
          {(status === 'draft' || status === 'cancelled') && (
            <button type="button" onClick={() => setModal('delete')} className="btn-ghost">Borrar</button>
          )}
        </div>
      ) : (
        <p className="text-xs text-white/40">Solo el propietario puede publicar, congelar, ejecutar o cancelar. Vos podés revisar evidencias.</p>
      )}

      <Confirm
        isOpen={modal === 'schedule'}
        onClose={() => setModal(null)}
        title="¿Publicar el sorteo?"
        message="Se genera la semilla secreta y se publica su huella. Después de publicar no se pueden cambiar las reglas, los ganadores ni las bases."
        confirmText={busy ? 'Publicando...' : 'Publicar'}
        onConfirm={() => act({ action: 'schedule' }, 'Sorteo publicado')}
      />
      <Confirm
        isOpen={modal === 'freeze'}
        onClose={() => setModal(null)}
        title="¿Congelar la lista de tickets?"
        message={`Se congelan ${overview?.tickets ?? 0} tickets y se publica su huella. Desde ahí no se pueden agregar, cambiar ni borrar participaciones.`}
        confirmText={busy ? 'Congelando...' : 'Congelar'}
        onConfirm={() => act({ action: 'freeze' }, 'Lista congelada')}
      />
      <Confirm
        isOpen={modal === 'delete'}
        onClose={() => setModal(null)}
        title="¿Borrar el sorteo?"
        message="Se borra el sorteo con sus requisitos. No se puede deshacer."
        confirmText="Borrar"
        type="warning"
        onConfirm={remove}
      />

      {modal === 'cancel' && (
        <ReasonForm
          title="Cancelar el sorteo"
          subtitle="No se puede reactivar"
          submitText="Cancelar sorteo"
          saving={busy}
          onCancel={() => setModal(null)}
          onSubmit={({ reason }) => act({ action: 'cancel', reason }, 'Sorteo cancelado')}
        />
      )}
      {modal === 'extend' && (
        <ReasonForm
          title="Extender el plazo"
          subtitle="Reabre las inscripciones hasta la nueva fecha"
          submitText="Extender"
          withDate
          saving={busy}
          onCancel={() => setModal(null)}
          onSubmit={({ reason, ends_at: endsAt }) => act({ action: 'extend', reason, ends_at: fromLocalInput(endsAt) }, 'Plazo extendido')}
        />
      )}
      {modal === 'draw' && (
        <DrawForm
          giveaway={giveaway}
          tickets={giveaway.tickets_count ?? overview?.tickets ?? 0}
          saving={busy}
          onCancel={() => setModal(null)}
          onSubmit={slug => act({ action: 'draw', confirm_slug: slug }, 'Sorteo realizado', { drawn: true })}
        />
      )}
    </SectionCard>
  )
}
