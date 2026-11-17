// Test del cálculo de precios de pedidos (H2).
// Ejecutar: npm run test:order-pricing
//
// Usa el puente de scripts/_load-lib para probar lib/pricing.js real.
// Todos los casos trabajan sobre datos armados a mano: no toca la base.

const { loadLibModule } = require('./_load-lib')

const { isPromotionActive, priceProductLines } = loadLibModule('pricing.js', [
  'isPromotionActive',
  'priceProductLines',
])

let failures = 0

function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) failures++
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}${ok ? '' : ` -> esperado ${JSON.stringify(expected)}, obtenido ${JSON.stringify(actual)}`}`)
}

const CAT = 'cat-1'
const products = {
  p1: { id: 'p1', price: 1000, category_id: CAT },
  p2: { id: 'p2', price: 500, category_id: CAT },
  p3: { id: 'p3', price: 800, category_id: 'cat-2' },
}

const categoryPromo = {
  id: 'promo-cat',
  type: 'promo',
  kind: 'quantity',
  is_active: true,
  discount_type: 'percent',
  discount_value: 10,
  min_quantity: 3,
  items: [{ product_id: null, category_id: CAT }],
}

const directPromo = {
  id: 'promo-direct',
  type: 'promo',
  kind: 'quantity',
  is_active: true,
  discount_type: 'fixed',
  discount_value: 200,
  min_quantity: 1,
  items: [{ product_id: 'p3', category_id: null }],
}

// Sin promos: precio de la base.
check(
  'sin promos usa el precio de la base',
  priceProductLines([{ product_id: 'p1', quantity: 2 }], products, []).map(l => l.unitPrice),
  [1000]
)

// Promo de categoría: no alcanza la cantidad mínima (1 < 3).
check(
  'promo de categoría no aplica por debajo de la cantidad mínima',
  priceProductLines([{ product_id: 'p1', quantity: 1 }], products, [categoryPromo]).map(l => l.unitPrice),
  [1000]
)

// Promo de categoría: la cantidad se suma entre productos de la misma categoría (1 + 2 = 3).
check(
  'la cantidad mínima de categoría suma líneas de la misma categoría',
  priceProductLines(
    [{ product_id: 'p1', quantity: 1 }, { product_id: 'p2', quantity: 2 }],
    products,
    [categoryPromo]
  ).map(l => l.unitPrice),
  [900, 450]
)

// Promo de categoría no cuenta productos de otra categoría.
check(
  'productos de otra categoría no cuentan para la cantidad mínima',
  priceProductLines(
    [{ product_id: 'p1', quantity: 1 }, { product_id: 'p3', quantity: 2 }],
    products,
    [categoryPromo]
  ).map(l => l.unitPrice),
  [1000, 800]
)

// Promo directa de monto fijo sobre un producto.
check(
  'promo directa de monto fijo',
  priceProductLines([{ product_id: 'p3', quantity: 1 }], products, [directPromo]).map(l => l.unitPrice),
  [600]
)

// Vigencia de promociones.
const now = Date.now()
const day = 24 * 60 * 60 * 1000
check('promo sin fechas y activa es vigente', isPromotionActive({ is_active: true }), true)
check('promo inactiva no es vigente', isPromotionActive({ is_active: false }), false)
check(
  'promo que todavía no empezó no es vigente',
  isPromotionActive({ is_active: true, starts_at: new Date(now + day).toISOString() }),
  false
)
check(
  'promo vencida no es vigente',
  isPromotionActive({ is_active: true, ends_at: new Date(now - day).toISOString() }),
  false
)

if (failures > 0) {
  console.log(`\n${failures} caso(s) fallaron`)
  process.exitCode = 1
} else {
  console.log('\nTodos los casos pasaron')
}
