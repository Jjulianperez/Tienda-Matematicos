'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { HiOutlineArrowLeft } from 'react-icons/hi2'
import Link from 'next/link'

export default function AdminOrdenes() {
  const [orders, setOrders] = useState([])
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

    setOrders(orders.map(o =>
      o.id === id ? { ...o, status } : o
    ))
  }

  const statusBadge = (status) => {
    const styles = {
      pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
      confirmed: 'bg-green-500/10 text-green-400 border-green-500/20',
      cancelled: 'bg-red-500/10 text-red-400 border-red-500/20',
    }
    const labels = {
      pending: 'Pendiente',
      confirmed: 'Confirmada',
      cancelled: 'Cancelada',
    }
    return (
      <span className={`px-3 py-1 rounded-full text-xs border ${styles[status] || styles.pending}`}>
        {labels[status] || status}
      </span>
    )
  }

  return (
    <div className="min-h-screen bg-carbon">
      <header className="border-b border-white/5 px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/dashboard" className="text-white/40 hover:text-white transition-colors">
            <HiOutlineArrowLeft size={20} />
          </Link>
          <span className="text-xl">🧉</span>
          <h1 className="text-white font-semibold">Órdenes</h1>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {orders.length === 0 ? (
          <div className="text-center py-20 text-white/40">
            No hay órdenes todavía. Cuando un cliente haga clic en WhatsApp desde el catálogo, aparecerá acá.
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map(order => (
              <div
                key={order.id}
                className="p-4 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-white font-medium truncate">
                      {order.products?.name || 'Producto eliminado'}
                    </p>
                    {statusBadge(order.status)}
                  </div>
                  <p className="text-sm text-white/40">
                    {new Date(order.created_at).toLocaleDateString('es-AR', {
                      day: 'numeric',
                      month: 'long',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                  {order.customer_phone && (
                    <p className="text-sm text-white/40">
                      Tel: {order.customer_phone}
                    </p>
                  )}
                </div>

                {order.status === 'pending' && (
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleStatus(order.id, 'confirmed')}
                      className="px-4 py-2 rounded-xl bg-green-500/10 text-green-400 text-sm font-medium hover:bg-green-500/20 transition-colors"
                    >
                      Confirmar
                    </button>
                    <button
                      onClick={() => handleStatus(order.id, 'cancelled')}
                      className="px-4 py-2 rounded-xl bg-red-500/10 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
