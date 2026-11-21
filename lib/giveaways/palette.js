// Colores de las esferas, la ruleta y el tablero de números. Salen de la paleta
// de la tienda (verde oliva, beige, celeste, dorado).

export const SPHERE_COLORS = ['#94a86a', '#c9db9f', '#d7b98e', '#75aadb', '#dcb06e', '#a5c9e8']

// La oportunidad de la persona que está mirando: se destaca del resto.
export const MINE_COLOR = '#f4c95d'

function parseHex(hex) {
  const value = hex.replace('#', '')
  return [0, 2, 4].map(i => parseInt(value.slice(i, i + 2), 16))
}

/** Mezcla dos colores hex: t = 0 da `a`, t = 1 da `b`. */
export function mixHex(a, b, t) {
  const [r1, g1, b1] = parseHex(a)
  const [r2, g2, b2] = parseHex(b)
  const mix = (x, y) => Math.round(x + (y - x) * t)
  return `#${[mix(r1, r2), mix(g1, g2), mix(b1, b2)].map(v => v.toString(16).padStart(2, '0')).join('')}`
}

export const lighten = (hex, t) => mixHex(hex, '#ffffff', t)
export const darken = (hex, t) => mixHex(hex, '#0b0c08', t)

/**
 * Color del segmento `index` de `count` de la ruleta. Se cicla la paleta, pero
 * el último nunca repite el color del primero (se tocarían en el borde).
 */
export function segmentColor(index, count) {
  const n = SPHERE_COLORS.length
  let slot = index % n
  if (count > 1 && index === count - 1 && slot === 0) slot = Math.floor(n / 2)
  return SPHERE_COLORS[slot]
}
