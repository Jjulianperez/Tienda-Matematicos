'use client'

import Link from 'next/link'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { useEffect, useState } from 'react'

export default function Home() {
  const [products, setProducts] = useState([])

  useEffect(() => {
    fetch('/api/products')
      .then(res => res.json())
      .then(data => setProducts(data?.slice(0, 4) || []))
      .catch(() => {})
  }, [])

  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="min-h-screen flex flex-col items-center justify-center px-4 bg-carbon relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-carbon" />
          <div className="relative z-10 text-center max-w-2xl">
            <span className="text-8xl mb-6 block animate-float">🧉</span>
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-white mb-4">
              El mate perfecto
              <br />
              <span className="text-primary">no es casualidad.</span>
            </h1>
            <p className="text-lg sm:text-xl text-white/50 font-light mb-8">
              Es matemática.
            </p>
            <Link
              href="/catalogo"
              className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-primary hover:bg-primary-dark text-white font-medium transition-all active:scale-95"
            >
              Ver catálogo
            </Link>
          </div>

          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-white/30">
              <path d="M12 5v14m0 0l-6-6m6 6l6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </section>

        {products.length > 0 && (
          <section className="py-20 px-4 bg-carbon border-t border-white/5">
            <div className="max-w-7xl mx-auto">
              <h2 className="text-2xl sm:text-3xl font-semibold text-white mb-2">
                Más solicitados
              </h2>
              <p className="text-white/40 mb-8">Los favoritos de nuestros clientes</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
                {products.map(product => (
                  <Link key={product.id} href="/catalogo" className="group">
                    <div className="relative aspect-square bg-white/5 rounded-2xl overflow-hidden border border-white/5 group-hover:border-primary/30 transition-all">
                      {product.images?.[0] ? (
                        <img
                          src={product.images[0]}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-6xl text-white/10">🧉</div>
                      )}
                    </div>
                    <h3 className="mt-3 text-white/90 font-medium">{product.name}</h3>
                    <p className="text-primary font-semibold">${Number(product.price).toLocaleString('es-AR')}</p>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="py-20 px-4 bg-carbon/50">
          <div className="max-w-3xl mx-auto text-center">
            <div className="text-4xl mb-6">📐</div>
            <h2 className="text-2xl sm:text-3xl font-semibold text-white mb-4">
              Toda ecuación necesita su variable
            </h2>
            <p className="text-white/50 leading-relaxed">
              Seleccionamos cada producto con precisión matemática.
              Porque el mate perfecto no se encuentra: se construye.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
