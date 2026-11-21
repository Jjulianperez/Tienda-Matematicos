// Ayudas de dibujo compartidas por los motores de canvas (urna y ruleta).

export const TAU = Math.PI * 2

/** Rectángulo con esquinas redondeadas (sin depender de ctx.roundRect, que no está en todos los navegadores). */
export function roundedRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

/**
 * Etiqueta redondeada con texto, centrada en (x, y) y recortada para que no se
 * salga del canvas. `bounds` es el tamaño del canvas en píxeles CSS.
 */
export function drawPill(ctx, font, text, x, y, bounds, { border, color }) {
  ctx.font = font
  const height = 22
  const width = ctx.measureText(text).width + 18
  const left = Math.max(4, Math.min(bounds.width - width - 4, x - width / 2))
  const top = Math.max(4, Math.min(bounds.height - height - 4, y - height / 2))
  roundedRect(ctx, left, top, width, height, height / 2)
  ctx.fillStyle = 'rgba(17,17,17,0.92)'
  ctx.fill()
  ctx.lineWidth = 1.3
  ctx.strokeStyle = border
  ctx.stroke()
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, left + width / 2, top + height / 2 + 0.5)
}
