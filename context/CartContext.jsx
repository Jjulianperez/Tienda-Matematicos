'use client'

import { createContext, useContext, useReducer, useEffect } from 'react'
import { computeSalePrice } from '@/lib/pricing'

const CartContext = createContext(null)

function cartReducer(state, action) {
  switch (action.type) {
    case 'ADD_ITEM': {
      const item = action.payload
      if (item.type === 'combo') {
        const exists = state.items.some(i => i.productId === item.productId)
        if (exists) return state
        return { ...state, items: [...state.items, item], isOpen: true }
      }
      const existingIndex = state.items.findIndex(i => i.productId === item.productId)
      if (existingIndex >= 0) {
        const newItems = [...state.items]
        const newQuantity = Math.min(
          newItems[existingIndex].quantity + item.quantity,
          newItems[existingIndex].stock
        )
        newItems[existingIndex] = { ...newItems[existingIndex], quantity: newQuantity }
        return { ...state, items: newItems, isOpen: true }
      }
      return { ...state, items: [...state.items, item], isOpen: true }
    }
    case 'REMOVE_ITEM':
      return { ...state, items: state.items.filter(i => i.productId !== action.payload) }
    case 'UPDATE_QUANTITY': {
      if (action.payload.quantity <= 0) {
        return { ...state, items: state.items.filter(i => i.productId !== action.payload.productId) }
      }
      return {
        ...state,
        items: state.items.map(item =>
          item.productId === action.payload.productId
            ? item.type === 'combo'
              ? item
              : { ...item, quantity: Math.min(action.payload.quantity, item.stock) }
            : item
        )
      }
    }
    case 'CLEAR_CART':
      return { ...state, items: [] }
    case 'TOGGLE_CART':
      return { ...state, isOpen: !state.isOpen }
    case 'OPEN_CART':
      return { ...state, isOpen: true }
    case 'CLOSE_CART':
      return { ...state, isOpen: false }
    case 'HYDRATE':
      return { ...state, items: action.payload }
    default:
      return state
  }
}

export function getEffectiveUnitPrice(item, allItems) {
  if (item.type === 'combo') return Number(item.price)
  const base = Number(item.price)
  const promo = item.promo
  if (!promo) return base
  if (promo.min_quantity > 1 && promo.category_id) {
    const catQty = allItems
      .filter(i => i.type !== 'combo' && i.categoryId === promo.category_id)
      .reduce((sum, i) => sum + i.quantity, 0)
    if (catQty < promo.min_quantity) return base
  }
  return computeSalePrice(base, promo.discount_type, promo.discount_value)
}

export function CartProvider({ children }) {
  const [state, dispatch] = useReducer(cartReducer, { items: [], isOpen: false })

  useEffect(() => {
    try {
      const stored = localStorage.getItem('matematicos-cart')
      if (stored) {
        const items = JSON.parse(stored)
        dispatch({ type: 'HYDRATE', payload: items })
      }
    } catch (e) {
      console.warn('Failed to hydrate cart:', e)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('matematicos-cart', JSON.stringify(state.items))
  }, [state.items])

  const addItem = (item) => dispatch({ type: 'ADD_ITEM', payload: item })
  const removeItem = (productId) => dispatch({ type: 'REMOVE_ITEM', payload: productId })
  const updateQuantity = (productId, quantity) => dispatch({ type: 'UPDATE_QUANTITY', payload: { productId, quantity } })
  const clearCart = () => dispatch({ type: 'CLEAR_CART' })
  const openCart = () => dispatch({ type: 'OPEN_CART' })
  const closeCart = () => dispatch({ type: 'CLOSE_CART' })
  const toggleCart = () => dispatch({ type: 'TOGGLE_CART' })

  const subtotal = state.items.reduce((sum, item) => {
    return sum + getEffectiveUnitPrice(item, state.items) * item.quantity
  }, 0)
  const totalItems = state.items.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <CartContext.Provider value={{ state, addItem, removeItem, updateQuantity, clearCart, openCart, closeCart, toggleCart, subtotal, totalItems }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error('useCart must be used within a CartProvider')
  }
  return context
}
