'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { HiOutlineX } from 'react-icons/hi'
import { HiHeart, HiOutlineHeart } from 'react-icons/hi2'

const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER

export default function ProductModal({ product, onClose }) {
  const [selectedImage, setSelectedImage] = useState(0)
  const [clicked, setClicked] = useState(false)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  if (!product) return null

  const whatsappMessage = encodeURIComponent(
    `Hola, vengo del catálogo de MateMáticos y me gustaría adquirir este producto:\n\n` +
    `*${product.name}*\n` +
    `Precio: $${Number(product.price).toLocaleString('es-AR')}\n` +
    `${product.images?.[0] ? `Foto: ${product.images[0]}` : ''}\n\n` +
    `¿Está disponible?`
  )

  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${whatsappMessage}`

  const handleWhatsAppClick = async () => {
    setClicked(true)
    await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_id: product.id,
        quantity: 1,
        customer_name: '',
        customer_phone: WHATSAPP_NUMBER,
      }),
    })
    window.open(whatsappUrl, '_blank')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-carbon border border-white/10 rounded-3xl overflow-hidden flex flex-col lg:flex-row animate-in fade-in zoom-in duration-300">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
        >
          <HiOutlineX size={18} className="text-white" />
        </button>

        <div className="lg:w-3/5 relative">
          <div className="relative aspect-square bg-white/5">
            {product.images?.[selectedImage] ? (
              <Image
                src={product.images[selectedImage]}
                alt={product.name}
                fill
                className="object-contain p-8"
                sizes="(max-width: 1024px) 100vw, 60vw"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-8xl text-white/10">
                🧉
              </div>
            )}
          </div>

          {product.images?.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
              {product.images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedImage(i)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    i === selectedImage ? 'bg-primary w-6' : 'bg-white/30'
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        <div className="lg:w-2/5 p-6 lg:p-8 flex flex-col justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-white/30 mb-2">
              {product.categories?.name || 'Producto'}
            </p>
            <h2 className="text-2xl font-semibold text-white mb-2">
              {product.name}
            </h2>
            <p className="text-3xl font-bold text-primary mb-4">
              ${Number(product.price).toLocaleString('es-AR')}
            </p>
            <p className="text-white/60 text-sm leading-relaxed mb-4">
              {product.description}
            </p>
            <p className="text-xs text-white/30">
              Stock: {product.stock > 0 ? product.stock : 'Consultar'}
            </p>
          </div>

          <div className="mt-6 space-y-3">
            <button
              onClick={handleWhatsAppClick}
              disabled={clicked}
              className="w-full py-3 px-6 rounded-xl bg-primary hover:bg-primary-dark text-white font-medium transition-all active:scale-95 disabled:opacity-50"
            >
              {clicked ? 'Redirigiendo...' : 'Consultar por WhatsApp'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
