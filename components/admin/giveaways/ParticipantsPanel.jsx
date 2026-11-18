'use client'

import { useState, useEffect } from 'react'
import { HiOutlineMagnifyingGlass, HiOutlineChevronLeft, HiOutlineChevronRight } from 'react-icons/hi2'
import { SectionCard } from '@/components/admin/fields'
import { formatDateTime } from '@/lib/format'
import { adminFetch, errorMessage } from '@/lib/giveaways/ui'

const PER_PAGE = 25

export default function ParticipantsPanel({ giveaway, toast }) {
  const [data, setData] = useState({ participants: [], total: 0 })
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)

  // Sin esto se dispara una petición por cada tecla.
  useEffect(() => {
    const timer = setTimeout(() => { setQuery(search.trim()); setPage(1) }, 350)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    // Con la búsqueda se pueden solapar cargas: la vieja no tiene que pisar a la nueva.
    let cancelled = false

    const fetchParticipants = async () => {
      const params = new URLSearchParams({ page: String(page), perPage: String(PER_PAGE) })
      if (query) params.set('q', query)
      const result = await adminFetch(`/api/giveaways/${giveaway.id}/participants?${params}`)
      if (cancelled) return
      if (result.ok) setData(result.data)
      else toast(errorMessage(result, 'No se pudieron cargar los participantes'), 'error')
      setLoading(false)
    }

    fetchParticipants()
    return () => { cancelled = true }
  }, [giveaway.id, page, query, toast])

  const pages = Math.max(Math.ceil(data.total / PER_PAGE), 1)

  return (
    <SectionCard title="Participantes" description={`${data.total} ${data.total === 1 ? 'persona' : 'personas'} inscriptas`}>
      <div className="relative mb-5 max-w-sm">
        <HiOutlineMagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={16} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre, Instagram, teléfono o email..."
          className="input-dark pl-11"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <span className="animate-spin border-2 border-white/20 border-t-primary w-7 h-7 rounded-full" />
        </div>
      ) : data.participants.length === 0 ? (
        <p className="text-sm text-white/40 py-8 text-center">No hay participantes todavía.</p>
      ) : (
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-sm min-w-[40rem]">
            <thead>
              <tr className="text-left text-[0.65rem] uppercase tracking-widest text-white/40">
                <th className="px-2 pb-3 font-semibold">Nombre</th>
                <th className="px-2 pb-3 font-semibold">Instagram</th>
                <th className="px-2 pb-3 font-semibold">Contacto</th>
                <th className="px-2 pb-3 font-semibold">Tickets</th>
                <th className="px-2 pb-3 font-semibold">Alta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {data.participants.map(p => (
                <tr key={p.id}>
                  <td className="px-2 py-3 text-white">
                    {p.full_name}
                    {p.customer_id && <span className="ml-2 text-[0.65rem] uppercase tracking-widest text-primary-light/70">cliente</span>}
                  </td>
                  <td className="px-2 py-3 text-white/60">{p.ig_handle || '—'}</td>
                  <td className="px-2 py-3 text-white/60">
                    <span className="block">{p.phone_display}</span>
                    {p.email && <span className="block text-xs text-white/40">{p.email}</span>}
                  </td>
                  <td className="px-2 py-3 text-white/70">
                    {p.tickets.length === 0 ? <span className="text-white/30">—</span> : p.tickets.map(t => `#${t.ticket_number}`).join(', ')}
                  </td>
                  <td className="px-2 py-3 text-white/40 whitespace-nowrap">{formatDateTime(p.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
    </SectionCard>
  )
}
