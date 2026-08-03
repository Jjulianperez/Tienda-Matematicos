'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { HiOutlineShoppingBag, HiOutlineArrowTopRightOnSquare, HiOutlineUser, HiOutlinePhone, HiOutlineXMark, HiOutlineCheckCircle, HiOutlineExclamationCircle, HiOutlineInformationCircle } from 'react-icons/hi2'
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
  const [showBuyModal, setShowBuyModal] = useState(false)
  const [buying, setBuying] = useState(false)
  const [formData, setFormData] = useState({ customer_name: '', customer_phone: '' })
  const [error, setError] = useState('')

  const whatsappMessage = encodeURIComponent(
    `Hola, vengo del catálogo de MateMáticos y me gustaría adquirir este producto:\n\n` +
    `*${product.name}*\n` +
    `Precio: $${Number(product.price).toLocaleString('es-AR')}\n\n` +
    `¿Está disponible?`
  )

  const handleBuy = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    setBuying(true)
    setError('')

    const token = localStorage.getItem('token')
    const body = {
      product_id: product.id,
      quantity: 1,
      customer_name: formData.customer_name.trim(),
      customer_phone: formData.customer_phone.trim(),
    }

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error al crear la orden')
      }

      const order = await res.json()

      const orderMessage = encodeURIComponent(
        `Hola, vengo del catálogo de MateMáticos.\n\n` +
        `Quiero confirmar mi pedido:\n` +
        `*Orden #${order.id.slice(0, 8).toUpperCase()}*\n` +
        `*${product.name}*\n` +
        `Precio: $${Number(product.price).toLocaleString('es-AR')}\n` +
        `Cliente: ${formData.customer_name}\n` +
        `Teléfono: ${formData.customer_phone}\n\n` +
        `¿Confirmamos el pedido?`
      )

      setShowBuyModal(false)
      setFormData({ customer_name: '', customer_phone: '' })

      window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${orderMessage}`, '_blank', 'noopener,noreferrer')

    } catch (err) {
      setError(err.message)
    } finally {
      setBuying(false)
    }
  }

  const whatsappFallbackMessage = encodeURIComponent(
    `Hola, vengo del catálogo de MateMáticos y me gustaría adquirir este producto:\n\n` +
    `*${product.name}*\n` +
    `Precio: $${Number(product.price).toLocaleString('es-AR')}\n\n` +
    `¿Está disponible?`
  )

  return (
    <motion.article
      className="group card-dark overflow-hidden flex flex-col h-full rounded-2xl border-white/5"
      whileHover={{ y: -8, boxShadow: '0 20px 40px -12px rgba(0,0,0,0.4)' }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
    >
      {/* SECCIÓN DE IMAGEN (Full width, edge-to-edge) */}
      <div className="relative aspect-square overflow-hidden rounded-t-2xl cursor-pointer" onClick={() => onClick?.(product)}>
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

        <div className="absolute bottom-3 left-3 right-3 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
          <button
            onClick={(e) => { e.stopPropagation(); setShowBuyModal(true); }}
            className="flex w-full items-center justify-center gap-2 py-3 rounded-xl bg-primary text-white text-sm font-semibold shadow-lg shadow-primary/25 hover:bg-primary-dark hover:shadow-primary/40 transition-all"
          >
            <HiOutlineShoppingBag size={16} />
            Comprar
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
            onClick={() => onClick?.(product)}
            className="inline-flex items-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs sm:text-sm font-medium text-white/90 hover:text-white hover:border-primary/40 transition-all"
          >
            Detalles
            <HiOutlineArrowTopRightOnSquare size={16} />
          </button>
        </div>
      </div>

      {/* MODAL COMPRAR */}
      {showBuyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-carbon/80 backdrop-blur-sm" onClick={() => setShowBuyModal(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
            className="w-full max-w-sm card-dark rounded-2xl overflow-hidden border border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 p-5 border-b border-white/5">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <HiOutlineShoppingBag className="w-5 h-5 text-primary-light" />
              </div>
              <div className="flex-1">
                <h2 className="font-display font-bold text-lg text-white">Confirmar compra</h2>
                <p className="text-sm text-white/50">{product.name}</p>
              </div>
              <button onClick={() => setShowBuyModal(false)} className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5">
                <HiOutlineXMark size={20} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs uppercase tracking-widest text-white/40 mb-1.5">Tu nombre</label>
                <input
                  type="text"
                  value={formData.customer_name}
                  onChange={e => setFormData({ ...formData, customer_name: e.target.value })}
                  placeholder="Juan Pérez"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-primary transition-colors"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest text-white/40 mb-1.5">Tu WhatsApp</label>
                <input
                  type="tel"
                  value={formData.customer_phone}
                  onChange={e => setFormData({ ...formData, customer_phone: e.target.value })}
                  placeholder="+54 9 11 1234 5678"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-primary transition-colors"
                  required
                />
              </div>
              {error && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
                  <HiOutlineExclamationCircle size={16} />
                  {error}
                </div>
              )}
            </div>
            <div className="flex gap-3 p-5 border-t border-white/5 bg-white/[0.02] rounded-b-2xl">
              <button
                onClick={() => setShowBuyModal(false)}
                className="flex-1 px-5 py-2.5 rounded-lg text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 border border-white/10 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleBuy}
                disabled={buying || !formData.customer_name.trim() || !formData.customer_phone.trim()}
                className="flex-1 px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-primary hover:bg-primary-dark shadow-lg shadow-primary/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {buying ? (
                  <>Creando orden... <HiOutlineCheckCircle size={14} className="animate-spin" /></>
                ) : (
                  <>Confirmar y abrir WhatsApp <HiOutlineCheckCircle size={14} /></>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.article>
  )
}