// Achica las fotos en el navegador antes de subirlas. Código de navegador.
//
// Una foto de la cámara de un celular pesa entre 3 y 8 MB, y el servidor de
// Vercel no acepta pedidos de más de unos 4,5 MB: sin esto, subir la foto
// directo desde la cámara o la galería falla. Reducida a 1600 px de lado mayor
// y guardada como JPEG, pesa 200–600 KB: sube rápido incluso con datos móviles,
// y se ve igual en la tienda. De paso, al volver a dibujarla se pierde la
// información oculta de la foto (como la ubicación donde se sacó).

export const MAX_SIDE = 1600
const JPEG_QUALITY = 0.85
const SKIP_BELOW_BYTES = 700 * 1024 // más chica que esto y que entra en 1600 px: se sube tal cual

/**
 * Tamaño al que hay que reducir una imagen para que su lado mayor no pase de
 * `maxSide`, sin cambiar la proporción y sin agrandarla nunca.
 */
export function fitWithin(width, height, maxSide = MAX_SIDE) {
  const longest = Math.max(width, height)
  if (!longest || longest <= maxSide) return { width, height, scaled: false }
  const factor = maxSide / longest
  return {
    width: Math.max(1, Math.round(width * factor)),
    height: Math.max(1, Math.round(height * factor)),
    scaled: true,
  }
}

// Decodifica la imagen respetando la orientación de la cámara (una foto sacada
// de costado no tiene que salir acostada).
async function decode(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      // Navegador sin esa opción: se usa el camino de abajo.
    }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('No se pudo leer la imagen'))
    }
    image.src = url
  })
}

/**
 * Devuelve el archivo listo para subir: reducido y como JPEG si hace falta, o
 * el mismo archivo si ya es liviano, si no es una foto común (GIF, SVG) o si
 * algo falla. Nunca devuelve algo más pesado que el original.
 *
 * @param {File} file
 * @returns {Promise<File>}
 */
export async function prepareImageForUpload(file, { maxSide = MAX_SIDE, quality = JPEG_QUALITY } = {}) {
  try {
    if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.type === 'image/svg+xml') return file

    const source = await decode(file)
    const target = fitWithin(source.width, source.height, maxSide)
    if (!target.scaled && file.size <= SKIP_BELOW_BYTES) {
      source.close?.()
      return file
    }

    const canvas = document.createElement('canvas')
    canvas.width = target.width
    canvas.height = target.height
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      source.close?.()
      return file
    }
    // El JPEG no tiene transparencia: lo transparente de un PNG saldría negro.
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, target.width, target.height)
    ctx.drawImage(source, 0, 0, target.width, target.height)
    source.close?.()

    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality))
    if (!blob || blob.size >= file.size) return file

    const name = `${file.name.replace(/\.[^.]+$/, '') || 'foto'}.jpg`
    return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() })
  } catch {
    return file
  }
}
