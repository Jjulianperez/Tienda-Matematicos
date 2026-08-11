'use client'

import { useState, useEffect } from 'react'
import { getWeightPromos, getWeightPromosNow } from '@/lib/weight-promos'

export function useWeightPromos() {
  const [weightPromos, setWeightPromos] = useState(getWeightPromosNow)

  useEffect(() => {
    let active = true
    const timer = setTimeout(() => {
      getWeightPromos().then(data => {
        if (active) setWeightPromos(data)
      })
    }, 0)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [])

  return weightPromos
}
