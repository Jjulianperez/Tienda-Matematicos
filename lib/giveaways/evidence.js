// Validación de las capturas que suben los participantes.
//
// Se mira el contenido real (firma del archivo y tamaño), no el Content-Type
// que declara el navegador. Solo se aceptan JPEG, PNG y WebP.
//
// El máximo es 4 MB porque las funciones de Vercel limitan el cuerpo de la
// petición a unos 4,5 MB; una captura más grande no llegaría igual.

export const MAX_EVIDENCE_BYTES = 4 * 1024 * 1024
export const EVIDENCE_SIGNATURE_BYTES = 16

const EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export function detectEvidenceType(head) {
  const bytes = head instanceof Uint8Array ? head : new Uint8Array(head)

  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg'
  }

  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  if (bytes.length >= 8 && png.every((b, i) => bytes[i] === b)) return 'image/png'

  const ascii = (from, to) => String.fromCharCode(...bytes.slice(from, to))
  if (bytes.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp'

  return null
}

// Devuelve { ok: true, mime } o { ok: false, status, error }.
export function validateEvidenceFile({ size, head }) {
  if (typeof size !== 'number' || size <= 0) {
    return { ok: false, status: 400, error: 'La captura está vacía' }
  }
  if (size > MAX_EVIDENCE_BYTES) {
    return { ok: false, status: 413, error: 'La captura supera el máximo de 4 MB' }
  }
  const mime = detectEvidenceType(head)
  if (!mime) {
    return { ok: false, status: 400, error: 'La captura tiene que ser una imagen JPG, PNG o WebP' }
  }
  return { ok: true, mime }
}

// Ruta dentro del bucket privado. Lleva el hash del archivo, así que subir dos
// veces la misma captura cae en la misma ruta.
export function evidenceStoragePath({ giveawayId, participantId, sha256, mime }) {
  return `${giveawayId}/${participantId}/${sha256}.${EXTENSIONS[mime]}`
}
