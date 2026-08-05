'use client'

import Image from 'next/image'
import Link from 'next/link'
import { HiOutlinePlus, HiOutlineArrowRight } from 'react-icons/hi2'
import { getOptimizedUrl } from '@/lib/images'
import { useCart } from '@/context/CartContext'

export default function ComboCard({ combo }) {
  const { addItem, openCart } = useCart()
  const isCombo = combo.type === 'combo'

  const originalTotal = combo.items?.reduce(
    (sum, i) => sum + Number(i.products?.price || 0) * (i.quantity || 1),
    0
  )
  const price = isCombo ? Number(combo.price) : null
  const savings = isCombo && originalTotal > price ? originalTotal - price : 0

  const itemSummary = combo.items
    ?.map(i => {
      if (i.products) return `${i.quantity > 1 ? i.quantity + '× ' : ''}${i.products.name}`
      if (i.categories) return i.categories.name
      return ''
    })
    .filter(Boolean)
    .join(' + ')

  const handleAddCombo = () => {
    addItem({
      productId: `combo-${combo.id}`,
      type: 'combo',
      comboId: combo.id,
      name: combo.title,
      price,
      originalPrice: originalTotal,
      image: combo.image,
      quantity: 1,
      items: combo.items?.map(i => ({
        product_id: i.product_id,
        name: i.products?.name,
        quantity: i.quantity || 1,
        stock: i.products?.stock ?? 0,
      })) || [],
    })
    openCart()
  }

  return (
    <article className="group card-dark overflow-hidden flex flex-col h-full rounded-2xl border-white/5 transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_20px_40px_-12px_rgba(0,0,0,0.4)]">
      <div className="relative aspect-[16/10] overflow-hidden rounded-t-2xl">
        {combo.image ? (
          <Image
            src={getOptimizedUrl(combo.image, 600)}
            alt={combo.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="flex items-center justify-center h-full bg-gradient-to-br from-primary/10 to-transparent">
            <span className="text-6xl opacity-20">🏷️</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-carbon/80 via-transparent to-transparent" />
        <span className={`absolute top-4 left-4 badge ${isCombo ? 'badge-oferta' : 'badge-celeste'}`}>
          {isCombo ? 'Combo' : combo.min_quantity > 1 ? `En ${combo.min_quantity}+` : 'Oferta'}
        </span>
      </div>

      <div className="flex flex-col flex-1 p-6 sm:p-7">
        <h3 className="font-display font-bold text-lg sm:text-xl text-white/95 group-hover:text-primary-light transition-colors leading-tight">
          {combo.title}
        </h3>
        {combo.description && (
          <p className="text-sm font-light text-white/50 line-clamp-2 leading-relaxed mt-2">
            {combo.description}
          </p>
        )}
        {itemSummary && (
          <p className="text-xs text-white/30 mt-3">Incluye: {itemSummary}</p>
        )}

        <div className="mt-auto pt-5 border-t border-white/10">
          {isCombo ? (
            <div className="flex items-end justify-between gap-3 mb-4">
              <div>
                <span className="block text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1">
                  Precio combo
                </span>
                <div className="flex items-baseline gap-2 flex-wrap">
                  {savings > 0 && (
                    <span className="text-sm sm:text-base text-white/40 line-through">
                      ${originalTotal.toLocaleString('es-AR')}
                    </span>
                  )}
                  <span className="font-display font-bold text-xl sm:text-2xl text-primary-light leading-none">
                    ${price.toLocaleString('es-AR')}
                  </span>
                </div>
              </div>
              {savings > 0 && (
                <span className="badge badge-oferta">Ahorrás ${savings.toLocaleString('es-AR')}</span>
              )}
            </div>
          ) : (
            <div className="mb-4">
              <span className="block text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1">
                Descuento
              </span>
              <span className="font-display font-bold text-xl sm:text-2xl text-primary-light">
                {combo.discount_type === 'percent'
                  ? `${combo.discount_value}% OFF`
                  : `$${Number(combo.discount_value).toLocaleString('es-AR')} de descuento`}
              </span>
            </div>
          )}

          {isCombo ? (
            <button
              onClick={handleAddCombo}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary hover:bg-primary-dark text-xs sm:text-sm font-semibold text-white transition-all"
            >
              <HiOutlinePlus size={15} />
              Añadir combo
            </button>
          ) : (
            <Link
              href="/catalogo"
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary hover:bg-primary-dark text-xs sm:text-sm font-semibold text-white transition-all"
            >
              Ver ofertas
              <HiOutlineArrowRight size={14} />
            </Link>
          )}
        </div>
      </div>
    </article>
  )
}
