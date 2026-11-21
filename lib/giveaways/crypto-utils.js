// Utilidades de criptografía del módulo de sorteos.
//
// Usan Web Crypto (globalThis.crypto), que existe igual en Node, en el runtime
// edge y en el navegador. Así el mismo código sirve para sortear en el servidor
// y para que cualquiera verifique un resultado después.

const encoder = new TextEncoder()

export function bytesToHex(bytes) {
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}

export function hexToBytes(hex) {
  if (typeof hex !== 'string' || hex.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(hex)) {
    throw new Error('Hex inválido')
  }
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

function toBytes(input) {
  return typeof input === 'string' ? encoder.encode(input) : input
}

// SHA-256 de un texto (UTF-8) o de bytes, en hexadecimal.
export async function sha256Hex(input) {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', toBytes(input))
  return bytesToHex(new Uint8Array(digest))
}

// HMAC-SHA256: devuelve los 32 bytes de la firma.
export async function hmacSha256(keyBytes, message) {
  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await globalThis.crypto.subtle.sign('HMAC', key, toBytes(message))
  return new Uint8Array(signature)
}

// Bytes aleatorios criptográficamente seguros, en hexadecimal.
export function randomHex(byteLength) {
  return bytesToHex(globalThis.crypto.getRandomValues(new Uint8Array(byteLength)))
}
