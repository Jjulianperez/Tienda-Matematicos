'use client'

import { useEffect, useRef } from 'react'

/**
 * Conecta un motor de canvas (urna o ruleta) con React: lo crea al montar, lo
 * ajusta al ancho disponible, lo pausa cuando no está a la vista y lo destruye
 * al salir. `init` se llama una vez con el motor recién creado (para pasarle los
 * datos iniciales o arrancar una animación).
 *
 * Devuelve las referencias que el componente pone en su <div> y su <canvas>.
 *
 * @param {(canvas: HTMLCanvasElement, options: {reducedMotion: boolean}) => object} createEngine
 * @param {{reducedMotion?: boolean, init?: (engine: object) => void}} options
 */
export function useEngine(createEngine, { reducedMotion = false, init } = {}) {
  const wrapRef = useRef(null)
  const canvasRef = useRef(null)
  const engineRef = useRef(null)
  const initRef = useRef(init)

  // Siempre la versión más nueva de `init`, sin volver a crear el motor.
  useEffect(() => {
    initRef.current = init
  })

  useEffect(() => {
    const engine = createEngine(canvasRef.current, { reducedMotion })
    engineRef.current = engine
    engine.resize(wrapRef.current.clientWidth)
    initRef.current?.(engine)
    engine.start()

    const resize = new ResizeObserver(entries => engine.resize(entries[0].contentRect.width))
    resize.observe(wrapRef.current)
    const visibility = new IntersectionObserver(([entry]) => engine.setVisible(entry.isIntersecting))
    visibility.observe(wrapRef.current)

    return () => {
      resize.disconnect()
      visibility.disconnect()
      engine.destroy()
      engineRef.current = null
    }
  }, [createEngine, reducedMotion])

  return { wrapRef, canvasRef, engineRef }
}
