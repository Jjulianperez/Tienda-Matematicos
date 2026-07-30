'use client'

import Image from 'next/image'

export default function ProductCard({ product, onClick }) {
  return (
    <button
      onClick={() => onClick(product)}
      className="group text-left w-full"
    >
      <div className="relative aspect-square bg-white/5 rounded-2xl overflow-hidden border border-white/5 hover:border-primary/30 transition-all duration-500">
        {product.images?.[0] ? (
          <Image
            src={product.images[0]}
            alt={product.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-700"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-white/10 text-6xl">
            🧉
          </div>
        )}
        {product.stock === 0 && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <span className="text-white/80 text-sm font-medium px-3 py-1 border border-white/20 rounded-full">
              Sin stock
            </span>
          </div>
        )}
      </div>
      <div className="mt-3 space-y-1">
        <h3 className="font-medium text-white/90 group-hover:text-primary transition-colors">
          {product.name}
        </h3>
        <p className="text-sm text-white/40 line-clamp-1">
          {product.description}
        </p>
        <p className="text-lg font-semibold text-primary">
          ${Number(product.price).toLocaleString('es-AR')}
        </p>
      </div>
    </button>
  )
}
