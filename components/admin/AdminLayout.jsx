'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import {
  HiOutlineSquares2X2,
  HiOutlineCube,
  HiOutlineClipboardDocumentList,
  HiOutlineTag,
  HiOutlineHome,
  HiOutlineArrowRightOnRectangle,
  HiOutlineBars3,
  HiOutlineXMark,
} from 'react-icons/hi2'

const NAV = [
  { label: 'Dashboard', href: '/admin/dashboard', icon: HiOutlineSquares2X2 },
  { label: 'Productos', href: '/admin/productos', icon: HiOutlineCube },
  { label: 'Promociones', href: '/admin/promociones', icon: HiOutlineTag },
  { label: 'Órdenes', href: '/admin/ordenes', icon: HiOutlineClipboardDocumentList },
]

export default function AdminLayout({ title, children }) {
  const router = useRouter()
  const pathname = usePathname()
  const [admin, setAdmin] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

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
      .then(data => setAdmin(data.admin))
      .catch(() => {
        localStorage.removeItem('token')
        router.push('/admin/login')
      })
  }, [router])

  const handleLogout = () => {
    localStorage.removeItem('token')
    router.push('/admin/login')
  }

  const sidebar = (
    <aside className="w-64 shrink-0 bg-graphite border-r border-white/5 flex flex-col">
      <div className="p-6 border-b border-white/5">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 shadow-lg shadow-primary/20 group-hover:shadow-primary/40 transition-shadow">
            <Image
              src="/assets/brand/favicon.png"
              alt="MateMáticos"
              width={40}
              height={40}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="leading-tight">
            <p className="font-display font-semibold text-white">MateMáticos</p>
            <p className="text-[0.6rem] uppercase tracking-widest text-white/30 mt-0.5">Panel Admin</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 p-4 space-y-1.5">
        {NAV.map(item => {
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                active
                  ? 'bg-primary/15 text-primary-light border border-primary/25 shadow-lg shadow-primary/10'
                  : 'text-white/50 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <item.icon size={18} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t border-white/5 space-y-1.5">
        <Link
          href="/"
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-white/50 hover:text-white hover:bg-white/5 transition-colors"
        >
          <HiOutlineHome size={18} />
          Ver tienda
        </Link>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-white/50 hover:text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <HiOutlineArrowRightOnRectangle size={18} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  )

  return (
    <div className="min-h-screen bg-carbon flex">
      {/* Sidebar desktop */}
      <div className="hidden lg:block">{sidebar}</div>

      {/* Sidebar mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 h-full overflow-y-auto">{sidebar}</div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="border-b border-white/5 px-4 sm:px-8 h-16 flex items-center justify-between bg-graphite/50 backdrop-blur-md sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2.5 rounded-xl text-white/60 hover:text-white hover:bg-white/5 transition-colors"
            >
              <HiOutlineBars3 size={20} />
            </button>
            <h1 className="font-display font-semibold text-white text-lg">{title}</h1>
          </div>
          {admin && (
            <div className="flex items-center gap-4">
              <span className="hidden sm:block text-sm text-white/40">{admin.email}</span>
              <span className="w-9 h-9 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary-light text-xs font-semibold uppercase">
                {admin.email?.charAt(0) || 'A'}
              </span>
            </div>
          )}
        </header>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  )
}
