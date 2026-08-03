'use client'

import Image from 'next/image'
import { useState } from 'react'
import { HiOutlineArrowTopRightOnSquare, HiOutlineEye } from 'react-icons/hi2'
import { getOptimizedUrl } from '@/lib/images'

function getBadges(product) {
  const badges = []
  if (product.featured) badges.push({ label: 'Premium', cls: 'badge-premium' })
  if (product.stock === 0) badges.push({ label: 'Sin stock', cls: 'badge-sinstock' })
  return badges
}

export default function ProductCard({ product, onClick }) {
  const imgUrl = getOptimizedUrl(product.images?.[0], 600)
  const [imgLoaded, setImgLoaded] = useState(false)
  const badges = getBadges(product)

  return (
    <article
      className="group card-dark overflow-hidden flex flex-col h-full rounded-2xl border-white/5 transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_20px_40px_-12px_rgba(0,0,0,0.4)]"
      onClick={() => onClick?.(product)}
    >
      {/* SECCIÓN DE IMAGEN (Full width, edge-to-edge) */}
      <div className="relative aspect-square overflow-hidden rounded-t-2xl">
        {imgUrl ? (
          <Image
            src={imgUrl}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className={`object-cover transition-transform duration-700 group-hover:scale-105 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
            onLoad={() => setImgLoaded(true)}
          />
        ) : (
          <div className="flex items-center justify-center h-full bg-gradient-to-br from-primary/10 to-transparent">
            <span className="text-7xl opacity-20 group-hover:scale-110 transition-transform duration-700">🧉</span>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-carbon/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

        {badges.length > 0 && (
          <div className="absolute top-4 left-4 flex flex-col gap-1.5">
            {badges.map((b) => (
              <span key={b.label} className={`badge ${b.cls} transition-transform hover:scale-105`}>{b.label}</span>
            ))}
          </div>
        )}

        {product.stock > 0 && (
          <span className="absolute top-4 right-4 badge badge-stock transition-transform hover:scale-105">Stock: {product.stock}</span>
        )}

        {/* Overlay con "Ver Producto" en hover */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <button
            onClick={(e) => { e.stopPropagation(); onClick?.(product); }}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white text-sm font-semibold border border-white/20 transition-all shadow-lg"
          >
            <HiOutlineEye size={16} />
            Ver Producto
          </button>
        </div>
      </div>

      {/* SECCIÓN DE CONTENIDO */}
      <div className="flex flex-col flex-1 p-6 sm:p-7">
        
        {/* Categoría y Título */}
        <div className="mb-4">
          <span className="block text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-2">
            {product.categories?.name || 'Producto'}
          </span>
          <h3
            className="font-display font-bold text-lg sm:text-xl text-white/95 group-hover:text-primary-light transition-colors line-clamp-2 cursor-pointer leading-tight"
            onClick={() => onClick?.(product)}
          >
            {product.name}
          </h3>
        </div>
        
        {/* Descripción */}
        <p className="text-sm font-light text-white/50 line-clamp-2 leading-relaxed mb-6">
          {product.description}
        </p>

        {/* Footer: Precio y Botón */}
        <div className="flex items-center justify-between gap-4 mt-auto pt-5 border-t border-white/10">
          <div>
            <span className="block text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1">
              Precio
            </span>
            <span className="font-display font-bold text-xl sm:text-2xl text-primary-light leading-none">
              ${Number(product.price).toLocaleString('es-AR')}
            </span>
          </div>
          
          <button
            onClick={(e) => { e.stopPropagation(); onClick?.(product); }}
            className="inline-flex items-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs sm:text-sm font-medium text-white/90 hover:text-white hover:border-primary/40 transition-all"
          >
            Detalles
            <HiOutlineArrowTopRightOnSquare size={16} />
          </button>
        </div>
      </div>
    </article>
  )
}