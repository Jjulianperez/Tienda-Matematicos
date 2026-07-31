'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import ProductGrid from '@/components/ProductGrid'
import GeometricDecor from '@/components/ui/GeometricDecor'
import { HiOutlineMagnifyingGlass, HiOutlineXMark, HiOutlineAdjustmentsHorizontal } from 'react-icons/hi2'

const SORTS = [
  { value: 'populares', label: 'Más solicitados' },
  { value: 'nuevos', label: 'Más nuevos' },
  { value: 'precio-asc', label: 'Menor precio' },
  { value: 'precio-desc', label: 'Mayor precio' },
]

function CatalogoContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('categoria') || '')
  const [sort, setSort] = useState('populares')
  const [search, setSearch] = useState(searchParams.get('q') || '')
  const [loading, setLoading] = useState(true)
  const cache = useRef({})

  const fetchProducts = useCallback(() => {
    const key = `${selectedCategory}|${sort}`
    if (cache.current[key]) {
      setProducts(cache.current[key])
      setLoading(false)
      return
    }

    setLoading(true)
    const params = new URLSearchParams()
    if (selectedCategory) params.set('categoria', selectedCategory)
    params.set('sort', sort)

    fetch(`/api/products?${params}`)
      .then(res => res.json())
      .then(data => {
        cache.current[key] = data
        setProducts(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [selectedCategory, sort])

  useEffect(() => { fetchProducts() }, [fetchProducts])

  useEffect(() => {
    fetch('/api/categories')
      .then(res => res.json())
      .then(setCategories)
      .catch(() => {})
  }, [])

  const filtered = search.trim()
    ? products.filter(p =>
        p.name?.toLowerCase().includes(search.toLowerCase()) ||
        p.description?.toLowerCase().includes(search.toLowerCase()) ||
        p.categories?.name?.toLowerCase().includes(search.toLowerCase())
      )
    : products

  const handleCategory = (slug) => {
    setSelectedCategory(slug)
    const params = new URLSearchParams(searchParams)
    if (slug) params.set('categoria', slug)
    else params.delete('categoria')
    router.replace(`/catalogo?${params.toString()}`, { scroll: false })
  }

  const clearFilters = () => {
    setSelectedCategory('')
    setSearch('')
    setSort('populares')
    router.replace('/catalogo', { scroll: false })
  }

  const hasFilters = selectedCategory || search || sort !== 'populares'

  return (
    <>
      <Header />
      <main className="flex-1 bg-carbon min-h-screen relative">
        <GeometricDecor variant="blueprint" className="absolute inset-0 w-full h-full opacity-30" />
        <div className="relative container-page py-16 sm:py-20">
          {/* Hero / Descripción */}
          <header className="mb-14 sm:mb-20">
            <div className="flex flex-wrap items-center gap-3 mb-8">
              <span className="badge badge-geo">Diseño Matemático</span>
              <span className="badge seal-argentina">Hecho en Argentina</span>
            </div>
            <h1 className="font-display font-bold text-4xl sm:text-5xl text-white text-balance leading-[1.15]">
              El catálogo de la <span className="text-primary-light">fórmula perfecta</span>
            </h1>
            <p className="mt-6 text-white/40 max-w-2xl leading-relaxed">
              Cada producto fue seleccionado con precisión de ingeniería. Encontrá las variables de tu ecuación.
            </p>
          </header>

          {/* Buscador + Selector */}
          <div className="flex flex-col sm:flex-row gap-4 mb-10 sm:mb-14">
            <div className="relative flex-1">
              <HiOutlineMagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={18} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre, categoría..."
                className="input-dark h-12 pl-12"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                  aria-label="Limpiar búsqueda"
                >
                  <HiOutlineXMark size={16} />
                </button>
              )}
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="input-dark h-12 sm:w-64 cursor-pointer"
            >
              {SORTS.map(s => (
                <option key={s.value} value={s.value} className="bg-graphite">{s.label}</option>
              ))}
            </select>
          </div>

          {/* Categorías */}
          <div className="flex items-start gap-4 mb-12 sm:mb-14">
            <HiOutlineAdjustmentsHorizontal className="text-white/25 shrink-0 hidden sm:block mt-4" size={18} />
            <div className="flex gap-3 overflow-x-auto scrollbar-none flex-1 py-1">
              <button
                onClick={() => handleCategory('')}
                className={`shrink-0 px-6 py-3 rounded-full text-sm font-medium transition-all ${
                  !selectedCategory
                    ? 'bg-primary text-white border border-primary shadow-lg shadow-primary/25'
                    : 'border border-white/10 text-white/50 hover:text-white hover:border-white/25'
                }`}
              >
                Todos
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => handleCategory(cat.slug)}
                  className={`shrink-0 px-6 py-3 rounded-full text-sm font-medium transition-all ${
                    selectedCategory === cat.slug
                      ? 'bg-primary text-white border border-primary shadow-lg shadow-primary/25'
                      : 'border border-white/10 text-white/50 hover:text-white hover:border-white/25'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Contador de resultados */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-10">
            <p className="text-sm text-white/40">
              {filtered.length} {filtered.length === 1 ? 'producto' : 'productos'}
              {selectedCategory && ` en ${categories.find(c => c.slug === selectedCategory)?.name || ''}`}
            </p>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-primary-light transition-colors"
              >
                <HiOutlineXMark size={14} />
                Limpiar filtros
              </button>
            )}
          </div>

          {/* Grilla */}
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div
                key="skeleton"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 sm:gap-8"
              >
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="aspect-square bg-white/5 rounded-2xl" />
                    <div className="mt-4 space-y-2">
                      <div className="h-4 bg-white/5 rounded w-3/4" />
                      <div className="h-3 bg-white/5 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </motion.div>
            ) : (
              <motion.div
                key={`${selectedCategory}-${sort}-${search}`}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.3 }}
              >
                {filtered.length === 0 ? (
                  <div className="card-dark text-center py-24 px-6">
                    <div className="text-6xl mb-4 opacity-20">🧉</div>
                    <p className="font-display text-2xl text-white/60">Sin resultados</p>
                    <p className="text-white/30 text-sm mt-3">
                      No encontramos productos que coincidan con tu búsqueda.
                    </p>
                    <button onClick={clearFilters} className="btn-outline mt-8">
                      Limpiar filtros
                    </button>
                  </div>
                ) : (
                  <ProductGrid
                    products={filtered}
                    onProductClick={(p) => router.push(`/producto/${p.id}`)}
                  />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
      <Footer />
    </>
  )
}

export default function Catalogo() {
  return (
    <Suspense fallback={null}>
      <CatalogoContent />
    </Suspense>
  )
}
