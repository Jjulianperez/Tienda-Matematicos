'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { createPortal } from 'react-dom'

export default function LoadingModal({ open, message = 'Cargando productos...' }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const id = setTimeout(() => setMounted(true), 0)
    return () => clearTimeout(id)
  }, [])

  if (!open || !mounted) return null

  return createPortal(
    <motion.div
      key="loading-modal"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-carbon/90 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      role="status"
      aria-live="polite"
      aria-label={message}
    >
      <motion.div
        className="bg-graphite border border-white/10 rounded-2xl shadow-2xl p-8 sm:p-10 text-center max-w-sm mx-4"
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      >
        <div className="relative w-16 h-16 mx-auto mb-6">
          <svg className="w-full h-full text-primary-light" viewBox="0 0 44 44">
            <circle
              className="opacity-20"
              cx="22"
              cy="22"
              r="18"
              fill="none"
              strokeWidth="4"
            />
            <motion.circle
              className="stroke-primary-light"
              cx="22"
              cy="22"
              r="18"
              fill="none"
              strokeWidth="4"
              strokeDasharray="90 150"
              strokeLinecap="round"
              animate={{ rotate: 360 }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
              style={{ transformOrigin: '22px 22px' }}
            />
          </svg>
        </div>
        <p className="font-display font-semibold text-lg text-white mb-2">Cargando</p>
        <p className="text-white/50 text-sm">{message}</p>
      </motion.div>
    </motion.div>,
    document.body
  )
}