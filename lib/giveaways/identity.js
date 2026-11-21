// Identidad de los participantes.
//
// El teléfono se normaliza con normalizePhone (lib/customers.js). Acá vive solo
// el usuario de Instagram, que se usa como segunda clave de unicidad: una
// misma persona no debería inscribirse dos veces con teléfonos distintos.

// Rutas de instagram.com que no son un perfil.
const RESERVED_PATHS = new Set([
  'p', 'reel', 'reels', 'tv', 'stories', 'explore', 'accounts', 'direct', 'about',
])

/**
 * Normaliza un usuario de Instagram. Acepta "@Usuario", "usuario" o la URL del
 * perfil. Devuelve el usuario en minúsculas o null si no es válido.
 */
export function normalizeInstagramHandle(input) {
  if (typeof input !== 'string') return null
  let value = input.trim().toLowerCase()
  if (!value) return null

  const profileUrl = value.match(/^(?:https?:\/\/)?(?:www\.)?instagram\.com\/([^/?#\s]+)/)
  if (profileUrl) value = profileUrl[1]

  value = value.replace(/^@+/, '')

  if (RESERVED_PATHS.has(value)) return null
  if (!/^[a-z0-9._]{1,30}$/.test(value)) return null
  if (value.startsWith('.') || value.endsWith('.') || value.includes('..')) return null

  return value
}
