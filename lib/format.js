// Formato de números y fechas para el panel.
//
// Estaba repetido como `Number(x).toLocaleString('es-AR')` en varias páginas.
// Se centraliza acá para que Clientes y Finanzas muestren los montos igual.

/**
 * Monto en pesos: 12150 -> "$12.150".
 * Las monedas de la tienda son enteras, por eso por defecto no muestra
 * decimales; con { decimals: true } se fuerzan dos.
 * @param {number|string|null|undefined} value
 * @param {{ decimals?: boolean }} [options]
 * @returns {string}
 */
export function formatMoney(value, options = {}) {
  const amount = Number(value || 0)
  const decimals = options.decimals ? 2 : 0
  return (
    '$' +
    amount.toLocaleString('es-AR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
  )
}

/**
 * Fecha corta: '12 oct 2026'.
 * @param {string|null|undefined} iso
 * @returns {string}
 */
export function formatDate(iso) {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * Fecha con hora, para el historial de pedidos.
 * @param {string|null|undefined} iso
 * @returns {string}
 */
export function formatDateTime(iso) {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * "hace 3 días" / "hoy" / "hace 2 meses". Sirve para el último contacto.
 * @param {string|null|undefined} iso
 * @returns {string}
 */
export function formatRelative(iso) {
  if (!iso) return 'Sin pedidos'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'

  const days = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24))
  if (days <= 0) return 'hoy'
  if (days === 1) return 'ayer'
  if (days < 30) return `hace ${days} días`
  const months = Math.floor(days / 30)
  if (months === 1) return 'hace 1 mes'
  if (months < 12) return `hace ${months} meses`
  const years = Math.floor(months / 12)
  return years === 1 ? 'hace 1 año' : `hace ${years} años`
}

/**
 * Porcentaje con signo, para las comparaciones mes a mes.
 * null cuando no hay base de comparación (evita dividir por cero).
 * @param {number} current
 * @param {number} previous
 * @returns {number|null}
 */
export function percentChange(current, previous) {
  if (!previous) return null
  return ((current - previous) / previous) * 100
}
