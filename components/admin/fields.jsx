'use client'

import { useState } from 'react'

// [color-scheme:dark] hace que el navegador dibuje en oscuro lo que no controla
// el CSS: la lista desplegable de los select (sin esto salía blanca con texto
// blanco) y el calendario de los campos de fecha.
export const inputCls =
  "w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 [color-scheme:dark] focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"

export const labelCls =
  "block text-xs font-semibold uppercase tracking-widest text-white/40 mb-2"

export function Field({ label, hint, required, className, children }) {
  return (
    <div className={className}>
      {label && (
        <span className={labelCls}>
          {label}
          {required && <span className="text-primary-light"> *</span>}
        </span>
      )}
      {children}
      {hint && (
        <span className="block text-xs text-white/30 mt-2 leading-relaxed">{hint}</span>
      )}
    </div>
  )
}

export function TextInput({ label, hint, required, className, ...props }) {
  return (
    <Field label={label} hint={hint} required={required}>
      <input
        required={required}
        className={`${inputCls} ${className || ''}`}
        {...props}
      />
    </Field>
  )
}

export function TextArea({ label, hint, required, rows = 3, className, ...props }) {
  return (
    <Field label={label} hint={hint} required={required}>
      <textarea
        rows={rows}
        required={required}
        className={`${inputCls} resize-none ${className || ''}`}
        {...props}
      />
    </Field>
  )
}

const CHEVRON_BG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394A86A' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`

export function Select({ label, hint, required, children, className, style, ...props }) {
  return (
    <Field label={label} hint={hint} required={required}>
      <select
        required={required}
        className={`${inputCls} cursor-pointer appearance-none bg-no-repeat pr-10 ${className || ''}`}
        style={{
          backgroundImage: CHEVRON_BG,
          backgroundPosition: 'right 0.75rem center',
          backgroundSize: '1rem',
          ...style,
        }}
        {...props}
      >
        {children}
      </select>
    </Field>
  )
}

const pad2 = n => String(n).padStart(2, '0')
const HOURS = Array.from({ length: 24 }, (_, i) => pad2(i))
const MINUTES = Array.from({ length: 60 }, (_, i) => pad2(i))

// Fecha y hora en formato 24 h. <input type="datetime-local"> muestra 12 h con
// a. m./p. m. según el idioma del navegador y no se puede cambiar desde la
// página, así que la fecha va en su campo y la hora en dos listas (00–23 y
// 00–59). El valor sigue siendo "AAAA-MM-DDTHH:mm", igual que antes.
export function DateTimeField({ label, hint, required, value, onChange, disabled }) {
  const [date = '', time = ''] = (value || '').split('T')
  const [hour = '', minute = ''] = time.split(':')

  const emit = (nextDate, nextHour, nextMinute) => {
    if (!nextDate && !nextHour && !nextMinute) return onChange('')
    // Si falta la hora o los minutos se completa con 00 para no perder lo que ya se eligió.
    onChange(`${nextDate}T${nextHour || '00'}:${nextMinute || '00'}`)
  }

  return (
    <Field label={label} hint={hint} required={required}>
      <div className="grid grid-cols-[1fr_auto_auto] gap-2">
        <input
          type="date"
          required={required}
          disabled={disabled}
          value={date}
          onChange={e => emit(e.target.value, hour, minute)}
          className={inputCls}
          aria-label={`${label}: fecha`}
        />
        <select
          disabled={disabled}
          value={hour}
          onChange={e => emit(date, e.target.value, minute)}
          className={`${inputCls} !w-auto cursor-pointer`}
          aria-label={`${label}: hora`}
        >
          {!hour && <option value="">hh</option>}
          {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
        </select>
        <select
          disabled={disabled}
          value={minute}
          onChange={e => emit(date, hour, e.target.value)}
          className={`${inputCls} !w-auto cursor-pointer`}
          aria-label={`${label}: minutos`}
        >
          {!minute && <option value="">mm</option>}
          {MINUTES.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
      <span className="block text-xs text-white/30 mt-2">Hora de 24 h: 13:14 es la 1:14 de la tarde.</span>
    </Field>
  )
}

const MAX_IMAGE_BYTES = 4 * 1024 * 1024

// Elegir una imagen del dispositivo (galería, archivos o cámara en el celular):
// se sube a Cloudinary por /api/upload y el campo guarda la dirección que
// devuelve. onChange recibe la URL (o '' al quitarla).
export function ImageUploadField({ label, hint, value, onChange, onError, disabled }) {
  const [uploading, setUploading] = useState(false)

  const handleFile = async event => {
    const input = event.target
    const file = input.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      input.value = ''
      return onError?.('El archivo tiene que ser una imagen')
    }
    if (file.size > MAX_IMAGE_BYTES) {
      input.value = ''
      return onError?.('La imagen pesa más de 4 MB. Elegí una más liviana')
    }

    setUploading(true)
    try {
      const body = new FormData()
      body.append('image', file)
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        body,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.url) throw new Error(data.error || 'No se pudo subir la imagen')
      onChange(data.url)
    } catch (error) {
      onError?.(error.message)
    } finally {
      setUploading(false)
      input.value = ''
    }
  }

  return (
    <Field label={label} hint={hint}>
      <div className="flex flex-wrap items-center gap-4">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element -- vista previa de una imagen recién subida a Cloudinary.
          <img src={value} alt="Vista previa" className="w-24 h-24 rounded-xl object-cover border border-white/10" />
        ) : (
          <div className="w-24 h-24 rounded-xl border border-dashed border-white/15 flex items-center justify-center text-[11px] text-white/30 text-center px-2">
            Sin imagen
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <label
            className={`btn-outline cursor-pointer ${disabled || uploading ? 'opacity-50 pointer-events-none' : ''}`}
          >
            {uploading ? 'Subiendo...' : value ? 'Cambiar imagen' : 'Elegir imagen'}
            <input type="file" accept="image/*" className="sr-only" disabled={disabled || uploading} onChange={handleFile} />
          </label>
          {value && !disabled && (
            <button type="button" onClick={() => onChange('')} className="btn-ghost">
              Quitar
            </button>
          )}
        </div>
      </div>
    </Field>
  )
}

