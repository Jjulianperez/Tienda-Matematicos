// lib/finance.js
// Lógica de Finanzas: cuánto facturó la tienda, agrupado por mes.
//
// IMPORTANTE: acá se calcula FACTURACIÓN (lo que se vendió), no GANANCIA (lo
// que quedó). Para ganancia hace falta products.cost, que existe en el esquema
// pero todavía no se carga. Ver la sección "Ganancia" en README.
//
// Este archivo es lógica pura: recibe filas y devuelve un reporte. No toca la
// base ni depende de Supabase, así que se puede testear sin conexión.

import { PURCHASE_STATUSES } from './customers'

// Mismo huso que PAYMENT_TIMEZONE en lib/admin-config.js. Se usa explícito
// porque el servidor corre en UTC (Vercel): sin esto, una venta de las 22:00
// del 31 de octubre en Argentina caería en noviembre.
export const FINANCE_TIMEZONE = 'America/Argentina/Buenos_Aires'

const MONTH_PARTS = new Intl.DateTimeFormat('en-US', {
  timeZone: FINANCE_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
})

const MONTH_LABEL = new Intl.DateTimeFormat('es-AR', {
  timeZone: FINANCE_TIMEZONE,
  year: 'numeric',
  month: 'long',
})

/**
 * Mes ('YYYY-MM') al que pertenece una fecha, en hora argentina.
 * @param {string} isoDate
 * @returns {string|null}
 */
export function monthKey(isoDate) {
  if (!isoDate) return null
  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) return null

  // formatToParts en vez de format(): en-CA devuelve 'YYYY-MM' pero algunas
  // versiones de Node lo ordenan distinto, y acá el orden es crítico.
  const parts = MONTH_PARTS.formatToParts(date)
  const year = parts.find(p => p.type === 'year')?.value
  const month = parts.find(p => p.type === 'month')?.value
  return year && month ? `${year}-${month}` : null
}

/**
 * Etiqueta legible: '2026-10' -> 'octubre 2026'.
 * @param {string} key
 * @returns {string}
 */
export function monthLabel(key) {
  if (!key) return ''
  const [year, month] = key.split('-').map(Number)
  // Día 15 a mediodía: punto medio del mes, imposible que se corra de mes por
  // zona horaria.
  return MONTH_LABEL.format(new Date(Date.UTC(year, month - 1, 15, 12)))
}

/**
 * Suma o resta meses a una clave 'YYYY-MM'.
 * @param {string} key
 * @param {number} delta
 * @returns {string}
 */
export function shiftMonth(key, delta) {
  const [year, month] = key.split('-').map(Number)
  const total = year * 12 + (month - 1) + delta
  const newYear = Math.floor(total / 12)
  const newMonth = (total % 12 + 12) % 12 + 1
  return `${newYear}-${String(newMonth).padStart(2, '0')}`
}

/**
 * Lista continua de meses entre dos claves, inclusive.
 * @param {string} from
 * @param {string} to
 * @returns {string[]}
 */
export function fillMonthRange(from, to) {
  if (!from || !to || from > to) return []
  const months = []
  let current = from
  // Tope defensivo: 600 meses (50 años) para que un dato corrupto no cuelgue.
  while (current <= to && months.length < 600) {
    months.push(current)
    current = shiftMonth(current, 1)
  }
  return months
}

/**
 * Monto de una línea de pedido.
 *
 * `orders` guarda una fila por ítem, así que este es el total de la línea:
 * precio unitario x cantidad. En combos la cantidad siempre es 1 y el precio
 * es el del combo.
 * @param {object} row
 * @returns {number}
 */
export function lineAmount(row) {
  return Number(row.price_at_order || 0) * (Number(row.quantity) || 1)
}

/**
 * @param {string} status
 * @returns {boolean}
 */
export function isPurchase(status) {
  return PURCHASE_STATUSES.includes(status)
}

/**
 * Clave para agrupar líneas en un mismo pedido.
 *
 * Las órdenes viejas pueden no tener order_number, y cada línea es un pedido
 * distinto: agruparlas todas bajo el mismo null contaría 1 solo pedido cuando
 * en realidad son varios.
 * @param {object} row
 * @returns {string}
 */
