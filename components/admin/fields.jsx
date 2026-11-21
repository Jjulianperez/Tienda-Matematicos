'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { prepareImageForUpload } from '@/lib/image-resize'

// [color-scheme:dark] hace que el navegador dibuje en oscuro lo que no controla
// el CSS: la lista desplegable de los select (sin esto salía blanca con texto
// blanco) y el calendario de los campos de fecha. El texto de los campos es de
// 16 px (lo hereda del body): con menos, Safari en iPhone hace zoom al enfocar.
export const inputCls =
  "w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 [color-scheme:dark] focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"

// Etiquetas y ayudas con el contraste suficiente sobre el fondo oscuro: con 30 o
// 40 % de blanco quedaban muy tenues, sobre todo con el sol en un celular.
export const labelCls =
  "block text-xs font-semibold uppercase tracking-widest text-white/55 mb-2"
const hintCls = "block text-xs text-white/50 mt-2 leading-relaxed"

// Etiqueta, campo y ayuda. Con `htmlFor` la etiqueta es un <label> asociado al
// campo (tocarla lo enfoca, y los lectores de pantalla la leen); sin él, un
// texto suelto, como antes. `hintId` permite enlazar la ayuda con aria-describedby.
export function Field({ label, hint, hintId, htmlFor, labelId, required, className, children }) {
  const text = (
    <>
      {label}
      {required && <span className="text-primary-light" aria-hidden="true"> *</span>}
    </>
  )
  return (
    <div className={className}>
      {label && (htmlFor ? (
        <label htmlFor={htmlFor} className={labelCls}>{text}</label>
      ) : (
        <span id={labelId} className={labelCls}>{text}</span>
      ))}
      {children}
      {hint && <span id={hintId} className={hintCls}>{hint}</span>}
    </div>
  )
}

export function TextInput({ label, hint, required, className, id, ...props }) {
  const generated = useId()
  const inputId = id || generated
  const hintId = hint ? `${inputId}-hint` : undefined
  return (
    <Field label={label} hint={hint} hintId={hintId} htmlFor={inputId} required={required}>
      <input
        id={inputId}
        aria-describedby={hintId}
        required={required}
        className={`${inputCls} ${className || ''}`}
        {...props}
      />
    </Field>
  )
}

export function TextArea({ label, hint, required, rows = 3, className, id, ...props }) {
  const generated = useId()
  const inputId = id || generated
  const hintId = hint ? `${inputId}-hint` : undefined
  return (
    <Field label={label} hint={hint} hintId={hintId} htmlFor={inputId} required={required}>
      <textarea
        id={inputId}
        aria-describedby={hintId}
        rows={rows}
        required={required}
        className={`${inputCls} resize-none ${className || ''}`}
        {...props}
      />
    </Field>
  )
}

const CHEVRON_BG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394A86A' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`

