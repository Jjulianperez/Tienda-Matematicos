// Validación de imágenes subidas por el admin (H10).
//
// No alcanza con mirar el `type` que manda el navegador: cualquiera puede
// mandar un archivo cualquiera con un Content-Type falso. Por eso se revisan
// los primeros bytes (firma del archivo) además del tamaño.

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024

// Bytes que tiene que tener el archivo al principio, según su formato.
export function detectImageType(head) {
  const bytes = head instanceof Uint8Array ? head : new Uint8Array(head)

  // JPEG: FF D8 FF
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg'
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  if (bytes.length >= 8 && png.every((b, i) => bytes[i] === b)) {
    return 'image/png'
  }

  // WebP: "RIFF" ???? "WEBP"
  const ascii = (from, to) => String.fromCharCode(...bytes.slice(from, to))
  if (bytes.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') {
    return 'image/webp'
  }

  return null
}

// Devuelve { ok: true, type } o { ok: false, status, error }.
export function validateImageUpload({ size, head }) {
  if (typeof size !== 'number' || size <= 0) {
    return { ok: false, status: 400, error: 'La imagen está vacía' }
  }
  if (size > MAX_IMAGE_BYTES) {
    return { ok: false, status: 413, error: 'La imagen supera el máximo de 5 MB' }
  }

  const type = detectImageType(head)
  if (!type) {
    return { ok: false, status: 400, error: 'El archivo no es una imagen JPG, PNG o WebP' }
  }

  return { ok: true, type }
}
