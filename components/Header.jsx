'use client'

import Link from 'next/link'
import { HiOutlineMenu, HiOutlineX } from 'react-icons/hi'
import { useState } from 'react'

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-carbon/90 backdrop-blur-md border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl">🧉</span>
            <span className="font-semibold text-lg tracking-tight text-white">
              Mate<span className="text-primary">Máticos</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            <Link href="/" className="text-sm text-white/70 hover:text-white transition-colors">
              Inicio
            </Link>
            <Link href="/catalogo" className="text-sm text-white/70 hover:text-white transition-colors">
              Catálogo
            </Link>
          </nav>

          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden text-white"
          >
            {menuOpen ? <HiOutlineX size={24} /> : <HiOutlineMenu size={24} />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="md:hidden bg-carbon border-t border-white/5">
          <div className="px-4 py-4 space-y-3">
            <Link
              href="/"
              onClick={() => setMenuOpen(false)}
              className="block text-white/70 hover:text-white transition-colors"
            >
              Inicio
            </Link>
            <Link
              href="/catalogo"
              onClick={() => setMenuOpen(false)}
              className="block text-white/70 hover:text-white transition-colors"
            >
              Catálogo
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}
