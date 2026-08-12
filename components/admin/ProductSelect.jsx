'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import { HiOutlineChevronDown, HiOutlineMagnifyingGlass, HiOutlineCheck } from 'react-icons/hi2'

function Thumb({ src, alt }) {
  if (!src) {
    return (
      <span className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center text-lg shrink-0">🧉</span>
    )
  }
  return <Image src={src} alt={alt} width={36} height={36} className="rounded-lg object-cover bg-white/10 shrink-0" />
}

function StockBadge({ product }) {
  if (product.stock === 0) {
    return <span className="badge badge-sinstock shrink-0">Sin stock</span>
  }
  if (product.stock <= 5) {
    return <span className="badge badge-artesanal shrink-0">Stock: {product.stock}</span>
  }
  return <span className="badge badge-stock shrink-0">Stock: {product.stock}</span>
}

export default function ProductSelect({ products, value, onChange, excludeIds, placeholder = 'Seleccionar producto...', className }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 })
  const buttonRef = useRef(null)
  const dropdownRef = useRef(null)

  const selected = products.find(p => p.id === value)

  useEffect(() => {
    const handler = (e) => {
      if (buttonRef.current && !buttonRef.current.contains(e.target)) {
        if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
          setOpen(false)
        }
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const updatePosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setDropdownPos({
        top: rect.bottom + window.scrollY + 8,
        left: rect.left + window.scrollX,
        width: rect.width,
      })
    }
  }

  useEffect(() => {
    if (!open) return
    updatePosition()
    const handleScroll = () => updatePosition()
    const handleResize = () => updatePosition()
    window.addEventListener('scroll', handleScroll, true)
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('resize', handleResize)
    }
  }, [open])

const filtered = products.filter(p => {
    if (excludeIds?.includes(p.id)) return false
    if (!query.trim()) return true
    const q = query.toLowerCase()
    return (
      p.name?.toLowerCase().includes(q) ||
      p.categories?.name?.toLowerCase().includes(q) ||
      String(p.price).includes(q)
    )
  })

  const dropdown = open ? (
    createPortal(
      <div
        ref={dropdownRef}
        className="bg-graphite border border-white/10 rounded-xl shadow-2xl overflow-hidden"
        style={{
          position: 'fixed',
          top: dropdownPos.top,
          left: dropdownPos.left,
          width: dropdownPos.width,
          zIndex: 60,
          maxHeight: 'calc(100vh - 100px)',
        }}
      >
        <div className="relative p-2.5 border-b border-white/10 bg-carbon/40">
          <HiOutlineMagnifyingGlass
            size={15}
            className="absolute left-[22px] top-1/2 -translate-y-1/2 text-white/30 pointer-events-none"
          />
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar producto o categoría..."
            className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-white/30 focus:outline-none focus:border-primary transition-colors"
          />
        </div>
        <div data-lenis-prevent className="max-h-64 overflow-y-auto p-1.5 space-y-1">
          {filtered.length === 0 ? (
            <p className="text-center text-xs text-white/30 py-6">Sin resultados</p>
          ) : (
            filtered.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => { onChange(p.id); setOpen(false) }}
                className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors text-left ${
                  value === p.id ? 'bg-primary/15' : 'hover:bg-white/5'
                }`}
              >
                <Thumb src={p.images?.[0]} alt={p.name} />
                <span className="flex-1 min-w-0">
                  <span className="block text-white text-sm font-medium truncate">{p.name}</span>
                  <span className="block text-[10px] text-white/40 truncate">
                    {p.categories?.name || 'Sin categoría'} · ${Number(p.price).toLocaleString('es-AR')}
                  </span>
                </span>
                <StockBadge product={p} />
                {value === p.id && <HiOutlineCheck size={16} className="text-primary-light shrink-0" />}
              </button>
            ))
          )}
        </div>
      </div>,
      document.body
    )
  ) : null

  return (
    <div className={className || ''}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => { setOpen(o => !o); setQuery('') }}
        className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white/5 border transition-all text-left min-h-[3.5rem] ${
          open ? 'border-primary ring-2 ring-primary/20' : 'border-white/10 hover:border-white/25'
        }`}
      >
        {selected ? (
          <>
            <Thumb src={selected.images?.[0]} alt={selected.name} />
            <span className="flex-1 min-w-0">
              <span className="block text-white text-sm font-medium truncate">{selected.name}</span>
              <span className="block text-[10px] text-white/40 truncate">
                {selected.categories?.name || 'Sin categoría'} · ${Number(selected.price).toLocaleString('es-AR')}
              </span>
            </span>
            <StockBadge product={selected} />
          </>
        ) : (
          <span className="flex-1 text-white/40 text-sm py-1">{placeholder}</span>
        )}
        <HiOutlineChevronDown
          size={16}
          className={`text-white/40 transition-transform shrink-0 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {dropdown}
    </div>
  )
}
