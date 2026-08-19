'use client'

import { useSyncExternalStore, useRef, useCallback } from 'react'
import { Alert } from '@/components/Modal'
import {
  PAYMENT_DUE_DAY,
  PAYMENT_TIMEZONE,
  PAYMENT_TEST_DATE,
} from '@/lib/admin-config'

const MONTH_NAMES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

function getCurrentDate(timezone, testDate) {
  if (testDate) return testDate
  return new Date().toLocaleString('en-CA', { timeZone: timezone })
}

function getStorageKey(dateStr) {
  const [y, m] = dateStr.split('-')
  return `monthly_payment_notice_${y}_${m.padStart(2, '0')}`
}

function getSnapshot() {
  const dateStr = getCurrentDate(PAYMENT_TIMEZONE, PAYMENT_TEST_DATE)
  const day = parseInt(dateStr.split('-')[2], 10)
  if (day < PAYMENT_DUE_DAY) return 'hide'
  const key = getStorageKey(dateStr)
  return localStorage.getItem(key) ? 'hide' : 'show'
}

function getServerSnapshot() {
  return 'hide'
}

export default function PaymentNotice() {
  const notifyRef = useRef(null)

  const subscribe = useCallback((callback) => {
    notifyRef.current = callback
    return () => { notifyRef.current = null }
  }, [])

  const shouldShow = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const dismiss = useCallback(() => {
    const dateStr = getCurrentDate(PAYMENT_TIMEZONE, PAYMENT_TEST_DATE)
    const key = getStorageKey(dateStr)
    localStorage.setItem(key, '1')
    notifyRef.current?.()
  }, [])

  if (shouldShow !== 'show') return null

  const [y, m] = getCurrentDate(PAYMENT_TIMEZONE, PAYMENT_TEST_DATE).split('-')
  const monthName = MONTH_NAMES[parseInt(m, 10) - 1]

  return (
    <Alert
      isOpen
      onClose={dismiss}
      title="Mensualidad de la aplicación"
      message={`Recordá realizar el pago mensual de la aplicación y mantenimiento correspondiente a este mes.\n\nFecha de pago: ${PAYMENT_DUE_DAY} de ${monthName}`}
      type="warning"
      confirmText="Entendido"
    />
  )
}
