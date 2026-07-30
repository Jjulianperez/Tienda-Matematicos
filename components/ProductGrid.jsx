'use client'

import ProductCard from './ProductCard'

export default function ProductGrid({ products, onProductClick }) {
  if (!products?.length) {
    return (
      <div className="text-center py-20">
        <p className="text-6xl mb-4">🧉</p>
        <p className="text-white/40">No hay productos en esta categoría</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          onClick={onProductClick}
        />
      ))}
    </div>
  )
}
