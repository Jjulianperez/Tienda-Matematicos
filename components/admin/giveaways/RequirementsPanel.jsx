'use client'

import { useState } from 'react'
import { HiOutlinePlus, HiOutlinePencilSquare, HiOutlineTrash } from 'react-icons/hi2'
import FormModal from '@/components/admin/FormModal'
import { TextInput, TextArea, Select, FormActions, SectionCard } from '@/components/admin/fields'
import { Confirm } from '@/components/Modal'
import { adminFetch, errorMessage, KIND_LABELS, SLOT_LABELS } from '@/lib/giveaways/ui'

function RequirementForm({ giveaway, requirement, onSaved, onCancel, onError }) {
  const isEdit = Boolean(requirement)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    slot: requirement?.slot ?? 1,
    kind: requirement?.kind || 'evidence_upload',
    title: requirement?.title || '',
    instructions: requirement?.instructions || '',
  })
  const set = key => e => setForm(prev => ({ ...prev, [key]: e.target.value }))

  const handleSubmit = async event => {
    event.preventDefault()
    setSaving(true)
    const result = await adminFetch(
      isEdit
        ? `/api/giveaways/${giveaway.id}/requirements/${requirement.id}`
        : `/api/giveaways/${giveaway.id}/requirements`,
      {
        method: isEdit ? 'PATCH' : 'POST',
        body: { ...form, slot: Number(form.slot) },
      }
    )
    setSaving(false)
    if (!result.ok) return onError(errorMessage(result, 'No se pudo guardar el requisito'))
    onSaved(isEdit ? 'Requisito actualizado' : 'Requisito agregado')
  }

  return (
    <FormModal
      open
      onClose={onCancel}
      title={isEdit ? 'Editar requisito' : 'Nuevo requisito'}
      subtitle="Lo que tiene que hacer una persona para conseguir una oportunidad"
      footer={
        <FormActions formId="requirement-form" onCancel={onCancel} saving={saving} submitText={isEdit ? 'Guardar' : 'Agregar'} />
      }
    >
      <form id="requirement-form" onSubmit={handleSubmit} className="space-y-5 px-6 sm:px-8 py-6">
        <Select
          label="Oportunidad que otorga"
          value={form.slot}
          onChange={set('slot')}
          hint="Una oportunidad se consigue cuando se cumplen TODOS sus requisitos. La segunda exige tener la primera."
        >
          {Object.entries(SLOT_LABELS)
            .filter(([slot]) => Number(slot) <= giveaway.max_opportunities)
            .map(([slot, label]) => (
              <option key={slot} value={slot}>{label}</option>
            ))}
        </Select>

        <Select
          label="Cómo se cumple"
          value={form.kind}
          onChange={set('kind')}
          hint="Con captura, un administrador la aprueba o la rechaza. Las demás quedan registradas pero no se verifican."
        >
          {Object.entries(KIND_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </Select>

        <TextInput label="Título" required value={form.title} onChange={set('title')} placeholder="Seguir a @matematicos en Instagram" />
        <TextArea label="Instrucciones" value={form.instructions} onChange={set('instructions')} rows={3} placeholder="Subí una captura donde se vea que seguís la cuenta." />
      </form>
    </FormModal>
  )
}

export default function RequirementsPanel({ giveaway, requirements, canEdit, onChanged, toast }) {
  const [form, setForm] = useState({ open: false, requirement: null })
  const [removing, setRemoving] = useState(null)

  const remove = async () => {
    const target = removing
    setRemoving(null)
    const result = await adminFetch(`/api/giveaways/${giveaway.id}/requirements/${target.id}`, { method: 'DELETE' })
    if (!result.ok) return toast(errorMessage(result, 'No se pudo borrar el requisito'), 'error')
    toast('Requisito borrado', 'success')
    onChanged()
  }

  const slots = [1, 2].filter(s => s <= giveaway.max_opportunities)

  return (
    <SectionCard
      title="Requisitos"
      description={
        canEdit
          ? 'Se pueden editar hasta que el sorteo se activa.'
          : 'Ya no se pueden editar: el sorteo está en marcha o terminó.'
      }
    >
      <div className="space-y-6">
        {slots.map(slot => {
          const items = requirements.filter(r => r.slot === slot)
          return (
            <div key={slot}>
              <h4 className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-3">{SLOT_LABELS[slot]}</h4>
              {items.length === 0 ? (
                <p className="text-sm text-white/40">
                  {slot === 1 ? 'Falta al menos un requisito para poder publicar.' : 'Sin requisitos: nadie podrá conseguir una segunda oportunidad.'}
                </p>
              ) : (
                <ul className="space-y-2">
                  {items.map(r => (
                    <li key={r.id} className="flex items-start justify-between gap-3 p-4 rounded-xl bg-white/5 border border-white/5">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white">{r.title}</p>
                        <p className="text-xs text-primary-light/80 mt-0.5">{KIND_LABELS[r.kind]}</p>
                        {r.instructions && <p className="text-xs text-white/50 mt-1.5 leading-relaxed">{r.instructions}</p>}
                      </div>
                      {canEdit && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button type="button" onClick={() => setForm({ open: true, requirement: r })} className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/5" aria-label="Editar requisito">
                            <HiOutlinePencilSquare size={16} />
                          </button>
                          <button type="button" onClick={() => setRemoving(r)} className="p-2 rounded-lg text-white/50 hover:text-red-400 hover:bg-red-500/10" aria-label="Borrar requisito">
                            <HiOutlineTrash size={16} />
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}

        {canEdit && (
          <button type="button" onClick={() => setForm({ open: true, requirement: null })} className="btn-outline">
            <HiOutlinePlus size={16} />
            Agregar requisito
          </button>
        )}
      </div>

      {form.open && (
        <RequirementForm
          giveaway={giveaway}
          requirement={form.requirement}
          onCancel={() => setForm({ open: false, requirement: null })}
          onError={message => toast(message, 'error')}
          onSaved={message => {
            setForm({ open: false, requirement: null })
            toast(message, 'success')
            onChanged()
          }}
        />
      )}

      <Confirm
        isOpen={Boolean(removing)}
        onClose={() => setRemoving(null)}
        title="¿Borrar el requisito?"
        message={removing ? `Se borra "${removing.title}".` : ''}
        confirmText="Borrar"
        type="warning"
        onConfirm={remove}
      />
    </SectionCard>
  )
}