export function orderKey(row) {
  return row.order_number || `__line__${row.id}`
}

function round2(value) {
  return Math.round(value * 100) / 100
}

function emptyMonth(element) {
  return {
    month: element.month,
    label: element.label,
    revenue: 0,
    orders: 0,
    units: 0,
    avg_ticket: 0,
    pending_count: 0,
    pending_amount: 0,
    cancelled_count: 0,
    cancelled_amount: 0,
    top_products: [],
  }
}

/**
 * Acumula una venta en el ranking de productos de un mes.
 * Se agrupa por nombre, no por id, porque el producto puede estar borrado
 * (product_id queda NULL) y el nombre es lo único que sobrevive.
 */
function accumulateProduct(map, row) {
  const name = row.product_name || '(sin nombre)'
  const key = row.product_id || `name:${name}`
  if (!map.has(key)) {
    map.set(key, { name, units: 0, revenue: 0, product_id: row.product_id || null })
  }
  const entry = map.get(key)
  entry.units += Number(row.quantity) || 1
  entry.revenue += lineAmount(row)
}

/** Convierte el mapa de productos de un mes en un ranking ordenado y acotado. */
function rankProducts(map, limit) {
  return [...map.values()]
    .map(entry => ({
      ...entry,
      revenue: round2(entry.revenue),
      deleted: !entry.product_id,
    }))
    .sort((a, b) => b.revenue - a.revenue || b.units - a.units)
    .slice(0, limit)
}

/**
 * Construye el reporte completo de Finanzas a partir de las filas de orders.
 *
 * @param {object[]} rows filas de orders
 * @param {object} [options]
 * @param {number} [options.monthsBack] cuántos meses mostrar como mínimo
 * @param {Date}   [options.now] fecha de referencia (para tests)
 * @param {number} [options.topProducts] cuántos productos devolver
 * @returns {object}
 */
