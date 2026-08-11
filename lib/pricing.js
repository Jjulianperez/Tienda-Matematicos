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
    if (promo.kind === 'weight') continue
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

export function findBestWeightPromo(categoryId, weightPromos, allItems) {
  if (!categoryId || !weightPromos?.length) return null

  const totalWeight = (allItems || [])
    .filter(i => i.type !== 'combo' && i.categoryId === categoryId && Number(i.weight) > 0)
    .reduce((sum, i) => sum + Number(i.weight) * (i.quantity || 1), 0)

  if (!totalWeight) return null

  const eligible = weightPromos
    .filter(p => p.category_id === categoryId && Number(p.min_weight) > 0 && totalWeight >= Number(p.min_weight))
    .sort((a, b) => Number(b.discount_value) - Number(a.discount_value) || Number(b.min_weight) - Number(a.min_weight))

  if (!eligible.length) return null

  return {
    ...eligible[0],
    totalWeight,
  }
}

export function computeWeightPrice(item, weightPromos, allItems) {
  if (!item || item.type === 'combo' || Number(item.weight) <= 0) return null
  const best = findBestWeightPromo(item.categoryId, weightPromos, allItems)
  if (!best) return null
  return {
    unitPrice: computeSalePrice(Number(item.price), 'percent', best.discount_value),
    weightPromo: best,
  }
}

export function attachPromoInfo(product, promos) {
  const promo = findBestPromo(product, promos)
  if (!promo) return product
  return { ...product, promo }
}
