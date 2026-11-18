'use client'

import { useSyncExternalStore } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

function subscribe(callback) {
  const media = window.matchMedia(QUERY)
  media.addEventListener('change', callback)
  return () => media.removeEventListener('change', callback)
}

// true si la persona pidió menos movimiento en su sistema. En ese caso las
// animaciones del sorteo se saltean y se muestra el resultado directamente.
// En el servidor devuelve false (no hay preferencia que consultar).
export function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false
  )
}
