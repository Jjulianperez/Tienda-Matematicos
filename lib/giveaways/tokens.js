// Token opaco del comprobante de participación.
//
// El participante recibe el token en su enlace; en la base solo se guarda el
// hash. Si alguien llegara a leer la tabla, no podría reconstruir los enlaces.
// Nunca se usa un id secuencial en la URL (IDOR).

import { randomHex, sha256Hex, hmacSha256, bytesToHex } from './crypto-utils'

const TOKEN_BYTES = 32

export function generateAccessToken() {
  return randomHex(TOKEN_BYTES)
}

// Token derivado de la clave de idempotencia de la inscripción.
//
// Si la inscripción se reintenta (cortes de red, doble toque), el servidor
// tiene que devolver EL MISMO token sin haberlo guardado en claro. Por eso sale
// de un HMAC con un secreto del servidor: sin ese secreto no se puede calcular
// el token de otra persona aunque se conozca su clave de idempotencia.
export async function deriveAccessToken(secret, giveawayId, idempotencyKey) {
  if (typeof secret !== 'string' || secret.length < 32) throw new Error('Secreto inválido')
  const mac = await hmacSha256(
    new TextEncoder().encode(secret),
    `giveaway-access-token|${giveawayId}|${idempotencyKey}`
  )
  return bytesToHex(mac)
}

export function isValidAccessToken(value) {
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value)
}

export async function hashAccessToken(token) {
  if (!isValidAccessToken(token)) throw new Error('Token inválido')
  return sha256Hex(token)
}
