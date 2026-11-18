'use client'

import { useState } from 'react'
import FormModal from '@/components/admin/FormModal'
import { TextInput, TextArea, Select, FormActions } from '@/components/admin/fields'
import {
  adminFetch,
  errorMessage,
  toLocalInput,
  fromLocalInput,
  lockedFields,
  FORMAT_LABELS,
} from '@/lib/giveaways/ui'

// Alta y edición de un sorteo. Al crear queda en borrador; publicarlo es una
// acción aparte. Al editar se manda la versión leída: si alguien guardó antes,
// la API responde 409 y se pide recargar.
export default function GiveawayFormModal({ giveaway, onSaved, onCancel, onError }) {
  const isEdit = Boolean(giveaway)
  const locked = isEdit ? lockedFields(giveaway.status) : {}
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    title: giveaway?.title || '',
    slug: giveaway?.slug || '',
    prize_name: giveaway?.prize_name || '',
    prize_description: giveaway?.prize_description || '',
    prize_image_url: giveaway?.prize_image_url || '',
    description: giveaway?.description || '',
    format: giveaway?.format || 'ruleta',
    starts_at: toLocalInput(giveaway?.starts_at),
    ends_at: toLocalInput(giveaway?.ends_at),
    winners_count: giveaway?.winners_count ?? 1,
    alternates_count: giveaway?.alternates_count ?? 0,
    max_opportunities: giveaway?.max_opportunities ?? 2,
    terms_text: giveaway?.terms_text || '',
  })

  const set = key => e => setForm(prev => ({ ...prev, [key]: e.target.value }))

  const handleSubmit = async event => {
    event.preventDefault()
    setSaving(true)
    try {
      const payload = {
        title: form.title,
        prize_name: form.prize_name,
        prize_description: form.prize_description,
        prize_image_url: form.prize_image_url,
        description: form.description,
        format: form.format,
        starts_at: fromLocalInput(form.starts_at),
        ends_at: fromLocalInput(form.ends_at),
        winners_count: Number(form.winners_count),
        alternates_count: Number(form.alternates_count),
        max_opportunities: Number(form.max_opportunities),
        terms_text: form.terms_text,
      }
      if (!isEdit || !locked.slug) payload.slug = form.slug

      const result = isEdit
        ? await adminFetch(`/api/giveaways/${giveaway.id}`, {
            method: 'PATCH',
            body: { ...payload, version: giveaway.version },
          })
        : await adminFetch('/api/giveaways', { method: 'POST', body: payload })

      if (!result.ok) throw new Error(errorMessage(result, 'No se pudo guardar el sorteo'))
      onSaved(isEdit ? 'Sorteo actualizado' : 'Sorteo creado como borrador', result.data)
    } catch (error) {
      onError(error.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormModal
      open
      onClose={onCancel}
      title={isEdit ? 'Editar sorteo' : 'Nuevo sorteo'}
      subtitle={isEdit ? giveaway.title : 'Se crea como borrador: todavía no lo ve nadie'}
      maxWidth="max-w-3xl"
      footer={
        <FormActions
          formId="giveaway-form"
          onCancel={onCancel}
          saving={saving}
          submitText={isEdit ? 'Guardar cambios' : 'Crear borrador'}
        />
      }
    >
      <form id="giveaway-form" onSubmit={handleSubmit} className="space-y-5 px-6 sm:px-8 py-6">
        {isEdit && giveaway.status !== 'draft' && (
          <p className="text-xs text-white/50 bg-white/5 border border-white/10 rounded-xl p-3 leading-relaxed">
            Las reglas del sorteo (enlace, ganadores, oportunidades y bases) no se pueden cambiar
            después de publicarlo.
          </p>
        )}

        <TextInput label="Título" required value={form.title} onChange={set('title')} placeholder="Sorteo de verano" />

        <TextInput
          label="Enlace"
          value={form.slug}
          onChange={set('slug')}
          disabled={locked.slug}
          placeholder="sorteo-de-verano"
          hint="Va en la dirección: /sorteos/enlace. Si lo dejás vacío se arma con el título."
        />

        <TextInput label="Premio" required value={form.prize_name} onChange={set('prize_name')} disabled={locked.prize_name} placeholder="Kit matero completo" />
        <TextArea label="Descripción del premio" value={form.prize_description} onChange={set('prize_description')} rows={2} />
        <TextInput
          label="Imagen del premio (dirección https)"
          value={form.prize_image_url}
          onChange={set('prize_image_url')}
          placeholder="https://res.cloudinary.com/..."
        />
        <TextArea label="Descripción del sorteo" value={form.description} onChange={set('description')} rows={3} />

        <div className="grid sm:grid-cols-2 gap-5">
          <TextInput label="Inicio" type="datetime-local" required value={form.starts_at} onChange={set('starts_at')} disabled={locked.starts_at} />
          <TextInput label="Cierre" type="datetime-local" required value={form.ends_at} onChange={set('ends_at')} disabled={locked.ends_at} />
        </div>

        <div className="grid sm:grid-cols-3 gap-5">
          <TextInput label="Ganadores" type="number" min={1} max={100} required value={form.winners_count} onChange={set('winners_count')} disabled={locked.winners_count} />
          <TextInput label="Suplentes" type="number" min={0} max={100} value={form.alternates_count} onChange={set('alternates_count')} disabled={locked.alternates_count} />
          <Select label="Oportunidades por persona" value={form.max_opportunities} onChange={set('max_opportunities')} disabled={locked.max_opportunities}>
            <option value={1}>1 (solo la inicial)</option>
            <option value={2}>2 (inicial + adicional)</option>
          </Select>
        </div>

        <Select label="Formato visual del sorteo" value={form.format} onChange={set('format')}>
          {Object.entries(FORMAT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </Select>

        <TextArea
          label="Bases y condiciones"
          value={form.terms_text}
          onChange={set('terms_text')}
          disabled={locked.terms_text}
          rows={8}
          hint="Obligatorias para publicar. Quien participa las acepta y queda registrada la versión."
        />
      </form>
    </FormModal>
  )
}
