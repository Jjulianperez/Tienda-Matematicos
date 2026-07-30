'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { HiOutlineCube, HiOutlineShoppingBag, HiOutlineClipboard, HiOutlineArrowRightOnRectangle } from 'react-icons/hi2'

export default function AdminDashboard() {
  const [admin, setAdmin] = useState(null)
  const [stats, setStats] = useState({ products: 0, orders: 0, pending: 0 })
  const router = useRouter()

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/admin/login')
      return
    }

    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => {
        if (!res.ok) throw new Error('No autorizado')
        return res.json()
      })
      .then(data => {
        setAdmin(data.admin)
      })
      .catch(() => {
        localStorage.removeItem('token')
        router.push('/admin/login')
      })

    fetch('/api/products')
      .then(res => res.json())
      .then(products => {
        setStats(s => ({ ...s, products: products.length }))
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
          })
          .catch(() => {})
      })
      .catch(() => {})
  }, [router])

  const handleLogout = () => {
    localStorage.removeItem('token')
    router.push('/admin/login')
  }

  if (!admin) return null

  const cards = [
    {
      label: 'Productos',
      value: stats.products,
      icon: HiOutlineCube,
      href: '/admin/productos',
      color: 'text-primary',
    },
    {
      label: 'Órdenes pendientes',
      value: stats.pending,
      icon: HiOutlineShoppingBag,
      href: '/admin/ordenes',
      color: 'text-yellow-400',
    },
    {
      label: 'Órdenes totales',
      value: stats.orders,
      icon: HiOutlineClipboard,
      href: '/admin/ordenes',
      color: 'text-white',
    },
  ]

  return (
    <div className="min-h-screen bg-carbon">
      <header className="border-b border-white/5 px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl">🧉</span>
          <h1 className="text-white font-semibold">Dashboard</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-white/40">{admin.email}</span>
          <button
            onClick={handleLogout}
            className="text-white/40 hover:text-white transition-colors"
          >
            <HiOutlineArrowRightOnRectangle size={20} />
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {cards.map(card => (
            <Link
              key={card.label}
              href={card.href}
              className="p-6 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-all"
            >
              <div className="flex items-center justify-between mb-4">
                <card.icon className={`${card.color}`} size={24} />
              </div>
              <p className="text-3xl font-bold text-white">{card.value}</p>
              <p className="text-sm text-white/40 mt-1">{card.label}</p>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            href="/admin/productos"
            className="p-6 rounded-2xl bg-white/5 border border-white/5 hover:border-primary/30 transition-all group"
          >
            <p className="text-white font-medium group-hover:text-primary transition-colors">
              Gestionar productos &rarr;
            </p>
            <p className="text-sm text-white/40 mt-1">Agregar, editar o eliminar productos</p>
          </Link>
          <Link
            href="/admin/ordenes"
            className="p-6 rounded-2xl bg-white/5 border border-white/5 hover:border-primary/30 transition-all group"
          >
            <p className="text-white font-medium group-hover:text-primary transition-colors">
              Ver órdenes &rarr;
            </p>
            <p className="text-sm text-white/40 mt-1">Gestionar pedidos de clientes</p>
          </Link>
        </div>
      </div>
    </div>
  )
}