export function Toggle({ label, hint, checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="w-full flex items-center justify-between gap-4 p-4 rounded-xl bg-white/5 border border-white/10 hover:border-primary/30 transition-colors"
    >
      <span className="text-left">
        <span className="block text-sm font-medium text-white">{label}</span>
        {hint && <span className="block text-xs text-white/40 mt-0.5">{hint}</span>}
      </span>
      <span
        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
          checked ? 'bg-primary' : 'bg-white/10'
        }`}
      >
        <span
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-[22px]' : 'translate-x-0.5'
          }`}
        />
      </span>
    </button>
  )
}

export function Tabs({ tabs, active, onChange, className }) {
  return (
    <div
      className={`flex gap-1 border-b border-white/10 overflow-x-auto scrollbar-none ${className || ''}`}
    >
      {tabs.map(t => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={`flex items-center gap-2 px-4 sm:px-5 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
            active === t.id
              ? 'text-primary-light border-primary'
              : 'text-white/40 border-transparent hover:text-white'
          }`}
        >
          {t.icon && <t.icon size={15} />}
          {t.label}
        </button>
      ))}
    </div>
  )
}

export function SectionCard({ title, description, icon: Icon, className, children }) {
  return (
    <section className={`card-dark p-6 sm:p-7 ${className || ''}`}>
      {(title || description) && (
        <div className="flex items-start gap-3 mb-6">
          {Icon && (
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary-light shrink-0">
              <Icon size={18} />
            </div>
          )}
          <div>
            {title && <h3 className="font-display font-semibold text-white">{title}</h3>}
            {description && (
              <p className="text-xs text-white/40 mt-0.5">{description}</p>
            )}
          </div>
        </div>
      )}
      {children}
    </section>
  )
}

export function FormActions({ onCancel, cancelText = 'Cancelar', submitText = 'Guardar', saving = false, formId }) {
  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:justify-end">
      <button
        type="button"
        onClick={onCancel}
        className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-colors font-medium"
      >
        {cancelText}
      </button>
      <button
        type="submit"
        form={formId}
        disabled={saving}
        className="inline-flex items-center justify-center gap-2.5 px-7 py-3 rounded-xl bg-primary hover:bg-primary-dark text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saving && (
          <span className="animate-spin border-2 border-white/30 border-t-white w-4 h-4 rounded-full" />
        )}
        {saving ? 'Guardando...' : submitText}
      </button>
    </div>
  )
}
