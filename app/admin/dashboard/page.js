'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { HiOutlineCube, HiOutlineShoppingBag, HiOutlineClipboard, HiOutlineExclamationTriangle, HiOutlineArrowRight } from 'react-icons/hi2'
import AdminLayout from '@/components/admin/AdminLayout'

export default function AdminDashboard() {
  const [stats, setStats] = useState({ products: 0, orders: 0, pending: 0, lowStock: 0 })
  const [recentOrders, setRecentOrders] = useState([])

  useEffect(() => {
    const token = localStorage.getItem('token')

    fetch('/api/products')
      .then(res => res.json())
      .then(products => {
        const lowStock = products.filter(p => p.stock !== null && p.stock > 0 && p.stock <= 5).length
        setStats(s => ({ ...s, products: products.length, lowStock }))
      })
      .catch(() => {})

    fetch('/api/orders', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.json())
      .then(orders => {
        setStats(s => ({
          ...s,
          orders: orders.length,
          pending: orders.filter(o => o.status === 'pending').length,
        }))
        setRecentOrders(orders.slice(0, 5))
      })
      .catch(() => {})
  }, [])

  const cards = [
    {
      label: 'Productos activos',
      value: stats.products,
      icon: HiOutlineCube,
      href: '/admin/productos',
      accent: 'from-primary/20 to-transparent',
    },
    {
      label: 'Órdenes pendientes',
      value: stats.pending,
      icon: HiOutlineShoppingBag,
      href: '/admin/ordenes',
      accent: 'from-yellow-500/20 to-transparent',
    },
    {
      label: 'Órdenes totales',
      value: stats.orders,
      icon: HiOutlineClipboard,
      href: '/admin/ordenes',
      accent: 'from-celeste/20 to-transparent',
    },
    {
      label: 'Stock bajo (≤5)',
      value: stats.lowStock,
      icon: HiOutlineExclamationTriangle,
      href: '/admin/productos',
      accent: 'from-red-500/20 to-transparent',
    },
  ]

  const statusStyles = {
    pending: 'badge-celeste',
    confirmed: 'badge-stock',
    cancelled: 'badge-sinstock',
  }
  const statusLabels = {
    pending: 'Pendiente',
    confirmed: 'Confirmada',
    cancelled: 'Cancelada',
  }

  return (
    <AdminLayout title="Dashboard">
      <div className="p-4 sm:p-8 lg:p-10">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-10">
          {cards.map(card => (
            <Link
              key={card.label}
              href={card.href}
              className="card-dark relative overflow-hidden group"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${card.accent} opacity-60`} />
              <div className="relative p-6">
                <card.icon className="text-primary-light mb-4" size={26} />
                <p className="font-display text-3xl font-bold text-white">{card.value}</p>
                <p className="text-sm text-white/40 mt-1.5">{card.label}</p>
              </div>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 card-dark p-6 sm:p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display font-semibold text-white text-lg">Órdenes recientes</h2>
              <Link
                href="/admin/ordenes"
                className="inline-flex items-center gap-1.5 text-sm text-primary-light hover:text-white transition-colors"
              >
                Ver todas <HiOutlineArrowRight size={14} />
              </Link>
            </div>

            {recentOrders.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-5xl mb-4 opacity-20">🧉</div>
                <p className="text-white/40">Aún no hay órdenes. Aparecerán acá cuando un cliente consulte por WhatsApp.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="table-admin">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Fecha</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentOrders.map(order => (
                      <tr key={order.id}>
                        <td className="text-white font-medium">
                          {order.products?.name || 'Producto eliminado'}
                        </td>
                        <td className="text-white/50">
                          {new Date(order.created_at).toLocaleDateString('es-AR', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td>
                          <span className={`badge ${statusStyles[order.status] || 'badge-celeste'}`}>
                            {statusLabels[order.status] || order.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <Link href="/admin/productos" className="card-dark p-6 sm:p-8 block group hover:border-primary/40">
              <p className="font-display font-semibold text-white group-hover:text-primary-light transition-colors">
                Gestionar productos
              </p>
              <p className="text-sm text-white/40 mt-2">Agregar, editar o eliminar del catálogo.</p>
            </Link>
            <Link href="/admin/ordenes" className="card-dark p-6 sm:p-8 block group hover:border-primary/40">
              <p className="font-display font-semibold text-white group-hover:text-primary-light transition-colors">
                Ver órdenes
              </p>
              <p className="text-sm text-white/40 mt-2">Confirmar o cancelar pedidos.</p>
            </Link>
            <div className="card-dark p-6 sm:p-8">
              <span className="badge badge-geo mb-4">Consejo</span>
              <p className="text-sm text-white/50 leading-relaxed">
                Los productos con stock bajo se resaltan en la tabla para que repongas a tiempo.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
