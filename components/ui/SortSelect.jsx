'use client'

import { useState, useRef, useEffect, useId } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { HiOutlineChevronDown } from 'react-icons/hi2'

export default function SortSelect({ options, value, onChange }) {
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const rootRef = useRef(null)
  const buttonRef = useRef(null)
  const listId = useId()

  const selected = options.find(o => o.value === value) ?? options[0]

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const toggle = () => {
    if (!open) setHighlighted(Math.max(0, options.findIndex(o => o.value === value)))
    setOpen(o => !o)
  }

  const choose = (opt) => {
    onChange(opt.value)
    setOpen(false)
    buttonRef.current?.focus()
  }

  const onButtonKeyDown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) {
        setHighlighted(Math.max(0, options.findIndex(o => o.value === value)))
        setOpen(true)
      } else {
        setHighlighted(prev =>
          e.key === 'ArrowDown'
            ? Math.min(prev + 1, options.length - 1)
            : Math.max(prev - 1, 0)
        )
      }
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (open) choose(options[highlighted])
      else setOpen(true)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={rootRef} className="relative w-full sm:w-56">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        onKeyDown={onButtonKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        className="input-dark h-12 w-full cursor-pointer flex items-center justify-between gap-3 text-left bg-white/5 border border-white/10 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
      >
        <span className="truncate">{selected.label}</span>
        <HiOutlineChevronDown
          size={16}
          aria-hidden="true"
          className={`shrink-0 text-primary-light transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            id={listId}
            role="listbox"
            className="absolute z-30 mt-2 w-full rounded-xl border border-white/10 bg-graphite shadow-2xl py-1.5 overflow-hidden"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            data-lenis-prevent
          >
            {options.map((opt, idx) => {
              const isSelected = opt.value === value
              const isHighlighted = idx === highlighted
              return (
                <li key={opt.value} role="none">
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => choose(opt)}
                    onMouseEnter={() => setHighlighted(idx)}
                    className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 text-sm text-left transition-colors ${
                      isHighlighted ? 'bg-white/10 text-white' : 'text-white/60'
                    } ${isSelected ? 'font-medium text-primary-light' : ''}`}
                  >
                    {opt.label}
                    {isSelected && <span className="shrink-0 text-primary-light">✓</span>}
                  </button>
                </li>
              )
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}
