'use client'

import { useState, useEffect, useRef } from 'react'
import { publicFetch } from '@/lib/giveaways/ui'

// Cada cuánto se consultan las cifras según el estado: más seguido cuanto más
// cerca está de pasar algo (abrir, cerrar, sortear).
const POLL_MS = { scheduled: 20000, active: 12000, closing: 10000, ready: 7000, drawing: 5000 }
const DEFAULT_POLL_MS = 15000

/**
 * Mantiene al día las cifras de un sorteo (personas, oportunidades y números
 * asignados) consultando /stats cada pocos segundos mientras la pestaña está
 * a la vista. Si el estado del sorteo cambió (se abrió, cerró o se realizó),
 * avisa con `onStatusChange` para que la página recargue todo.
 *
 * @param {string} slug
 * @param {{participants: number|null, tickets: number, ranges: number[][]|null}} initial cifras con las que arranca
 * @param {object} options
 * @param {string} options.status estado actual del sorteo en la página
 * @param {boolean} [options.enabled] false para no consultar (sorteo terminado)
 * @param {(status: string) => void} [options.onStatusChange]
 */
export function useGiveawayStats(slug, initial, { status, enabled = true, onStatusChange } = {}) {
  const [stats, setStats] = useState(initial)
  // Si la página trae cifras nuevas (por ejemplo, después de recargar el
  // comprobante), se usan esas. Se ajusta durante el render, sin un efecto aparte.
  const [seen, setSeen] = useState(initial)
  if (initial !== seen) {
    setSeen(initial)
    setStats(initial)
  }
  const statusRef = useRef(status)
  const callbackRef = useRef(onStatusChange)

  useEffect(() => {
    statusRef.current = status
    callbackRef.current = onStatusChange
  })

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    let timer = null

    function schedule() {
      const base = POLL_MS[statusRef.current] || DEFAULT_POLL_MS
      // Un poco de azar para que muchas personas no consulten todas a la vez.
      timer = setTimeout(run, base * (0.85 + Math.random() * 0.3))
    }

    async function run() {
      if (document.visibilityState === 'visible') {
        const result = await publicFetch(`/api/giveaways/public/${slug}/stats`)
        if (cancelled) return
        if (result.ok) {
          const { status: latest, participants, tickets, ranges } = result.data
          setStats({ participants, tickets, ranges })
          if (latest !== statusRef.current) {
            statusRef.current = latest
            callbackRef.current?.(latest)
          }
        }
      }
      if (!cancelled) schedule()
    }

    // Al volver a la pestaña se actualiza enseguida, sin esperar al próximo turno.
    function onVisible() {
      if (document.visibilityState !== 'visible') return
      clearTimeout(timer)
      run()
    }

    document.addEventListener('visibilitychange', onVisible)
    schedule()
    return () => {
      cancelled = true
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [slug, enabled])

  return stats
}
