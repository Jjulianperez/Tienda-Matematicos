'use client'

import { useEffect, useRef } from 'react'
import Lenis from 'lenis'
import { registerLenis } from '@/lib/lenisLock'

export default function SmoothScroll({ children }) {
  const lenisRef = useRef(null)

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      wheelMultiplier: 1,
      touchMultiplier: 1.5,
    })

    lenisRef.current = lenis
    const unregister = registerLenis(lenis)

    function raf(time) {
      lenis.raf(time)
      requestAnimationFrame(raf)
    }

    requestAnimationFrame(raf)

    return () => {
      unregister()
      lenis.destroy()
    }
  }, [])

  return children
}
