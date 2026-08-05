'use client'

export const inputCls =
  "w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"

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
