'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import GeometricDecor from '@/components/ui/GeometricDecor'
import { formatDateTime } from '@/lib/format'
import { publicFetch, storeToken, errorMessage } from '@/lib/giveaways/ui'

const inputCls = 'input-dark'
const labelCls = 'block text-xs font-semibold uppercase tracking-widest text-white/40 mb-2'

function Field({ label, error, hint, children }) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      {children}
      {hint && !error && <span className="block text-xs text-white/30 mt-2 leading-relaxed">{hint}</span>}
      {error && <span className="block text-xs text-red-400 mt-2" role="alert">{error}</span>}
    </label>
  )
}

export default function ParticiparPage() {
  const { slug } = useParams()
  const router = useRouter()
  const [giveaway, setGiveaway] = useState(null)
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    email: '',
    ig_handle: '',
    accept_terms: false,
    marketing_consent: false,
  })

  // La clave de idempotencia se crea una sola vez por formulario: si la
  // petición se repite (doble toque, corte de red), el servidor devuelve la
  // misma participación y no crea otra persona.
  const keyRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    publicFetch(`/api/giveaways/public/${slug}`).then(result => {
      if (cancelled) return
      if (result.ok) setGiveaway(result.data.giveaway)
      else setMissing(true)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [slug])

  const set = key => e => setForm(prev => ({ ...prev, [key]: e.target.value }))
  const toggle = key => e => setForm(prev => ({ ...prev, [key]: e.target.checked }))

  const handleSubmit = async event => {
    event.preventDefault()
    setSending(true)
    setError('')
    setFieldErrors({})

    if (!keyRef.current) keyRef.current = crypto.randomUUID()

    const result = await publicFetch(`/api/giveaways/public/${slug}/enter`, {
      method: 'POST',
      body: { ...form, terms_version: giveaway.terms_version, idempotency_key: keyRef.current },
    })
    setSending(false)

    if (!result.ok) {
      if (result.data?.fields) setFieldErrors(result.data.fields)
      setError(errorMessage(result, 'No se pudo completar la inscripción'))
      return
    }

    storeToken(slug, result.data.token)
    router.push(`/sorteos/${slug}/participacion/${result.data.token}`)
  }

  const closed = giveaway && giveaway.status !== 'active'

  return (
    <>
      <Header />
      <main className="flex-1 bg-carbon min-h-screen relative">
        <GeometricDecor variant="blueprint" className="absolute inset-0 w-full h-full opacity-30" />
        <div className="relative container-page py-14 sm:py-20 max-w-xl">
          <Link href={`/sorteos/${slug}`} className="text-sm text-white/50 hover:text-white">← Volver al sorteo</Link>

          {loading ? (
            <div className="flex justify-center py-24">
              <span className="animate-spin border-2 border-white/20 border-t-primary w-8 h-8 rounded-full" />
            </div>
          ) : missing ? (
            <p className="card-dark p-6 text-sm text-white/70 mt-10">No encontramos este sorteo.</p>
          ) : closed ? (
            <div className="card-dark p-6 mt-10">
              <h1 className="font-display font-semibold text-white text-xl">{giveaway.title}</h1>
              <p className="text-sm text-white/60 mt-3 leading-relaxed">
                {giveaway.status === 'scheduled'
                  ? `Las inscripciones abren el ${formatDateTime(giveaway.starts_at)}.`
                  : 'Las inscripciones de este sorteo ya cerraron.'}
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-8 space-y-6" noValidate>
              <header>
                <h1 className="font-display font-bold text-3xl text-white leading-tight">Participar</h1>
                <p className="text-primary-light mt-2">{giveaway.title}</p>
                <p className="text-sm text-white/40 mt-3 leading-relaxed">
                  Completá tus datos. Después vas a ver qué requisitos cumplir para conseguir tus oportunidades.
                </p>
              </header>

              <Field label="Nombre y apellido" error={fieldErrors.full_name}>
                <input className={inputCls} value={form.full_name} onChange={set('full_name')} autoComplete="name" required />
              </Field>

              <Field label="Teléfono" error={fieldErrors.phone_normalized} hint="Con código de área. Lo usamos para avisarte si ganás.">
                <input className={inputCls} value={form.phone} onChange={set('phone')} type="tel" autoComplete="tel" placeholder="11 5555-4444" required />
              </Field>

              <Field label="Usuario de Instagram" error={fieldErrors.ig_handle_normalized}>
                <input className={inputCls} value={form.ig_handle} onChange={set('ig_handle')} placeholder="@tuusuario" autoCapitalize="none" required />
              </Field>

              <Field label="Email (opcional)" error={fieldErrors.email}>
                <input className={inputCls} value={form.email} onChange={set('email')} type="email" autoComplete="email" />
              </Field>

              <div className="space-y-3">
                <label className="flex items-start gap-3 text-sm text-white/70 leading-relaxed cursor-pointer">
                  <input type="checkbox" checked={form.accept_terms} onChange={toggle('accept_terms')} className="mt-1 accent-[var(--color-primary)]" />
                  <span>
                    Leí y acepto las{' '}
                    <Link href={`/sorteos/${slug}`} target="_blank" className="text-primary-light underline">bases y condiciones</Link>.
                  </span>
                </label>
                {fieldErrors.accept_terms && <p className="text-xs text-red-400" role="alert">{fieldErrors.accept_terms}</p>}

                <label className="flex items-start gap-3 text-sm text-white/50 leading-relaxed cursor-pointer">
                  <input type="checkbox" checked={form.marketing_consent} onChange={toggle('marketing_consent')} className="mt-1 accent-[var(--color-primary)]" />
                  <span>Quiero recibir novedades y promociones de MateMáticos (opcional).</span>
                </label>
              </div>

              {error && <p className="text-sm text-red-400" role="alert">{error}</p>}

              <button type="submit" disabled={sending} className="btn-primary w-full">
                {sending ? 'Enviando...' : 'Participar'}
              </button>
            </form>
          )}
        </div>
      </main>
      <Footer />
    </>
  )
}
