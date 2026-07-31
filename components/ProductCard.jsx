'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { HiOutlineShoppingBag, HiOutlineArrowTopRightOnSquare } from 'react-icons/hi2'
import { getOptimizedUrl } from '@/lib/images'

const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER

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

  const whatsappMessage = encodeURIComponent(
    `Hola, vengo del catálogo de MateMáticos y me gustaría adquirir este producto:\n\n` +
    `*${product.name}*\n` +
    `Precio: $${Number(product.price).toLocaleString('es-AR')}\n\n` +
    `¿Está disponible?`
  )

  return (
    <motion.article
      className="group card-dark overflow-hidden flex flex-col"
      whileHover={{ y: -6 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
    >
      {/* Imagen con aire oscuro alrededor */}
      <div className="relative p-5 sm:p-7 bg-carbon/40">
        <div className="relative aspect-square overflow-hidden rounded-2xl cursor-pointer" onClick={() => onClick?.(product)}>
          {imgUrl ? (
            <Image
              src={imgUrl}
              alt={product.name}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className={`object-cover transition-transform duration-700 group-hover:scale-110 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
              onLoad={() => setImgLoaded(true)}
            />
          ) : (
            <div className="flex items-center justify-center h-full bg-gradient-to-br from-primary/10 to-transparent">
              <span className="text-7xl opacity-20 group-hover:scale-110 transition-transform duration-700">🧉</span>
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-carbon via-transparent to-transparent opacity-60" />

          {badges.length > 0 && (
            <div className="absolute top-4 left-4 flex flex-col gap-1.5">
              {badges.map((b) => (
                <span key={b.label} className={`badge ${b.cls}`}>{b.label}</span>
              ))}
            </div>
          )}

          {product.stock > 0 && (
            <span className="absolute top-4 right-4 badge badge-stock">Stock: {product.stock}</span>
          )}

          <div className="absolute bottom-3 left-3 right-3 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}?text=${whatsappMessage}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 py-3 rounded-xl bg-primary text-white text-sm font-semibold shadow-lg shadow-primary/25 hover:bg-primary-dark transition-colors"
            >
              <HiOutlineShoppingBag size={16} />
              Comprar
            </a>
          </div>
        </div>
      </div>

      {/* Contenido con aire */}
      <div className="flex flex-col flex-1 px-6 sm:px-7 pb-7">
        <p className="text-[0.65rem] uppercase tracking-[0.18em] text-white/35">
          {product.categories?.name || 'Producto'}
        </p>
        <h3
          className="font-display font-semibold text-lg text-white group-hover:text-primary-light transition-colors line-clamp-1 cursor-pointer leading-snug mt-3"
          onClick={() => onClick?.(product)}
        >
          {product.name}
        </h3>
        <p className="text-xs text-white/45 mt-4 line-clamp-2 flex-1 leading-relaxed pr-2">
          {product.description}
        </p>

        <div className="flex items-end justify-between gap-6 mt-7 pt-6 border-t border-white/10">
          <div>
            <p className="text-[0.6rem] uppercase tracking-[0.18em] text-white/35">Precio</p>
            <p className="font-display font-semibold text-2xl text-primary-light leading-tight mt-1.5">
              ${Number(product.price).toLocaleString('es-AR')}
            </p>
          </div>
          <button
            onClick={() => onClick?.(product)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-white/10 text-xs font-medium text-white/50 hover:text-primary-light hover:border-primary/40 transition-colors"
          >
            Ver detalles
            <HiOutlineArrowTopRightOnSquare size={13} />
          </button>
        </div>
      </div>
    </motion.article>
  )
}