export function buildFinanceReport(rows, options = {}) {
  const { monthsBack = 12, now = new Date(), topProducts = 10 } = options
  const list = Array.isArray(rows) ? rows : []

  // --- Agrupar por mes ------------------------------------------------------
  const months = new Map()

  const getMonth = (key) => {
    if (!months.has(key)) months.set(key, emptyMonth({ month: key, label: monthLabel(key) }))
    return months.get(key)
  }

  let rowsWithoutOrderNumber = 0
  let linesWithDeletedProduct = 0
  let linesWithoutPrice = 0

  // Un Set por mes, para contar pedidos y no líneas.
  const orderKeysByMonth = new Map()
  const addOrderKey = (month, key) => {
    if (!orderKeysByMonth.has(month)) orderKeysByMonth.set(month, new Set())
    orderKeysByMonth.get(month).add(key)
  }

  // Ranking de productos por mes, para el detalle mensual.
  const productsByMonth = new Map()
  const addProduct = (month, row) => {
    if (!productsByMonth.has(month)) productsByMonth.set(month, new Map())
    accumulateProduct(productsByMonth.get(month), row)
  }

  for (const row of list) {
    if (!row.order_number) rowsWithoutOrderNumber++
    if (isPurchase(row.status) && !row.product_id && !row.combo_items) linesWithDeletedProduct++
    if (row.price_at_order === null || row.price_at_order === undefined) linesWithoutPrice++

    // Una venta pertenece al mes en que se confirmó. Las que no son venta
    // (pendientes, canceladas) se muestran en el mes en que se pidieron, que
    // es lo único que sabemos de ellas.
    const purchase = isPurchase(row.status)
    const date = purchase ? (row.confirmed_at || row.created_at) : row.created_at
    const key = monthKey(date)
    if (!key) continue

    const bucket = getMonth(key)
    const amount = lineAmount(row)

    if (purchase) {
      bucket.revenue += amount
      bucket.units += Number(row.quantity) || 1
      addOrderKey(key, orderKey(row))
      addProduct(key, row)
    } else if (row.status === 'pending') {
      bucket.pending_count++
      bucket.pending_amount += amount
    } else if (row.status === 'cancelled') {
      bucket.cancelled_count++
      bucket.cancelled_amount += amount
    }
  }

  for (const [key, bucket] of months) {
    const orderCount = orderKeysByMonth.get(key)?.size || 0
    bucket.orders = orderCount
    bucket.revenue = round2(bucket.revenue)
    bucket.pending_amount = round2(bucket.pending_amount)
    bucket.cancelled_amount = round2(bucket.cancelled_amount)
    bucket.avg_ticket = orderCount > 0 ? round2(bucket.revenue / orderCount) : 0
    bucket.top_products = rankProducts(productsByMonth.get(key) || new Map(), 5)
  }

  // --- Rango continuo de meses ---------------------------------------------
  // Los meses sin actividad tienen que aparecer igual: si septiembre no tiene
  // ni una orden, tiene que verse septiembre en $0, no desaparecer.
  const currentMonth = monthKey(now.toISOString())
  const sinceKey = shiftMonth(currentMonth, -(monthsBack - 1))

  const presentKeys = [...months.keys()]
  const rangeStart = presentKeys.length
    ? [sinceKey, ...presentKeys].sort()[0]
    : sinceKey
  const rangeEnd = presentKeys.length
    ? [currentMonth, ...presentKeys].sort().slice(-1)[0]
    : currentMonth

  const series = fillMonthRange(rangeStart, rangeEnd).map(
    key => months.get(key) || emptyMonth({ month: key, label: monthLabel(key) })
  )

  // --- Totales históricos ---------------------------------------------------
  const allOrderKeys = new Set()
  for (const set of orderKeysByMonth.values()) {
    for (const key of set) allOrderKeys.add(key)
  }

  const revenue = round2(series.reduce((sum, m) => sum + m.revenue, 0))
  const orders = allOrderKeys.size
  const units = series.reduce((sum, m) => sum + m.units, 0)

  // --- Desglose por estado --------------------------------------------------
  const statusMap = new Map()
  for (const row of list) {
    const status = row.status || 'desconocido'
    if (!statusMap.has(status)) {
      statusMap.set(status, { status, lines: 0, amount: 0, orderKeys: new Set() })
    }
    const entry = statusMap.get(status)
    entry.lines++
    entry.amount += lineAmount(row)
    entry.orderKeys.add(orderKey(row))
  }

  const byStatus = [...statusMap.values()]
    .map(entry => ({
      status: entry.status,
      lines: entry.lines,
      orders: entry.orderKeys.size,
      amount: round2(entry.amount),
      counts_as_revenue: isPurchase(entry.status),
    }))
    .sort((a, b) => b.amount - a.amount)

  // --- Productos más vendidos (histórico) -----------------------------------
  const productMap = new Map()
  for (const row of list) {
    if (!isPurchase(row.status)) continue
    accumulateProduct(productMap, row)
  }
  const top = rankProducts(productMap, topProducts)

  // --- Mes por defecto ------------------------------------------------------
  // Si el mes actual no tiene movimiento, conviene abrir en el último mes con
  // actividad: mostrar $0 en un mes vacío parece un error.
  const currentBucket = months.get(currentMonth)
  const currentHasActivity =
    currentBucket &&
    (currentBucket.revenue > 0 ||
      currentBucket.orders > 0 ||
      currentBucket.pending_count > 0 ||
      currentBucket.cancelled_count > 0)

  const lastActive = [...series].reverse().find(
    m => m.revenue > 0 || m.orders > 0 || m.pending_count > 0 || m.cancelled_count > 0
  )

  const defaultMonth = currentHasActivity ? currentMonth : (lastActive?.month || currentMonth)

  return {
    timezone: FINANCE_TIMEZONE,
    purchase_statuses: [...PURCHASE_STATUSES],
    default_month: defaultMonth,
    current_month: currentMonth,
    series,
    totals: {
      revenue,
      orders,
      units,
      avg_ticket: orders > 0 ? round2(revenue / orders) : 0,
      months_with_sales: series.filter(m => m.revenue > 0).length,
    },
    by_status: byStatus,
    top_products: top,
    data_quality: {
      rows_without_order_number: rowsWithoutOrderNumber,
      lines_with_deleted_product: linesWithDeletedProduct,
      lines_without_price: linesWithoutPrice,
      total_lines: list.length,
    },
  }
}
