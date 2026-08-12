'use client'

import ProductCard from './ProductCard'
import ComboCard from './ComboCard'

export default function ProductGrid({ products, combos, onProductClick }) {
  const hasProducts = products?.length > 0
  const hasCombos = combos?.length > 0

  if (!hasProducts && !hasCombos) {
    return (
      <div className="text-center py-20">
        <p className="text-6xl mb-4">🧉</p>
        <p className="text-white/40">No hay productos en esta categoría</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 sm:gap-8">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          onClick={onProductClick}
        />
      ))}
      {combos?.map((combo) => (
        <ComboCard
          key={`combo-${combo.id}`}
          combo={combo}
        />
      ))}
    </div>
  )
}