'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { HiOutlineXMark, HiOutlineCheckCircle, HiOutlineExclamationCircle, HiOutlineInformationCircle } from 'react-icons/hi2'
import { createPortal } from 'react-dom'

const ICONS = {
  success: HiOutlineCheckCircle,
  error: HiOutlineExclamationCircle,
  warning: HiOutlineExclamationCircle,
  info: HiOutlineInformationCircle,
  confirm: HiOutlineInformationCircle,
  none: null,
}

const ICON_COLORS = {
  success: 'text-green-500',
  error: 'text-red-500',
  warning: 'text-amber-500',
  info: 'text-celeste',
  confirm: 'text-primary-light',
  none: '',
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  type = 'info',
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  onConfirm,
  onCancel,
  showCancel = true,
  children,
  size = 'md',
  closeOnOverlayClick = true,
  closeOnEscape = true,
  icon,
}) {
  const overlayRef = useRef(null)
  const contentRef = useRef(null)
  const previousActiveElement = useRef(null)

  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement
      document.body.style.overflow = 'hidden'
      contentRef.current?.focus()
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return
      if (e.key === 'Escape' && closeOnEscape) {
        onCancel?.()
        onClose()
      }
      if (e.key === 'Tab') {
        const focusableElements = contentRef.current?.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        if (!focusableElements?.length) return
        const first = focusableElements[0]
        const last = focusableElements[focusableElements.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, closeOnEscape, onClose, onCancel])

  const SIZE_CLASSES = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    full: 'max-w-4xl',
  }

  if (!isOpen && !children) return null

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            ref={overlayRef}
            className="fixed inset-0 z-50 bg-carbon/80 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeOnOverlayClick ? onClose : undefined}
            aria-hidden="true"
          />
          <motion.div
            ref={contentRef}
            className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${SIZE_CLASSES[size]}`}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            tabIndex={-1}
          >
            <div className="w-full card-dark rounded-2xl overflow-hidden border border-white/10 shadow-[0_20px_40px_-12px_rgba(0,0,0,0.4)]">
{(title || icon) && (
                <div className="flex items-start gap-4 p-6 sm:p-7 border-b border-white/5">
                  {icon && (
                    <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center">
                      {(() => {
                        const IconComponent = icon || ICONS[type] || ICONS.info
                        return <IconComponent className={`w-6 h-6 ${ICON_COLORS[type] || ICON_COLORS.info}`} />
                      })()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    {title && (
                      <h2 id="modal-title" className="font-display font-bold text-lg sm:text-xl text-white">
                        {title}
                      </h2>
                    )}
                    {description && (
                      <p className="mt-2 text-sm text-white/60 leading-relaxed">
                        {description}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={onClose}
                    className="flex-shrink-0 p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
                    aria-label="Cerrar"
                  >
                    <HiOutlineXMark size={20} />
                  </button>
                </div>
              )}
              <div className="p-6 sm:p-7">
                {children}
              </div>
              {(onConfirm || showCancel) && (
                <div className="flex items-center justify-end gap-3 p-6 sm:p-7 border-t border-white/5 bg-white/[0.02] rounded-b-2xl">
                  {showCancel && (
                    <button
                      onClick={() => { onCancel?.(); onClose(); }}
                      className="px-5 py-2.5 rounded-lg text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 border border-white/10 transition-all"
                    >
                      {cancelText}
                    </button>
                  )}
                  {onConfirm && (
                    <button
                      onClick={() => { onConfirm(); onClose(); }}
                      className="px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-primary hover:bg-primary-dark shadow-lg shadow-primary/25 transition-all"
                    >
                      {confirmText}
                    </button>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )

  if (typeof window === 'undefined') return null

  return createPortal(modalContent, document.body)
}

export function useModal() {
  const [state, setState] = useState({
    isOpen: false,
    title: '',
    description: '',
    type: 'info',
    confirmText: 'Confirmar',
    cancelText: 'Cancelar',
    onConfirm: () => {},
    onCancel: () => {},
    showCancel: true,
    size: 'md',
    children: null,
  })

  const open = (options) => setState({ ...state, isOpen: true, ...options })
  const close = () => setState({ ...state, isOpen: false })

  return { ...state, open, close }
}

export function Alert({ isOpen, onClose, title, message, type = 'info', confirmText = 'Entendido' }) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description={message}
      type={type}
      confirmText={confirmText}
      showCancel={false}
      size="sm"
    />
  )
}

export function Confirm({ isOpen, onClose, title, message, onConfirm, confirmText = 'Confirmar', cancelText = 'Cancelar', type = 'confirm' }) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description={message}
      type={type}
      confirmText={confirmText}
      cancelText={cancelText}
      onConfirm={onConfirm}
      showCancel={true}
      size="sm"
    />
  )
}

export function Toast({ message, type = 'info', duration = 4000, onClose }) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false)
      onClose?.()
    }, duration)
    return () => clearTimeout(timer)
  }, [duration, onClose])

  if (!visible) return null

  return createPortal(
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-4 card-dark rounded-xl border border-white/10 shadow-lg max-w-sm"
      role="alert"
      aria-live="polite"
    >
      <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
          {(() => {
            const IconComponent = ICONS[type] || ICONS.info
            return <IconComponent className={`w-5 h-5 ${ICON_COLORS[type] || ICON_COLORS.info}`} />
          })()}
        </div>
      <p className="text-sm text-white/90 flex-1">{message}</p>
      <button
        onClick={() => { setVisible(false); onClose?.(); }}
        className="flex-shrink-0 p-1 text-white/40 hover:text-white transition-colors"
        aria-label="Cerrar"
      >
        <HiOutlineXMark size={18} />
      </button>
    </motion.div>,
    document.body
  )
}

export function useToast() {
  const [toasts, setToasts] = useState([])

  const show = (message, type = 'info', duration = 4000) => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type, duration }])
    return id
  }

  const dismiss = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  return { toasts, show, dismiss }
}