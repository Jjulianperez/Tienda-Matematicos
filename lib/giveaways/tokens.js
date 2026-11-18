// Token opaco del comprobante de participación.
//
// El participante recibe el token en su enlace; en la base solo se guarda el
// hash. Si alguien llegara a leer la tabla, no podría reconstruir los enlaces.
// Nunca se usa un id secuencial en la URL (IDOR).

import { randomHex, sha256Hex } from './crypto-utils'

const TOKEN_BYTES = 32

export function generateAccessToken() {
  return randomHex(TOKEN_BYTES)
}

export function isValidAccessToken(value) {
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value)
}

export async function hashAccessToken(token) {
  if (!isValidAccessToken(token)) throw new Error('Token inválido')
  return sha256Hex(token)
}
