'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { HiOutlinePlus, HiOutlineGift, HiOutlineArrowPath } from 'react-icons/hi2'
import AdminLayout from '@/components/admin/AdminLayout'
import GiveawayFormModal from '@/components/admin/giveaways/GiveawayFormModal'
import { useToast, ToastStack } from '@/components/Modal'
import { formatDateTime } from '@/lib/format'
import { adminFetch, errorMessage, STATUS_META, FORMAT_LABELS } from '@/lib/giveaways/ui'

export default function AdminSorteos() {
  const router = useRouter()
  const [giveaways, setGiveaways] = useState([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const { toasts, show, dismiss } = useToast()

  const [reloadKey, setReloadKey] = useState(0)

  // show cambia de identidad en cada render; el ref evita que el efecto de
  // carga se dispare en loop.
  const toastRef = useRef(show)
  useEffect(() => { toastRef.current = show }, [show])

  useEffect(() => {
    if (!localStorage.getItem('token')) {
      router.push('/admin/login')
      return
    }

    // Si se solapan dos cargas, la vieja no tiene que pisar a la nueva.
    let cancelled = false

    const fetchGiveaways = async () => {
      const result = await adminFetch('/api/giveaways')
      if (cancelled) return
      if (result.status === 401) {
        localStorage.removeItem('token')
        router.push('/admin/login')
        return
      }
      if (!result.ok) {
        toastRef.current(errorMessage(result, 'No se pudieron cargar los sorteos'), 'error')
      } else {
        setGiveaways(Array.isArray(result.data) ? result.data : [])
      }
      setLoading(false)
    }

    fetchGiveaways()
    return () => { cancelled = true }
  }, [reloadKey, router])

  const reload = () => {
    setLoading(true)
    setReloadKey(k => k + 1)
  }

  const handleSaved = (message, created) => {
    setFormOpen(false)
    toastRef.current(message, 'success')
    if (created?.id) router.push(`/admin/sorteos/${created.id}`)
    else reload()
  }

  return (
    <AdminLayout title="Sorteos">
      <div className="p-4 sm:p-8 lg:p-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <p className="text-sm text-white/50 max-w-xl leading-relaxed">
            Sorteos públicos con requisitos revisados a mano y resultado verificable. Cada sorteo
            arranca como borrador.
          </p>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={reload}
              className="btn-outline"
              aria-label="Actualizar la lista"
            >
              <HiOutlineArrowPath size={16} />
            </button>
            <button type="button" onClick={() => setFormOpen(true)} className="btn-primary">
              <HiOutlinePlus size={16} />
              Nuevo sorteo
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <span className="animate-spin border-2 border-white/20 border-t-primary w-8 h-8 rounded-full" />
          </div>
        ) : giveaways.length === 0 ? (
          <div className="card-dark p-10 text-center">
            <HiOutlineGift size={36} className="mx-auto text-primary-light/60" />
            <h2 className="font-display font-semibold text-white mt-4">Todavía no hay sorteos</h2>
            <p className="text-sm text-white/50 mt-2">Creá el primero para empezar.</p>
            <button type="button" onClick={() => setFormOpen(true)} className="btn-primary mt-6">
              <HiOutlinePlus size={16} />
              Nuevo sorteo
            </button>
          </div>
        ) : (
          <ul className="grid gap-4 lg:grid-cols-2">
            {giveaways.map(g => {
              const meta = STATUS_META[g.status] || { label: g.status, cls: 'badge-new' }
              return (
                <li key={g.id}>
                  <Link href={`/admin/sorteos/${g.id}`} className="card-dark p-5 sm:p-6 block h-full">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="font-display font-semibold text-white truncate">{g.title}</h2>
                        <p className="text-sm text-white/50 truncate mt-0.5">{g.prize_name}</p>
                      </div>
                      <span className={`badge ${meta.cls} shrink-0`}>{meta.label}</span>
                    </div>

                    <p className="text-xs text-white/40 mt-4">
                      {g.starts_at ? formatDateTime(g.starts_at) : 'Sin fecha'} → {g.ends_at ? formatDateTime(g.ends_at) : 'Sin fecha'}
                      {' · '}{FORMAT_LABELS[g.format] || g.format}
                    </p>

                    <dl className="grid grid-cols-3 gap-3 mt-5 text-center">
                      <div className="rounded-xl bg-white/5 py-3">
                        <dd className="text-lg font-semibold text-white">{g.participants}</dd>
                        <dt className="text-[0.65rem] uppercase tracking-widest text-white/40">Personas</dt>
                      </div>
                      <div className="rounded-xl bg-white/5 py-3">
                        <dd className="text-lg font-semibold text-white">{g.tickets}</dd>
                        <dt className="text-[0.65rem] uppercase tracking-widest text-white/40">Tickets</dt>
                      </div>
                      <div className={`rounded-xl py-3 ${g.pending_evidence > 0 ? 'bg-primary/15 border border-primary/30' : 'bg-white/5'}`}>
                        <dd className="text-lg font-semibold text-white">{g.pending_evidence}</dd>
                        <dt className="text-[0.65rem] uppercase tracking-widest text-white/40">Por revisar</dt>
                      </div>
                    </dl>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {formOpen && (
        <GiveawayFormModal
          onSaved={handleSaved}
          onCancel={() => setFormOpen(false)}
          onError={message => toastRef.current(message, 'error')}
        />
      )}

      <ToastStack toasts={toasts} onClose={dismiss} />
    </AdminLayout>
  )
}
