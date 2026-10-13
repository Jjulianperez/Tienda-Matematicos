// Test de la lógica de Finanzas.
// Ejecutar: npm run test:finance
//
// Igual que test-customers, usa el puente para probar el lib/finance.js real.
// Todos los casos trabajan sobre datos armados a mano: no toca la base.

const { loadLibModule } = require('./_load-lib')

const {
  monthKey,
  monthLabel,
  shiftMonth,
  fillMonthRange,
  lineAmount,
  orderKey,
  buildFinanceReport,
} = loadLibModule('finance.js', [
  'monthKey',
  'monthLabel',
  'shiftMonth',
  'fillMonthRange',
  'lineAmount',
  'orderKey',
  'buildFinanceReport',
])

let fails = 0
const show = value => String(JSON.stringify(value))
const pad = (value, size) => String(value).padEnd(size)

const check = (ok, label, got, expected) => {
  if (!ok) fails++
  const suffix = ok ? '' : `  (esperado ${show(expected)})`
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${pad(label, 30)} -> ${show(got)}${suffix}`)
}

// ---------------------------------------------------------------------------
console.log('--- monthKey: la zona horaria es Argentina, no UTC ---')
// El servidor corre en UTC. Una venta de las 22:00 del 31/10 en Argentina es
// 01:00 UTC del 01/11: si no se convirtiera, caeria en noviembre.
check(monthKey('2026-11-01T01:00:00Z') === '2026-10', '01:00 UTC del 1/11 -> octubre', monthKey('2026-11-01T01:00:00Z'), '2026-10')
check(monthKey('2026-11-01T03:00:00Z') === '2026-11', '03:00 UTC del 1/11 -> noviembre', monthKey('2026-11-01T03:00:00Z'), '2026-11')
check(monthKey('2026-10-31T02:59:00Z') === '2026-10', 'frontera: todavia octubre', monthKey('2026-10-31T02:59:00Z'), '2026-10')

console.log('\n--- monthKey: entradas invalidas no rompen ---')
for (const bad of ['', null, undefined, 'no es fecha']) {
  check(monthKey(bad) === null, JSON.stringify(bad), monthKey(bad), null)
}

// ---------------------------------------------------------------------------
console.log('\n--- monthLabel ---')
// Ojo: el Intl de Node devuelve "octubre de 2026" (con "de"). La UI usa esto
// tal cual, asi que el test fija el formato real y no el que uno esperaria.
check(monthLabel('2026-10') === 'octubre de 2026', 'octubre', monthLabel('2026-10'), 'octubre de 2026')
check(monthLabel('2026-01') === 'enero de 2026', 'enero (mes 1, no 0)', monthLabel('2026-01'), 'enero de 2026')
check(monthLabel('2026-12') === 'diciembre de 2026', 'diciembre', monthLabel('2026-12'), 'diciembre de 2026')

// ---------------------------------------------------------------------------
console.log('\n--- shiftMonth: cruza el anio en los dos sentidos ---')
for (const [key, delta, expected] of [
  ['2026-01', -1, '2025-12'],
  ['2026-12', 1, '2027-01'],
  ['2026-10', -12, '2025-10'],
  ['2026-06', -6, '2025-12'],
  ['2026-10', 0, '2026-10'],
]) {
  const got = shiftMonth(key, delta)
  check(got === expected, `${key} ${delta}`, got, expected)
}

console.log('\n--- fillMonthRange: no se saltea meses ---')
check(
  JSON.stringify(fillMonthRange('2025-11', '2026-02')) === JSON.stringify(['2025-11', '2025-12', '2026-01', '2026-02']),
  'nov-2025 a feb-2026',
  fillMonthRange('2025-11', '2026-02'),
  ['2025-11', '2025-12', '2026-01', '2026-02']
)
check(fillMonthRange('2026-01', '2025-12').length === 0, 'rango invertido -> vacio', fillMonthRange('2026-01', '2025-12'), [])

// ---------------------------------------------------------------------------
console.log('\n--- lineAmount: tolera nulls y cantidades faltantes ---')
for (const [row, expected] of [
  [{ price_at_order: 100, quantity: 3 }, 300],
  [{ price_at_order: 100, quantity: null }, 100],   // sin cantidad = 1
  [{ price_at_order: null, quantity: 5 }, 0],       // sin precio = 0
  [{ price_at_order: '150.50', quantity: 2 }, 301], // viene como string de Postgres
  [{}, 0],                                          // fila vacia
]) {
  const got = lineAmount(row)
  check(got === expected, JSON.stringify(row), got, expected)
}

// ---------------------------------------------------------------------------
console.log('\n--- orderKey: filas sin numero no se fusionan ---')
check(orderKey({ order_number: 'MM-1', id: 'a' }) === 'MM-1', 'con numero', orderKey({ order_number: 'MM-1', id: 'a' }), 'MM-1')
const k1 = orderKey({ order_number: null, id: 'a' })
const k2 = orderKey({ order_number: null, id: 'b' })
check(k1 !== k2, 'sin numero: claves distintas', `${k1} / ${k2}`, 'distintas')

// ---------------------------------------------------------------------------
// Fixture que imita los datos reales, incluido el caso incomodo: una orden
// pedida en agosto y confirmada en septiembre.
const NOW = new Date('2026-10-15T12:00:00Z')
const rows = [
  // Pedido de 2 items, confirmado en agosto. Debe contar como 1 pedido, no 2.
  { id: 'l1', order_number: 'MM-1', status: 'confirmed', price_at_order: 30000, quantity: 1, created_at: '2026-08-05T12:00:00Z', confirmed_at: '2026-08-05T12:00:00Z', product_id: 'p1', product_name: 'Mate Imperial', combo_items: null },
  { id: 'l2', order_number: 'MM-1', status: 'confirmed', price_at_order: 6800, quantity: 1, created_at: '2026-08-05T12:00:00Z', confirmed_at: '2026-08-05T12:00:00Z', product_id: 'p2', product_name: 'Bombilla Pico Loro', combo_items: null },
  // Pedido de AGOSTO confirmado en SEPTIEMBRE. Tiene que caer en septiembre.
  { id: 'l3', order_number: 'MM-2', status: 'confirmed', price_at_order: 10000, quantity: 1, created_at: '2026-08-20T12:00:00Z', confirmed_at: '2026-09-02T12:00:00Z', product_id: 'p3', product_name: 'Yerba', combo_items: null },
  // Cancelada: no es facturacion.
  { id: 'l4', order_number: 'MM-3', status: 'cancelled', price_at_order: 50000, quantity: 1, created_at: '2026-08-10T12:00:00Z', confirmed_at: null, product_id: 'p4', product_name: 'Mate caro', combo_items: null },
  // Pendiente de hoy: todavia no es venta.
  { id: 'l5', order_number: 'MM-4', status: 'pending', price_at_order: 16000, quantity: 1, created_at: '2026-10-13T02:53:00Z', confirmed_at: null, product_id: 'p5', product_name: 'Termo', combo_items: null },
  // Fila vieja sin numero, sin precio, sin producto. Es basura pero no puede romper.
  { id: 'legacy-1', order_number: null, status: 'confirmed', price_at_order: null, quantity: null, created_at: '2026-07-30T21:37:00Z', confirmed_at: null, product_id: null, product_name: null, combo_items: null },
  // Venta real con el producto ya borrado del catalogo.
  { id: 'l6', order_number: 'MM-5', status: 'confirmed', price_at_order: 49000, quantity: 1, created_at: '2026-10-10T12:00:00Z', confirmed_at: '2026-10-10T12:00:00Z', product_id: null, product_name: 'Mate borrado', combo_items: null },
]

const report = buildFinanceReport(rows, { now: NOW })
const monthOf = key => report.series.find(m => m.month === key)

console.log('\n--- totales historicos (solo cuentan las ventas) ---')
// 30000 + 6800 + 10000 + 0 + 49000
check(report.totals.revenue === 95800, 'facturacion total', report.totals.revenue, 95800)
// MM-1, MM-2, legacy-1, MM-5
check(report.totals.orders === 4, 'pedidos totales', report.totals.orders, 4)
// MM-1 (2 lineas) + MM-2 + legacy-1 + MM-5. La fila vieja no tiene quantity,
// y por convencion (igual que lineAmount) una cantidad faltante vale 1.
check(report.totals.units === 5, 'unidades', report.totals.units, 5)
check(report.totals.avg_ticket === 23950, 'ticket promedio', report.totals.avg_ticket, 23950)
// La cancelada de 50000 y la pendiente de 16000 NO suman.
check(!report.series.some(m => m.revenue >= 50000 && m.month === '2026-08'), 'la cancelada no entra', monthOf('2026-08').revenue, 36800)

console.log('\n--- un pedido de varias lineas cuenta como UN pedido ---')
check(monthOf('2026-08').orders === 1, 'MM-1 en agosto = 1 pedido', monthOf('2026-08').orders, 1)
check(monthOf('2026-08').revenue === 36800, 'suma sus dos lineas', monthOf('2026-08').revenue, 36800)
check(monthOf('2026-08').units === 2, 'y sus dos unidades', monthOf('2026-08').units, 2)

console.log('\n--- imputacion por mes de CONFIRMACION ---')
check(monthOf('2026-09').revenue === 10000, 'pedido de agosto confirmado en sep', monthOf('2026-09').revenue, 10000)
check(monthOf('2026-09').orders === 1, 'cuenta en septiembre', monthOf('2026-09').orders, 1)

console.log('\n--- la fila sin confirmed_at cae en su created_at ---')
check(monthOf('2026-07').orders === 1, 'la fila vieja aparece en julio', monthOf('2026-07').orders, 1)
check(monthOf('2026-07').revenue === 0, 'con facturacion 0', monthOf('2026-07').revenue, 0)

console.log('\n--- pendientes y canceladas se ven aparte ---')
check(monthOf('2026-08').cancelled_amount === 50000, 'cancelada de agosto', monthOf('2026-08').cancelled_amount, 50000)
check(monthOf('2026-10').pending_amount === 16000, 'pendiente de octubre', monthOf('2026-10').pending_amount, 16000)
check(monthOf('2026-10').revenue === 49000, 'y la venta real de octubre', monthOf('2026-10').revenue, 49000)

console.log('\n--- la serie rellena meses vacios (el caso de septiembre real) ---')
check(report.series.length === 12, '12 meses por defecto', report.series.length, 12)
check(report.series[0].month === '2025-11', 'arranca en nov-2025', report.series[0].month, '2025-11')
check(report.series[report.series.length - 1].month === '2026-10', 'termina en oct-2026', report.series[report.series.length - 1].month, '2026-10')
const emptyMonth = monthOf('2025-12')
check(emptyMonth && emptyMonth.revenue === 0 && emptyMonth.orders === 0, 'un mes vacio existe en $0', emptyMonth && emptyMonth.revenue, 0)

console.log('\n--- desglose por estado ---')
const statusOf = s => report.by_status.find(e => e.status === s)
check(statusOf('confirmed').amount === 95800, 'confirmed', statusOf('confirmed').amount, 95800)
check(statusOf('confirmed').counts_as_revenue === true, 'confirmed cuenta', statusOf('confirmed').counts_as_revenue, true)
check(statusOf('cancelled').amount === 50000, 'cancelled', statusOf('cancelled').amount, 50000)
check(statusOf('cancelled').counts_as_revenue === false, 'cancelled NO cuenta', statusOf('cancelled').counts_as_revenue, false)
check(statusOf('pending').amount === 16000, 'pending', statusOf('pending').amount, 16000)

console.log('\n--- productos mas vendidos ---')
check(report.top_products[0].name === 'Mate borrado', 'el primero por monto', report.top_products[0].name, 'Mate borrado')
check(report.top_products[0].deleted === true, 'marcado como borrado', report.top_products[0].deleted, true)
check(report.top_products[1].name === 'Mate Imperial', 'segundo', report.top_products[1].name, 'Mate Imperial')
check(report.top_products.find(p => p.name === '(sin nombre)')?.revenue === 0, 'la fila sin nombre suma 0', report.top_products.find(p => p.name === '(sin nombre)')?.revenue, 0)
check(!report.top_products.some(p => p.name === 'Mate caro'), 'una cancelada no entra al ranking', report.top_products.some(p => p.name === 'Mate caro'), false)

console.log('\n--- ranking por mes ---')
check(monthOf('2026-08').top_products[0].name === 'Mate Imperial', 'top de agosto', monthOf('2026-08').top_products[0].name, 'Mate Imperial')
check(monthOf('2026-10').top_products[0].name === 'Mate borrado', 'top de octubre', monthOf('2026-10').top_products[0].name, 'Mate borrado')
check(monthOf('2025-12').top_products.length === 0, 'mes vacio sin ranking', monthOf('2025-12').top_products.length, 0)

console.log('\n--- calidad de datos ---')
check(report.data_quality.rows_without_order_number === 1, 'filas sin numero', report.data_quality.rows_without_order_number, 1)
check(report.data_quality.lines_with_deleted_product === 2, 'lineas con producto borrado', report.data_quality.lines_with_deleted_product, 2)
check(report.data_quality.lines_without_price === 1, 'lineas sin precio', report.data_quality.lines_without_price, 1)

console.log('\n--- mes por defecto ---')
check(report.default_month === '2026-10', 'con actividad hoy, abre en octubre', report.default_month, '2026-10')
// Si el mes actual esta vacio, conviene abrir en el ultimo con movimiento.
const past = buildFinanceReport(rows, { now: new Date('2027-01-15T12:00:00Z') })
check(past.default_month === '2026-10', 'sin actividad hoy, abre en el ultimo activo', past.default_month, '2026-10')

console.log('\n--- sin datos no rompe ---')
const empty = buildFinanceReport([], { now: NOW })
check(empty.totals.revenue === 0, 'facturacion 0', empty.totals.revenue, 0)
check(empty.totals.orders === 0, 'pedidos 0', empty.totals.orders, 0)
check(empty.totals.avg_ticket === 0, 'ticket 0 (no NaN)', empty.totals.avg_ticket, 0)
check(empty.series.length === 12, 'igual muestra 12 meses', empty.series.length, 12)
check(empty.default_month === '2026-10', 'mes por defecto = mes actual', empty.default_month, '2026-10')

console.log('\n--- entradas raras no rompen ---')
for (const weird of [null, undefined, 'texto', 42, {}]) {
  let ok = true
  try {
    buildFinanceReport(weird, { now: NOW })
  } catch {
    ok = false
  }
  check(ok, `buildFinanceReport(${JSON.stringify(weird)})`, ok, true)
}

console.log('\n' + '='.repeat(50))
console.log(fails === 0 ? 'TODOS LOS CASOS OK' : `${fails} FALLA(S)`)
process.exit(fails === 0 ? 0 : 1)
