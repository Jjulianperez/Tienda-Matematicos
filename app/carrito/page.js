'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import GeometricDecor from '@/components/ui/GeometricDecor'
import { motion } from 'framer-motion'
import {
  HiOutlineXMark,
  HiOutlineMinus,
  HiOutlinePlus,
  HiOutlineTrash,
  HiOutlineUser,
  HiOutlinePhone,
  HiOutlineArrowRight,
  HiOutlineCheckCircle,
  HiOutlineExclamationCircle,
} from 'react-icons/hi2'
import { getOptimizedUrl } from '@/lib/images'
import { useCart, getEffectiveUnitPrice } from '@/context/CartContext'
import { useSiteSettings } from '@/hooks/useSiteSettings'
import { formatMessage } from '@/lib/site-settings'

function categoryQty(items, categoryId) {
  return items
    .filter(i => i.type !== 'combo' && i.categoryId === categoryId)
    .reduce((sum, i) => sum + i.quantity, 0)
}

function CartItem({ item, unitPrice, isDiscounted, promoNote, onUpdate, onRemove }) {
  if (item.type === 'combo') {
    return (
      <div className="flex gap-4 p-4 bg-white/5 rounded-2xl border border-white/10">
        <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-white/5 flex-shrink-0">
          {item.image ? (
            <Image src={getOptimizedUrl(item.image, 120)} alt={item.name} fill className="object-cover" sizes="80px" />
          ) : (
            <div className="flex items-center justify-center h-full text-3xl">🏷️</div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-white font-medium text-sm sm:text-base">{item.name}</h4>
          {item.originalPrice > Number(item.price) && (
            <p className="text-xs text-white/30 line-through">
              ${Number(item.originalPrice).toLocaleString('es-AR')}
            </p>
          )}
          <p className="text-primary-light font-semibold text-sm sm:text-base mt-0.5">
            ${Number(item.price).toLocaleString('es-AR')}
          </p>
          <p className="text-[10px] text-white/30 mt-1">
            Combo · {item.items?.length || 0} productos
          </p>
          <button
            onClick={() => onRemove(item.productId)}
            className="mt-2 inline-flex items-center gap-1.5 text-xs text-white/30 hover:text-red-400 transition-colors"
          >
            <HiOutlineTrash size={14} />
            Quitar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-4 p-4 bg-white/5 rounded-2xl border border-white/10">
      <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-white/5 flex-shrink-0">
        {item.image ? (
          <Image src={getOptimizedUrl(item.image, 120)} alt={item.name} fill className="object-cover" sizes="80px" />
        ) : (
          <div className="flex items-center justify-center h-full text-3xl">🧉</div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-white font-medium text-sm sm:text-base">{item.name}</h4>
        {isDiscounted ? (
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-xs text-white/30 line-through">
              ${Number(item.price).toLocaleString('es-AR')}
            </span>
            <span className="text-primary-light font-semibold text-sm sm:text-base">
              ${unitPrice.toLocaleString('es-AR')}
            </span>
          </div>
        ) : (
          <p className="text-primary-light font-semibold text-sm sm:text-base mt-0.5">
            ${unitPrice.toLocaleString('es-AR')}
          </p>
        )}
        {promoNote && <p className="text-[10px] text-primary-light/80 mt-1">{promoNote}</p>}
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={() => onUpdate(item.productId, item.quantity - 1)}
            disabled={item.quantity <= 1}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
            aria-label="Disminuir"
          >
            <HiOutlineMinus size={16} />
          </button>
          <span className="w-10 text-center text-white font-medium text-sm">{item.quantity}</span>
          <button
            onClick={() => onUpdate(item.productId, item.quantity + 1)}
            disabled={item.quantity >= item.stock}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
            aria-label="Aumentar"
          >
            <HiOutlinePlus size={16} />
          </button>
          <button
            onClick={() => onRemove(item.productId)}
            className="ml-auto inline-flex items-center gap-1.5 text-xs text-white/30 hover:text-red-400 transition-colors"
          >
            <HiOutlineTrash size={14} />
            Quitar
          </button>
        </div>
      </div>
    </div>
  )
}

export default function CarritoPage() {
  const { state, removeItem, updateQuantity, clearCart, subtotal, totalItems } = useCart()
  const siteSettings = useSiteSettings()
  const [formData, setFormData] = useState({ customer_name: '', customer_phone: '' })
  const [buying, setBuying] = useState(false)
  const [buyError, setBuyError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setBuying(true)
    setBuyError('')

    if (state.items.length === 0) {
      setBuyError('Tu carrito está vacío')
      setBuying(false)
      return
    }

    const items = state.items.map(item => {
      if (item.type === 'combo') {
        return {
          type: 'combo',
          combo_id: item.comboId,
          title: item.name,
          price: Number(item.price),
          items: (item.items || []).map(comp => ({
            product_id: comp.product_id,
            quantity: comp.quantity || 1,
          })),
        }
      }
      return {
        type: 'product',
        product_id: item.productId,
        quantity: item.quantity,
        unit_price: getEffectiveUnitPrice(item, state.items),
      }
    })

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          customer_name: formData.customer_name.trim(),
          customer_phone: formData.customer_phone.trim(),
        }),
      })

      const result = await res.json()
      if (!res.ok) {
        throw new Error(result.error || 'Error al crear la orden')
      }

      const lines = state.items.map(item => {
        if (item.type === 'combo') {
          return `*${item.name}* - $${Number(item.price).toLocaleString('es-AR')}`
        }
        const unit = getEffectiveUnitPrice(item, state.items)
        return `*${item.quantity}× ${item.name}* - $${(unit * item.quantity).toLocaleString('es-AR')}`
      })

      const orderMessage = encodeURIComponent(
        formatMessage(siteSettings.messages.wa_cart, {
          order_number: result.order_number,
          items: lines.join('\n'),
          subtotal: subtotal.toLocaleString('es-AR'),
          customer_name: formData.customer_name,
          customer_phone: formData.customer_phone,
        })
      )

      clearCart()
      setFormData({ customer_name: '', customer_phone: '' })
      window.location.assign(`https://wa.me/${siteSettings.whatsapp_number}?text=${orderMessage}`)
    } catch (err) {
      setBuyError(err.message)
      setBuying(false)
    }
  }

  return (
    <main className="min-h-screen bg-carbon text-white overflow-x-hidden">
      <Header />

      <section className="relative py-16 sm:py-20 overflow-hidden">
        <GeometricDecor />
        <div className="container-page relative z-10">
          <div className="flex items-center gap-2 text-xs text-white/40 mb-3">
            <Link href="/" className="hover:text-primary-light transition-colors">Inicio</Link>
            <span>/</span>
            <span className="text-primary-light">Carrito</span>
          </div>
          <h1 className="font-display font-bold text-4xl sm:text-5xl text-white">
            Tu <span className="text-primary-light">carrito</span>
          </h1>
          <p className="text-white/50 mt-3 max-w-xl">
            Revisá tu selección y confirmá el pedido por WhatsApp. Te atendemos personalmente.
          </p>
        </div>
      </section>

      <section className="pb-20 sm:pb-28">
        <div className="container-page">
          {state.items.length === 0 ? (
            <div className="card-dark rounded-2xl p-12 sm:p-16 text-center">
              <div className="mx-auto w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                <svg className="w-10 h-10 text-primary-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a2 2 0 00-2-2H6a2 2 0 00-2 2v7a2 2 0 002 2h2m10-7v7a2 2 0 01-2 2h-2m0 0V9a2 2 0 00-2-2h-2m0 0v5a2 2 0 012 2h2m-4 0a2 2 0 01-2 2h-2" />
                </svg>
              </div>
              <h2 className="font-display font-semibold text-2xl text-white">Tu carrito está vacío</h2>
              <p className="text-white/40 mt-2">Explorá el catálogo y agregá tus mates favoritos.</p>
              <Link href="/catalogo" className="btn-primary inline-flex mt-8 px-6 py-3 rounded-xl">
                <HiOutlineArrowRight size={18} />
                Ir al catálogo
              </Link>
            </div>
          ) : (
            <div className="grid lg:grid-cols-[1fr_380px] gap-8 items-start">
              <div className="space-y-4">
                <h2 className="font-display font-semibold text-xl text-white mb-4">
                  Productos <span className="text-white/30">({totalItems} ítems)</span>
                </h2>
                {state.items.map(item => {
                  const unitPrice = getEffectiveUnitPrice(item, state.items)
                  const isDiscounted = item.type !== 'combo' && item.promo && unitPrice < Number(item.price)

                  let promoNote = ''
                  if (item.type !== 'combo' && item.promo && item.promo.min_quantity > 1 && item.promo.category_id) {
                    const qty = categoryQty(state.items, item.promo.category_id)
                    if (qty < item.promo.min_quantity) {
                      promoNote = `Agregá ${item.promo.min_quantity - qty} más para el descuento`
                    }
                  }

                  return (
                    <CartItem
                      key={item.productId}
                      item={item}
                      unitPrice={unitPrice}
                      isDiscounted={isDiscounted}
                      promoNote={promoNote}
                      onUpdate={updateQuantity}
                      onRemove={removeItem}
                    />
                  )
                })}
                <Link href="/catalogo" className="inline-flex items-center gap-2 text-sm text-primary-light hover:text-primary transition-colors">
                  <HiOutlinePlus size={16} />
                  Seguir agregando productos
                </Link>
              </div>

              <aside className="card-dark rounded-2xl p-6 sm:p-7 sticky top-24">
                <h2 className="font-display font-semibold text-lg text-white mb-5">Confirmar pedido</h2>

                <div className="space-y-2 mb-6 pb-6 border-b border-white/10">
                  <div className="flex justify-between text-sm">
                    <span className="text-white/50">Subtotal ({totalItems} ítems)</span>
                    <span className="text-white font-medium">${subtotal.toLocaleString('es-AR')}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/50">Envío</span>
                    <span className="text-white/40 text-xs">Se coordina por WhatsApp</span>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="relative">
                    <HiOutlineUser className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={18} />
                    <input
                      type="text"
                      required
                      placeholder="Tu nombre"
                      value={formData.customer_name}
                      onChange={e => setFormData({ ...formData, customer_name: e.target.value })}
                      className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:border-primary focus:outline-none text-sm transition-colors"
                    />
                  </div>
                  <div className="relative">
                    <HiOutlinePhone className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={18} />
                    <input
                      type="tel"
                      required
                      placeholder="Tu WhatsApp (ej: 11 1234-5678)"
                      value={formData.customer_phone}
                      onChange={e => setFormData({ ...formData, customer_phone: e.target.value })}
                      className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:border-primary focus:outline-none text-sm transition-colors"
                    />
                  </div>

                  {buyError && (
                    <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                      <HiOutlineExclamationCircle size={16} />
                      {buyError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={buying}
                    className="w-full inline-flex items-center justify-center gap-2 py-4 rounded-xl bg-primary hover:bg-primary-dark text-white font-semibold text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {buying ? (
                      <span className="animate-pulse">Creando orden...</span>
                    ) : (
                      <>
                        <HiOutlineCheckCircle size={18} />
                        Confirmar por WhatsApp
                      </>
                    )}
                  </button>
                  <p className="text-[10px] text-white/30 text-center leading-relaxed">
                    Al confirmar se abre WhatsApp con el detalle de tu pedido.
                    Todavía no hay ningún pago realizado.
                  </p>
                </form>
              </aside>
            </div>
          )}
        </div>
      </section>

      <Footer />
    </main>
  )
}
