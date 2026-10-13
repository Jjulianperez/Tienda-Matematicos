'use client'

import { useSyncExternalStore } from 'react'

// ¿Se puede renderizar un portal todavía?
//
// El servidor no puede renderizar portales (createPortal depende de document) y
// el cliente sí. Si un componente decide con `typeof window === 'undefined'`, el
// servidor no renderiza nada y el cliente renderiza el portal, así que el HTML
// no coincide y React tira un error de hidratación (#418).
//
// Este hook devuelve false en el servidor Y en la hidratación, y true recién
// después de montar. Con eso el primer render del cliente coincide con el del
// servidor, y el portal aparece fuera de la hidratación.
//
// Se implementa con useSyncExternalStore y no con `useState` + `useEffect`
// porque React ya sabe reconciliar este caso solo: no hace falta un render
// extra, no hay un tick de retraso, y la regla react-hooks/set-state-in-effect
// rechaza el otro camino.
//
// Uso:
//   const mounted = useMounted()
//   if (!mounted) return null
//   return createPortal(contenido, document.body)
//
// LoadingModal usa un patrón equivalente (useState + setTimeout) que también es
// válido; este hook es el que conviene para código nuevo.

const subscribe = () => () => {}
const getSnapshot = () => true
const getServerSnapshot = () => false

export function useMounted() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
