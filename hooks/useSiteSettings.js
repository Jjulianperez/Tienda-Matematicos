'use client'

import { useState, useEffect } from 'react'
import { PUBLIC_DEFAULTS, mergePublicSettings } from '@/lib/site-settings'

let cachedSettings = null
let cachePromise = null

export function useSiteSettings() {
  const [settings, setSettings] = useState(PUBLIC_DEFAULTS)

  useEffect(() => {
    let active = true
    const timer = setTimeout(() => {
      if (cachedSettings) {
        if (active) setSettings(cachedSettings)
        return
      }
      if (!cachePromise) {
        cachePromise = fetch('/api/settings/public', { cache: 'no-store' })
          .then(res => (res.ok ? res.json() : null))
          .then(data => {
            cachedSettings = mergePublicSettings(data)
            return cachedSettings
          })
          .catch(() => {
            cachedSettings = PUBLIC_DEFAULTS
            return cachedSettings
          })
      }
      cachePromise.then(data => {
        if (active) setSettings(data)
      })
    }, 0)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [])

  return settings
}
