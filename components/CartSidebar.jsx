'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useCart, getEffectiveUnitPrice } from '@/context/CartContext'
import { HiOutlineXMark, HiOutlineMinus, HiOutlinePlus, HiOutlineTrash, HiOutlineArrowRight } from 'react-icons/hi2'
import Image from 'next/image'
import { getOptimizedUrl } from '@/lib/images'
import { computeSalePrice, findBestWeightPromo } from '@/lib/pricing'
import { useWeightPromos } from '@/hooks/useWeightPromos'
import { formatWeight } from '@/lib/weight'

function CartSidebarItem({ item, unitPrice, isDiscounted, promoNote, onUpdate, onRemove }) {
  if (item.type === 'combo') {
    return (
      <div className="flex gap-3 p-3 bg-white/5 rounded-xl border border-white/10">
        <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-white/5 flex-shrink-0">
          {item.image ? (
            <Image src={getOptimizedUrl(item.image, 100)} alt={item.name} fill className="object-cover" sizes="64px" />
          ) : (
            <div className="flex items-center justify-center h-full text-2xl">🏷️</div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-white font-medium text-sm line-clamp-1">{item.name}</h4>
          {item.originalPrice > Number(item.price) && (
            <p className="text-xs text-white/30 line-through">
              ${Number(item.originalPrice).toLocaleString('es-AR')}
            </p>
          )}
          <p className="text-primary-light font-semibold text-sm mt-0.5">${Number(item.price).toLocaleString('es-AR')}</p>
          <p className="text-[10px] text-white/30 mt-1">Combo · {item.items?.length || 0} productos</p>
        </div>
        <button
          onClick={() => onRemove(item.productId)}
          className="p-2 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors self-start"
          aria-label="Eliminar"
        >
          <HiOutlineTrash size={18} />
        </button>
      </div>
    )
  }

  return (
    <div className="flex gap-3 p-3 bg-white/5 rounded-xl border border-white/10">
      <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-white/5 flex-shrink-0">
        {item.image ? (
          <Image src={getOptimizedUrl(item.image, 100)} alt={item.name} fill className="object-cover" sizes="64px" />
        ) : (
          <div className="flex items-center justify-center h-full text-2xl">🧉</div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-white font-medium text-sm line-clamp-1">{item.name}</h4>
        {isDiscounted ? (
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="text-xs text-white/30 line-through">${Number(item.price).toLocaleString('es-AR')}</span>
            <span className="text-primary-light font-semibold text-sm">${unitPrice.toLocaleString('es-AR')}</span>
          </div>
        ) : (
          <p className="text-primary-light font-semibold text-sm mt-0.5">${unitPrice.toLocaleString('es-AR')}</p>
        )}
        {promoNote && <p className="text-[10px] text-primary-light/80 mt-1">{promoNote}</p>}
        <div className="flex items-center gap-2 mt-2">
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
          <span className="text-[10px] text-white/30 ml-auto">Stock: {item.stock}</span>
        </div>
      </div>
      <button
        onClick={() => onRemove(item.productId)}
        className="p-2 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors self-start"
        aria-label="Eliminar"
      >
        <HiOutlineTrash size={18} />
      </button>
    </div>
  )
}

function categoryQty(items, categoryId) {
  return items
    .filter(i => i.type !== 'combo' && i.categoryId === categoryId)
    .reduce((sum, i) => sum + i.quantity, 0)
}

export function CartSidebar() {
  const { state, removeItem, updateQuantity, closeCart, subtotal, totalItems } = useCart()
  const weightPromos = useWeightPromos()

  const handleCheckout = () => {
    window.location.href = '/carrito'
  }

  if (!state.isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex justify-end"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          onClick={closeCart}
          className="fixed inset-0 bg-carbon/80 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />
        <motion.aside
          className="fixed right-0 top-0 h-full w-full max-w-sm sm:max-w-md lg:max-w-lg bg-carbon border-l border-white/10 flex flex-col z-50"
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          <div className="flex items-center justify-between p-5 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-primary-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a2 2 0 00-2-2H6a2 2 0 00-2 2v7a2 2 0 002 2h2m10-7v7a2 2 0 01-2 2h-2m0 0V9a2 2 0 00-2-2h-2m0 0v5a2 2 0 012 2h2m-4 0a2 2 0 01-2 2h-2" />
                </svg>
              </div>
              <h2 className="font-display font-semibold text-lg text-white">Tu carrito</h2>
            </div>
            <button
              onClick={closeCart}
              className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
              aria-label="Cerrar carrito"
            >
              <HiOutlineXMark size={22} />
            </button>
          </div>

          <div data-lenis-prevent className="flex-1 overflow-y-auto p-4 space-y-4">
            {state.items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <svg className="w-16 h-16 text-white/10 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a2 2 0 00-2-2H6a2 2 0 00-2 2v7a2 2 0 002 2h2m10-7v7a2 2 0 01-2 2h-2m0 0V9a2 2 0 00-2-2h-2m0 0v5a2 2 0 012 2h2m-4 0a2 2 0 01-2 2h-2" />
                </svg>
                <p className="text-white/40">Tu carrito está vacío</p>
                <p className="text-white/20 text-sm mt-1">Agregá productos desde el catálogo</p>
              </div>
            ) : (
              <>
                {state.items.map(item => {
                  const unitPrice = getEffectiveUnitPrice(item, state.items)
                  const isDiscounted = item.type !== 'combo' && unitPrice < Number(item.price)

                  let promoNote = ''
                  if (item.type !== 'combo' && item.promo && item.promo.min_quantity > 1 && item.promo.category_id) {
                    const qty = categoryQty(state.items, item.promo.category_id)
                    if (qty < item.promo.min_quantity) {
                      promoNote = `Agregá ${item.promo.min_quantity - qty} más para el descuento`
                    }
                  }
                  if (!promoNote && item.type !== 'combo' && Number(item.weight) > 0 && weightPromos?.length) {
                    const wp = findBestWeightPromo(item.categoryId, weightPromos, state.items)
                    if (wp && unitPrice === computeSalePrice(Number(item.price), 'percent', wp.discount_value)) {
                      promoNote = `${wp.discount_value}% OFF por peso acumulado (${formatWeight(wp.totalWeight)})`
                    }
                  }

                  return (
                    <CartSidebarItem
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
                <div className="pt-4 border-t border-white/10">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-white/50">Subtotal ({totalItems} items)</span>
                    <span className="text-white font-medium">${subtotal.toLocaleString('es-AR')}</span>
                  </div>
                  <div className="text-xs text-white/30 mb-4">El envío se calcula en el checkout</div>
                  <button
                    onClick={handleCheckout}
                    disabled={state.items.length === 0}
                    className="w-full py-3.5 rounded-xl bg-primary hover:bg-primary-dark text-white font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <HiOutlineArrowRight size={18} />
                    Ir al checkout
                  </button>
                </div>
              </>
            )}
          </div>
        </motion.aside>
      </motion.div>
    </AnimatePresence>
  )
}
