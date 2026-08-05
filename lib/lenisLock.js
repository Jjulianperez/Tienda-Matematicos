'use client'

let lenisInstance = null

export function registerLenis(lenis) {
  lenisInstance = lenis
  return () => {
    if (lenisInstance === lenis) lenisInstance = null
  }
}

export function stopLenis() {
  if (lenisInstance) lenisInstance.stop()
}

export function startLenis() {
  if (lenisInstance) lenisInstance.start()
}
