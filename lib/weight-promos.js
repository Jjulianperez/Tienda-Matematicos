let cachedWeightPromos = []
let cachePromise = null

export function getWeightPromosNow() {
  return cachedWeightPromos
}

export function getWeightPromos() {
  if (!cachePromise) {
    cachePromise = fetch('/api/promotions/weight', { cache: 'no-store' })
      .then(res => (res.ok ? res.json() : []))
      .then(data => {
        cachedWeightPromos = Array.isArray(data) ? data : []
        return cachedWeightPromos
      })
      .catch(() => {
        cachedWeightPromos = []
        return cachedWeightPromos
      })
  }
  return cachePromise
}