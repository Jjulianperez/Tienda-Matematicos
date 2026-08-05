export function isPromotionActive(promo) {
  if (!promo?.is_active) return false
  const now = new Date()
  if (promo.starts_at && new Date(promo.starts_at) > now) return false
  if (promo.ends_at && new Date(promo.ends_at) < now) return false
  return true
}

export function computeSalePrice(price, discountType, discountValue) {
  if (!discountType || !discountValue) return Number(price)
  const base = Number(price)
  if (discountType === 'percent') {
    return Math.round(base * (1 - Number(discountValue) / 100))
  }
  if (discountType === 'fixed') {
    return Math.max(base - Number(discountValue), 0)
  }
  return base
}

export function discountPercentOf(price, salePrice) {
  const base = Number(price)
  if (!base) return 0
  return Math.round((1 - Number(salePrice) / base) * 100)
}

export function findBestPromo(product, promos) {
  if (!product || !promos?.length) return null
  const productId = product.id
  const categoryId = product.category_id
  let best = null

  for (const promo of promos) {
    if (promo.type !== 'promo') continue
    const items = promo.items || []
    const direct = items.find(i => i.product_id === productId)
    const catItem = items.find(i => i.category_id === categoryId)
    if (!direct && !catItem) continue

    const salePrice = computeSalePrice(product.price, promo.discount_type, promo.discount_value)
    if (!best || salePrice < best.salePrice) {
      best = {
        id: promo.id,
        title: promo.title,
        type: 'promo',
        discount_type: promo.discount_type,
        discount_value: promo.discount_value,
        min_quantity: promo.min_quantity || 1,
        product_id: direct?.product_id || null,
        category_id: catItem?.category_id || null,
        originalPrice: Number(product.price),
        salePrice,
      }
    }
  }
  return best
}

export function attachPromoInfo(product, promos) {
  const promo = findBestPromo(product, promos)
  if (!promo) return product
  return { ...product, promo }
}
