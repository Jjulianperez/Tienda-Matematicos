// Escape de texto para insertarlo en HTML (H13).
//
// Los emails de notificación llevan datos que escribe el cliente (nombre,
// teléfono). Sin escapar, un nombre con etiquetas HTML llega tal cual al
// correo del admin.
const ENTITIES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ENTITIES[ch])
}
