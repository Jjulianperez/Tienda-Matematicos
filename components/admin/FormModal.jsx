'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { HiOutlineXMark } from 'react-icons/hi2'
import { stopLenis, startLenis } from '@/lib/lenisLock'

export default function FormModal({ open, onClose, title, subtitle, children, footer, maxWidth = 'max-w-2xl' }) {
  useEffect(() => {
    if (open) {
      stopLenis()
      document.body.style.overflow = 'hidden'
    } else {
      startLenis()
      document.body.style.overflow = ''
    }
    return () => {
      startLenis()
      document.body.style.overflow = ''
    }
  }, [open])

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose()
    }
    if (open) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (typeof window === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="overlay"
            className="fixed inset-0 z-50 bg-carbon/80 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            key="panel"
            className={`fixed inset-y-0 right-0 z-50 w-full ${maxWidth} h-full bg-carbon border-l border-white/10 shadow-2xl flex flex-col`}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            role="dialog"
            aria-modal="true"
            aria-label={title}
          >
            <header className="flex items-start justify-between gap-4 px-6 sm:px-8 py-5 border-b border-white/10 shrink-0">
              <div className="min-w-0">
                <h2 className="font-display font-semibold text-xl text-white">{title}</h2>
                {subtitle && (
                  <p className="text-sm text-white/40 mt-1">{subtitle}</p>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors shrink-0"
                aria-label="Cerrar"
              >
                <HiOutlineXMark size={22} />
              </button>
            </header>

            <div data-lenis-prevent className="flex-1 overflow-y-auto">{children}</div>

            {footer && (
              <footer className="shrink-0 px-6 sm:px-8 py-5 border-t border-white/10 bg-carbon/95 backdrop-blur-md">
                {footer}
              </footer>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  )
}
