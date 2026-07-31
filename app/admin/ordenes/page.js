'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { HiOutlineCheckCircle, HiOutlineXCircle, HiOutlineMagnifyingGlass } from 'react-icons/hi2'
import AdminLayout from '@/components/admin/AdminLayout'

const STATUS = {
  pending: { label: 'Pendiente', cls: 'badge-celeste' },
  confirmed: { label: 'Confirmada', cls: 'badge-stock' },
  cancelled: { label: 'Cancelada', cls: 'badge-sinstock' },
}

export default function AdminOrdenes() {
  const [orders, setOrders] = useState([])
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const router = useRouter()

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/admin/login')
      return
    }

    fetch('/api/orders', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.json())
      .then(setOrders)
      .catch(() => {})
  }, [router])

  const handleStatus = async (id, status) => {
    const token = localStorage.getItem('token')
    await fetch(`/api/orders/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status }),
    })

    setOrders(orders.map(o => o.id === id ? { ...o, status } : o))
  }

  const filtered = orders.filter(o => {
    if (filter !== 'all' && o.status !== filter) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      const matches = o.products?.name?.toLowerCase().includes(q) ||
        o.customer_phone?.includes(search.trim())
      if (!matches) return false
    }
    return true
  })

  const counts = {
    all: orders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    confirmed: orders.filter(o => o.status === 'confirmed').length,
    cancelled: orders.filter(o => o.status === 'cancelled').length,
  }

  const FILTERS = [
    { id: 'all', label: 'Todas' },
    { id: 'pending', label: 'Pendientes' },
    { id: 'confirmed', label: 'Confirmadas' },
    { id: 'cancelled', label: 'Canceladas' },
  ]

  return (
    <AdminLayout title="Órdenes">
      <div className="p-4 sm:p-8 lg:p-10">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-5 mb-8">
          <div className="flex flex-wrap gap-2.5">
            {FILTERS.map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all ${
                  filter === f.id
                    ? 'bg-primary text-white shadow-lg shadow-primary/25'
                    : 'bg-white/5 text-white/50 hover:bg-white/10'
                }`}
              >
                {f.label}
                <span className="ml-1.5 text-xs opacity-60">({counts[f.id]})</span>
              </button>
            ))}
          </div>
          <div className="relative lg:w-64">
            <HiOutlineMagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={16} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por teléfono..."
              className="input-dark pl-11"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="card-dark text-center py-24">
            <div className="text-6xl mb-4 opacity-20">🧉</div>
            <p className="text-white/40">
              No hay órdenes en esta vista. Cuando un cliente haga clic en WhatsApp desde el catálogo, aparecerá acá.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(order => (
              <div
                key={order.id}
                className="card-dark p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-5"
              >
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  {order.products?.images?.[0] ? (
                    <img
                      src={order.products.images[0]}
                      alt=""
                      className="w-14 h-14 rounded-xl object-cover bg-white/5 shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-white/5 flex items-center justify-center text-xl opacity-30 shrink-0">🧉</div>
                  )}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <p className="text-white font-medium truncate">
                        {order.products?.name || 'Producto eliminado'}
                      </p>
                      <span className={`badge ${STATUS[order.status]?.cls || 'badge-celeste'}`}>
                        {STATUS[order.status]?.label || order.status}
                      </span>
                    </div>
                    <p className="text-sm text-white/40">
                      {new Date(order.created_at).toLocaleDateString('es-AR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                    {order.customer_phone && (
                      <a
                        href={`tel:${order.customer_phone}`}
                        className="text-sm text-primary-light hover:text-white transition-colors"
                      >
                        Tel: {order.customer_phone}
                      </a>
                    )}
                  </div>
                </div>

                {order.status === 'pending' && (
                  <div className="flex gap-3 shrink-0">
                    <button
                      onClick={() => handleStatus(order.id, 'confirmed')}
                      className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-green-500/10 text-green-400 text-sm font-medium hover:bg-green-500/20 transition-colors"
                    >
                      <HiOutlineCheckCircle size={15} />
                      Confirmar
                    </button>
                    <button
                      onClick={() => handleStatus(order.id, 'cancelled')}
                      className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-red-500/10 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-colors"
                    >
                      <HiOutlineXCircle size={15} />
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