export function Select({ label, hint, required, children, className, style, id, ...props }) {
  const generated = useId()
  const selectId = id || generated
  const hintId = hint ? `${selectId}-hint` : undefined
  return (
    <Field label={label} hint={hint} hintId={hintId} htmlFor={selectId} required={required}>
      <select
        id={selectId}
        aria-describedby={hintId}
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
//
// Las tres partes forman un grupo (fieldset con su leyenda). Caben en una sola
// fila solo si el campo mide al menos 21 rem (336 px); en un celular la fecha
// ocupa la primera fila y la hora y los minutos van abajo, mitad y mitad. Se
// decide por el ancho del campo (container query) y no por el de la pantalla,
// así también funciona dentro de una columna angosta de una pantalla ancha.
export function DateTimeField({ label, hint, required, value, onChange, disabled }) {
  const hintId = useId()
  const [date = '', time = ''] = (value || '').split('T')
  const [hour = '', minute = ''] = time.split(':')

  const emit = (nextDate, nextHour, nextMinute) => {
    if (!nextDate && !nextHour && !nextMinute) return onChange('')
    // Si falta la hora o los minutos se completa con 00 para no perder lo que ya se eligió.
    onChange(`${nextDate}T${nextHour || '00'}:${nextMinute || '00'}`)
  }

  // Un fieldset no se achica por debajo de su contenido salvo que se lo pidas (min-w-0).
  return (
    <fieldset className="min-w-0" disabled={disabled} aria-describedby={hintId}>
      <legend className={labelCls}>
        {label}
        {required && <span className="text-primary-light" aria-hidden="true"> *</span>}
      </legend>
      <div className="@container">
        <div className="grid gap-2 @min-[21rem]:grid-cols-[minmax(0,1fr)_auto_auto]">
          <input
            type="date"
            required={required}
            disabled={disabled}
            value={date}
            onChange={e => emit(e.target.value, hour, minute)}
            className={`${inputCls} min-w-0`}
            aria-label="Fecha"
          />
          <div className="grid grid-cols-2 gap-2 @min-[21rem]:contents">
            <select
              disabled={disabled}
              value={hour}
              onChange={e => emit(date, e.target.value, minute)}
              className={`${inputCls} cursor-pointer @min-[21rem]:!w-auto @min-[21rem]:!px-3`}
              aria-label="Hora"
            >
              {!hour && <option value="">hh</option>}
              {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
            <select
              disabled={disabled}
              value={minute}
              onChange={e => emit(date, hour, e.target.value)}
              className={`${inputCls} cursor-pointer @min-[21rem]:!w-auto @min-[21rem]:!px-3`}
              aria-label="Minutos"
            >
              {!minute && <option value="">mm</option>}
              {MINUTES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
      </div>
      <span id={hintId} className={hintCls}>{hint || 'Hora de 24 h: 13:14 es la 1:14 de la tarde.'}</span>
    </fieldset>
  )
}

const MAX_IMAGE_BYTES = 4 * 1024 * 1024

// Elegir una imagen del dispositivo (galería, archivos o cámara en el celular):
// se sube a Cloudinary por /api/upload y el campo guarda la dirección que
// devuelve. onChange recibe la URL (o '' al quitarla).
export function ImageUploadField({ label, hint, value, onChange, onError, disabled }) {
  const [uploading, setUploading] = useState(false)
  const labelId = useId()

  const handleFile = async event => {
    const input = event.target
    const file = input.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      input.value = ''
      return onError?.('El archivo tiene que ser una imagen')
    }
    setUploading(true)
    try {
      // Una foto de la cámara del celular pesa más de lo que acepta el servidor:
      // se achica acá antes de subirla.
      const prepared = await prepareImageForUpload(file)
      if (prepared.size > MAX_IMAGE_BYTES) {
        throw new Error('La imagen pesa más de 4 MB. Elegí una más liviana')
      }
      const body = new FormData()
      body.append('image', prepared)
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

  // El botón "Elegir imagen" es un <label> que envuelve al input de archivo
  // (invisible): tocarlo abre la galería o la cámara. El grupo lleva el nombre del campo.
  return (
    <div role="group" aria-labelledby={labelId}>
      <span id={labelId} className={labelCls}>{label}</span>
      <div className="flex flex-wrap items-center gap-4">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element -- vista previa de una imagen recién subida a Cloudinary.
          <img src={value} alt="Vista previa" className="w-24 h-24 rounded-xl object-cover border border-white/10" />
        ) : (
          <div className="w-24 h-24 rounded-xl border border-dashed border-white/20 flex items-center justify-center text-[11px] text-white/50 text-center px-2">
            Sin imagen
          </div>
        )}
        <div className="flex min-w-0 flex-wrap gap-2">
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
      {hint && <span className={hintCls}>{hint}</span>}
    </div>
  )
}

// Interruptor de encendido/apagado. Es una casilla de verificación de verdad
// (con role="switch"), escondida a la vista, dentro de un <label> que ocupa toda
// la fila: se puede tocar en cualquier parte, se maneja con la barra
// espaciadora y los lectores de pantalla lo anuncian como interruptor.
export function Toggle({ label, hint, checked, onChange }) {
  const id = useId()
  return (
    <label
      htmlFor={id}
      className="flex w-full cursor-pointer items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 p-4 transition-colors hover:border-primary/30 has-[:focus-visible]:border-primary has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/30"
    >
      <span className="min-w-0 text-left">
        <span className="block text-sm font-medium text-white">{label}</span>
        {hint && <span className="block text-xs text-white/50 mt-0.5">{hint}</span>}
      </span>
      <input
        id={id}
        type="checkbox"
        role="switch"
        className="sr-only"
        checked={checked}
        onChange={event => onChange(event.target.checked)}
      />
      <span
        aria-hidden="true"
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-white/10'}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-[22px]' : 'translate-x-0.5'
          }`}
        />
      </span>
    </label>
  )
}

// Barra de pestañas en una sola fila. Si no entran todas, se desliza en
// horizontal y el borde que tiene más pestañas más allá se desvanece (clase
// scroll-fade-x). Cuando la barra es angosta (un celular) se esconden los
// íconos y las pestañas se reparten el ancho, así entran sin desplazarse. La
// decisión es por el ancho de la barra (container query), no el de la pantalla.
export function Tabs({ tabs, active, onChange, className }) {
  const barRef = useRef(null)
  const mounted = useRef(false)

  // Al cambiar de pestaña, la elegida se lleva a la vista dentro de la barra
  // (container: 'nearest' mueve solo la barra, no la página). La primera vez no
  // se toca nada.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      return
    }
    barRef.current
      ?.querySelector('[aria-current="true"]')
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest', container: 'nearest' })
  }, [active])

  // Navegadores sin animaciones por scroll: se marca de qué lado hay más
  // pestañas (more-start / more-end) y el CSS dibuja el desvanecido.
  useEffect(() => {
    const bar = barRef.current
    if (!bar || CSS.supports('animation-timeline', 'scroll()')) return
    const first = bar.firstElementChild
    const last = bar.lastElementChild
    if (!first) return
    const observer = new IntersectionObserver(
      entries => {
        for (const { target, intersectionRatio } of entries) {
          bar.classList.toggle(target === first ? 'more-start' : 'more-end', intersectionRatio < 1)
        }
      },
      { root: bar, threshold: 1, rootMargin: '1px' }
    )
    observer.observe(first)
    observer.observe(last)
    return () => observer.disconnect()
  }, [tabs.length])

  return (
    <div
      ref={barRef}
      className={`scroll-fade-x @container flex border-b border-white/10 overflow-x-auto scrollbar-none @min-[30rem]:gap-1 ${className || ''}`}
    >
      {tabs.map(t => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          aria-current={active === t.id ? 'true' : undefined}
          className={`flex shrink-0 items-center justify-center gap-2 px-2 @min-[30rem]:px-5 @max-[30rem]:grow py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
            active === t.id
              ? 'text-primary-light border-primary'
              : 'text-white/55 border-transparent hover:text-white'
          }`}
        >
          {t.icon && <t.icon size={15} aria-hidden="true" className="@max-[30rem]:hidden" />}
          {t.label}
        </button>
      ))}
    </div>
  )
}

// `flat`: en el celular y dentro de un modal, el recuadro pierde el marco y el
// relleno para que los campos usen todo el ancho (ver .card-flat-sm).
export function SectionCard({ title, description, icon: Icon, className, flat = false, children }) {
  return (
    <section className={`card-dark ${flat ? 'card-flat-sm' : ''} p-6 sm:p-7 ${className || ''}`}>
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
              <p className="text-xs text-white/50 mt-0.5">{description}</p>
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
    // En un celular los dos botones van en una sola fila (Cancelar con el ancho de
    // su texto y el botón principal ocupando el resto): se gana alto para el
    // formulario y el botón principal queda grande y al alcance del pulgar.
    <div className="grid grid-cols-[auto_1fr] gap-3 sm:flex sm:items-center sm:justify-end">
      <button
        type="button"
        onClick={onCancel}
        className="inline-flex min-h-12 items-center justify-center px-5 sm:px-6 py-3 rounded-xl bg-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-colors font-medium"
      >
        {cancelText}
      </button>
      <button
        type="submit"
        form={formId}
        disabled={saving}
        className="inline-flex min-h-12 items-center justify-center gap-2.5 px-5 sm:px-7 py-3 rounded-xl bg-primary hover:bg-primary-dark text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saving && (
          <span className="animate-spin border-2 border-white/30 border-t-white w-4 h-4 rounded-full" />
        )}
        {saving ? 'Guardando...' : submitText}
      </button>
    </div>
  )
}
