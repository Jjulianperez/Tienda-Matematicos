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

function CategoryChip({ name, slug, count, active, onClick }) {
  return (
    <button
      onClick={() => onClick(slug)}
      className={`shrink-0 px-5 py-2.5 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
        active
          ? 'bg-primary text-white border border-primary shadow-lg shadow-primary/25'
          : 'bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white hover:border-white/20'
      }`}
    >
      {name}
      {count !== undefined && (
        <span className={`text-[10px] px-2 py-0.5 rounded-full ${active ? 'bg-primary/30 text-white' : 'bg-white/10 text-white/50'}`}>
          {count}
        </span>
      )}
    </button>
  )
}

function CatalogoContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('categoria') || '')
  const [sort, setSort] = useState('populares')
  const [search, setSearch] = useState(searchParams.get('q') || '')
  const [loading, setLoading] = useState(true)
  const [showMobileFilters, setShowMobileFilters] = useState(false)
  const [onlyOffers, setOnlyOffers] = useState(searchParams.get('oferta') === '1')
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

  const filtered = (() => {
    let result = search.trim()
      ? products.filter(p =>
          p.name?.toLowerCase().includes(search.toLowerCase()) ||
          p.description?.toLowerCase().includes(search.toLowerCase()) ||
          p.categories?.name?.toLowerCase().includes(search.toLowerCase())
        )
      : products
    if (onlyOffers) result = result.filter(p => p.promo)
    return result
  })()

  const toggleOffers = () => {
    const next = !onlyOffers
    setOnlyOffers(next)
    const params = new URLSearchParams(searchParams)
    if (next) params.set('oferta', '1')
    else params.delete('oferta')
    router.replace(`/catalogo?${params.toString()}`, { scroll: false })
  }

  const handleCategory = (slug) => {
    setSelectedCategory(slug)
    setShowMobileFilters(false)
    const params = new URLSearchParams(searchParams)
    if (slug) params.set('categoria', slug)
    else params.delete('categoria')
    router.replace(`/catalogo?${params.toString()}`, { scroll: false })
  }

  const clearFilters = () => {
    setSelectedCategory('')
    setSearch('')
    setSort('populares')
    setOnlyOffers(false)
    router.replace('/catalogo', { scroll: false })
  }

  const hasFilters = selectedCategory || search || sort !== 'populares' || onlyOffers

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

          {/* Buscador + Selector + Filtros mobile */}
          <div className="flex flex-col sm:flex-row gap-4 mb-10 sm:mb-14">
            {/* Buscador */}
            <div className="relative flex-1 group">
              <HiOutlineMagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-primary-light transition-colors" size={18} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre, categoría..."
                className="input-dark h-12 pl-12 pr-12 w-full bg-white/5 border border-white/10 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder-white/30"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                  aria-label="Limpiar búsqueda"
                >
                  <HiOutlineXMark size={16} />
                </button>
              )}
            </div>

            {/* Selector orden + Botón filtros mobile */}
            <div className="flex items-center gap-3 sm:w-auto w-full">
              <div className="relative w-full sm:w-56">
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  className="input-dark h-12 w-full cursor-pointer appearance-none pr-10 bg-white/5 border border-white/10 focus:border-primary focus:ring-2 focus:ring-primary/20"
                >
                  {SORTS.map(s => (
                    <option key={s.value} value={s.value} className="bg-graphite">{s.label}</option>
                  ))}
                </select>
                <svg
                  className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#94A86A"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>

              {/* Botón filtros mobile */}
              <button
                onClick={() => setShowMobileFilters(!showMobileFilters)}
                className={`sm:hidden shrink-0 h-12 px-4 inline-flex items-center justify-center gap-2 rounded-xl border transition-all ${
                  hasFilters || showMobileFilters
                    ? 'bg-primary/10 border-primary/30 text-primary-light'
                    : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:border-white/20'
                }`}
              >
                <HiOutlineAdjustmentsHorizontal size={18} />
                <span className="font-medium">Filtros</span>
                {(hasFilters || showMobileFilters) && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary text-white">✓</span>
                )}
              </button>
            </div>
          </div>

          {/* Categorías - Desktop */}
          <div className="hidden sm:block mb-12 sm:mb-14">
            <div className="flex flex-wrap gap-3">
              <CategoryChip
                name="Todos"
                slug=""
                count={categories.reduce((acc, c) => acc + (products.filter(p => p.categories?.slug === c.slug).length), 0)}
                active={!selectedCategory && !onlyOffers}
                onClick={handleCategory}
              />
              <CategoryChip
                name="En oferta"
                slug="oferta"
                count={products.filter(p => p.promo).length}
                active={onlyOffers}
                onClick={toggleOffers}
              />
              {categories.map(cat => {
                const count = products.filter(p => p.categories?.slug === cat.slug).length
                return (
                  <CategoryChip
                    key={cat.id}
                    name={cat.name}
                    slug={cat.slug}
                    count={count}
                    active={selectedCategory === cat.slug}
                    onClick={handleCategory}
                  />
                )
              })}
            </div>
          </div>

          {/* Filtros Mobile - Panel desplegable */}
          {showMobileFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="sm:hidden mb-8 p-5 bg-white/5 border border-white/10 rounded-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-semibold text-white">Categorías</h3>
                <button
                  onClick={() => setShowMobileFilters(false)}
                  className="p-1 text-white/40 hover:text-white"
                >
                  <HiOutlineXMark size={20} />
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <CategoryChip
                  name="Todos"
                  slug=""
                  count={products.length}
                  active={!selectedCategory && !onlyOffers}
                  onClick={handleCategory}
                />
                <CategoryChip
                  name="En oferta"
                  slug="oferta"
                  count={products.filter(p => p.promo).length}
                  active={onlyOffers}
                  onClick={toggleOffers}
                />
                {categories.map(cat => {
                  const count = products.filter(p => p.categories?.slug === cat.slug).length
                  return (
                    <CategoryChip
                      key={cat.id}
                      name={cat.name}
                      slug={cat.slug}
                      count={count}
                      active={selectedCategory === cat.slug}
                      onClick={handleCategory}
                    />
                  )
                })}
              </div>
            </motion.div>
          )}

          {/* Contador de resultados + Limpiar filtros */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-10">
            <div className="flex items-center gap-3">
              <p className="text-sm text-white/40">
                {filtered.length} {filtered.length === 1 ? 'producto' : 'productos'}
                {selectedCategory && ` en ${categories.find(c => c.slug === selectedCategory)?.name || ''}`}
              </p>
              {hasFilters && (
                <span className="text-[10px] px-2 py-1 rounded-full bg-primary/20 text-primary-light font-medium">
                  Filtros activos
                </span>
              )}
            </div>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white/60 hover:text-primary-light hover:bg-white/5 border border-white/10 rounded-lg transition-all"
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
                    <div className="mt-4 space-y-2 px-1">
                      <div className="h-4 bg-white/5 rounded w-3/4" />
                      <div className="h-5 bg-white/5 rounded w-1/2" />
                      <div className="h-6 bg-primary/20 rounded w-1/3" />
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