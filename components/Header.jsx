'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { HiOutlineBars3, HiOutlineXMark, HiOutlineMagnifyingGlass } from 'react-icons/hi2'
import { CartIcon } from '@/components/ui/CartIcon'
import { CartSidebar } from '@/components/CartSidebar'

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [search, setSearch] = useState('')
  const router = useRouter()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const handleSearch = (e) => {
    e.preventDefault()
    if (search.trim()) {
      router.push(`/catalogo?q=${encodeURIComponent(search.trim())}`)
      setSearch('')
      setSearchOpen(false)
    }
  }

  return (
    <>
      <header className={`navbar sticky top-0 z-50 ${scrolled ? 'navbar-scrolled' : ''} bg-carbon/80 backdrop-blur-md border-b border-white/5`}>
        <div className="container-page">
          <div className="flex items-center justify-between h-[4.5rem]">
            <div className="flex items-center gap-8">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="lg:hidden text-white/60 hover:text-white transition-colors"
              >
                {menuOpen ? <HiOutlineXMark size={22} /> : <HiOutlineBars3 size={22} />}
              </button>

              <Link href="/" className="flex items-center gap-3 group">
                <div className="w-10 h-10 rounded-lg overflow-hidden shadow-lg shadow-primary/20 group-hover:shadow-primary/40 transition-shadow shrink-0">
                  <Image
                    src="/assets/brand/favicon.png"
                    alt="MateMáticos"
                    width={40}
                    height={40}
                    className="w-full h-full object-cover"
                    priority
                  />
                </div>
                <span className="font-display font-semibold text-xl tracking-tight text-white hidden sm:block">
                  Mate<span className="text-primary-light">Máticos</span>
                </span>
              </Link>

              <nav className="hidden lg:flex items-center gap-9">
                <Link href="/" className="text-sm text-white/60 hover:text-white transition-colors">
                  Inicio
                </Link>
                <Link href="/catalogo" className="text-sm text-white/60 hover:text-white transition-colors">
                  Catálogo
                </Link>
                <Link href="/catalogo?categoria=mates" className="text-sm text-white/60 hover:text-white transition-colors">
                  Mates
                </Link>
                <Link href="/catalogo?categoria=termos" className="text-sm text-white/60 hover:text-white transition-colors">
                  Termos
                </Link>
              </nav>
            </div>

            <div className="flex items-center gap-1.5">
              <AnimatePresence>
                {searchOpen ? (
                  <motion.form
                    onSubmit={handleSearch}
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 'auto', opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="flex items-center"
                  >
                    <input
                      autoFocus
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Buscar productos..."
                      className="w-40 sm:w-56 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-white/30 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </motion.form>
                ) : null}
              </AnimatePresence>

              <button
                onClick={() => setSearchOpen(!searchOpen)}
                className="p-3 rounded-xl text-white/60 hover:text-white hover:bg-white/5 transition-colors"
                aria-label="Buscar"
              >
                <HiOutlineMagnifyingGlass size={20} />
              </button>

              <CartIcon />
            </div>
          </div>
        </div>

        <AnimatePresence>
          {menuOpen && (
            <motion.nav
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="lg:hidden bg-carbon/95 backdrop-blur-md border-t border-white/5 overflow-hidden"
            >
              <div className="px-4 py-4 space-y-1.5">
                {[
                  { label: 'Inicio', href: '/' },
                  { label: 'Catálogo', href: '/catalogo' },
                  { label: 'Mates', href: '/catalogo?categoria=mates' },
                  { label: 'Termos', href: '/catalogo?categoria=termos' },
                ].map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className="block px-4 py-3 rounded-xl text-white/70 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>

      <CartSidebar />
    </>
  )
}
