'use client'

import { useCart } from '@/context/CartContext'
import { motion } from 'framer-motion'
import { HiOutlineShoppingBag } from 'react-icons/hi2'

export function CartIcon() {
  const { totalItems, openCart } = useCart()

  return (
    <button
      onClick={openCart}
      className="relative p-3 rounded-xl text-white/60 hover:text-white hover:bg-white/5 transition-colors"
      aria-label={`Carrito (${totalItems} items)`}
    >
      <HiOutlineShoppingBag size={22} />
      {totalItems > 0 && (
        <motion.span
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center"
        >
          {totalItems > 99 ? '99+' : totalItems}
        </motion.span>
      )}
    </button>
  )
}