'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import ProductCard from '@/components/ProductCard'
import GeometricDecor from '@/components/ui/GeometricDecor'
import { fadeInUp, staggerCards } from '@/lib/animations'
import { HiOutlineArrowRight } from 'react-icons/hi2'

function AnimatedSection({ children, className }) {
  const ref = useRef(null)

  useEffect(() => {
    if (ref.current) fadeInUp(ref.current)
  }, [])

  return <div ref={ref} className={className}>{children}</div>
}

const INGREDIENTES = [
  { label: 'Yerba Premium', formula: 'Yᵣ' },
  { label: 'Bombilla', formula: 'B' },
  { label: 'Mate', formula: 'M' },
  { label: 'Temperatura ideal', formula: 'T=80°C' },
  { label: 'Compañía', formula: 'C' },
]

const PASOS = [
  {
    num: '01',
    title: 'Seleccionamos',
    desc: 'Cada materia prima pasa un control de calidad riguroso.',
    icon: '◯',
  },
  {
    num: '02',
    title: 'Diseñamos',
    desc: 'Geometría y ergonomía aplicada a cada pieza.',
    icon: '△',
  },
  {
    num: '03',
    title: 'Verificamos',
    desc: 'Pruebas de temperatura, flujo y durabilidad.',
    icon: '∠',
  },
  {
    num: '04',
    title: 'Entregamos',
    desc: 'Tu ecuación perfecta, lista para disfrutar.',
    icon: '∞',
  },
]

export default function Home() {
  const router = useRouter()
  const [products, setProducts] = useState([])
  const productsRef = useRef(null)

  useEffect(() => {
    fetch('/api/products')
      .then(res => res.json())
      .then(data => setProducts(data?.slice(0, 8) || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (productsRef.current?.children?.length) {
      staggerCards(productsRef.current)
    }
  }, [products])

  return (
    <>
      <Header />
      <main className="flex-1">
        {/* HERO */}
        <section className="min-h-[calc(100vh-var(--navbar-height))] flex flex-col items-center justify-center px-4 bg-carbon relative overflow-hidden">
          <GeometricDecor variant="blueprint" className="absolute inset-0 w-full h-full" />
          <div className="absolute inset-0 bg-gradient-to-b from-carbon/60 via-transparent to-carbon" />
          <div className="absolute -top-20 -left-20 w-96 h-96 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute -bottom-20 -right-20 w-96 h-96 rounded-full bg-celeste/10 blur-3xl" />

          <div className="relative z-10 text-center max-w-3xl px-4 py-20 sm:py-24">
            <div className="flex flex-wrap items-center justify-center gap-3 mb-10">
              <span className="badge badge-geo">Precisión Argentina</span>
              <span className="seal seal-leather">Artesanal</span>
              <span className="seal seal-argentina">🇦🇷</span>
            </div>
            <h1 className="font-display text-5xl sm:text-7xl lg:text-8xl font-bold tracking-tight text-white text-balance leading-[1.05]">
              El mate perfecto
              <br />
              <span className="text-primary-light italic">no es casualidad.</span>
            </h1>
            <p className="mt-7 text-lg sm:text-xl text-white/40 font-display italic">
              Es matemática. Y la resolvemos por vos.
            </p>
            <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/catalogo"
                className="btn-primary"
              >
                Ver catálogo
                <HiOutlineArrowRight size={18} />
              </Link>
              <a
                href="https://wa.me/542657583046"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-outline"
              >
                Consultar por WhatsApp
              </a>
            </div>
          </div>

          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 animate-bounce text-white/30">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14m0 0l-6-6m6 6l6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </section>

        {/* FRANJA DE PRECISIÓN */}
        <section className="bg-primary-dark/20 border-y border-white/5 py-7 relative overflow-hidden">
          <GeometricDecor variant="grid" className="absolute inset-0 w-full h-full opacity-50" />
          <div className="relative container-page flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-white/40 font-mono text-xs uppercase tracking-widest">
            <span>∫ Precisión</span>
            <span className="text-primary-light">•</span>
            <span>∑ Tradición</span>
            <span className="text-primary-light">•</span>
            <span>π Geometría</span>
            <span className="text-primary-light">•</span>
            <span>∞ Calidad</span>
            <span className="text-primary-light">•</span>
            <span>Δ Diseño</span>
          </div>
        </section>

        {/* FÓRMULA */}
        <AnimatedSection className="section-pad bg-carbon relative overflow-hidden">
          <GeometricDecor variant="fractal" className="absolute inset-0 w-full h-full opacity-20" />
          <div className="relative container-page text-center">
            <span className="badge badge-geo mb-4">La ecuación</span>
            <h2 className="font-display text-3xl sm:text-5xl font-bold text-white text-balance leading-tight mt-6 mb-12 sm:mb-16">
              La fórmula del <span className="text-primary-light">Mate Perfecto</span>
            </h2>
            <div className="card-dark rounded-3xl p-8 sm:p-12 relative overflow-hidden">
              <GeometricDecor variant="grid" className="absolute inset-0 w-full h-full opacity-40" />
              <div className="relative space-y-4">
                {INGREDIENTES.map((ing, i) => (
                  <div key={ing.label} className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-xl sm:text-2xl">
                    <span className="font-display font-semibold text-white">{ing.label}</span>
                    <span className="text-white/25 font-mono text-sm">[{ing.formula}]</span>
                    {i < INGREDIENTES.length - 1 && (
                      <span className="text-primary-light font-semibold">+</span>
                    )}
                  </div>
                ))}
                <div className="border-t border-white/10 pt-8 mt-8">
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <span className="font-mono text-primary-light text-2xl">→</span>
                    <p className="font-display text-4xl font-bold text-white">
                      Mate <span className="text-primary-light">Perfecto</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </AnimatedSection>

        {/* PROCESO */}
        <AnimatedSection className="section-pad bg-carbon border-t border-white/5">
          <div className="container-page">
            <div className="section-head text-center">
              <span className="badge badge-geo mb-4">Método</span>
              <h2 className="font-display text-3xl sm:text-5xl font-bold text-white mt-6 text-balance">
                Ingeniería de <span className="text-primary-light">precisión</span>
              </h2>
              <p className="mt-4 text-white/40 max-w-xl mx-auto">
                Así construimos cada producto que llega a tu mano.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {PASOS.map((paso) => (
                <div key={paso.num} className="card-dark p-8 group hover:border-primary/30 transition-colors">
                  <div className="flex items-center justify-between mb-6">
                    <span className="font-mono text-4xl font-bold text-white/10 group-hover:text-primary/40 transition-colors">
                      {paso.num}
                    </span>
                    <span className="font-mono text-2xl text-primary-light">{paso.icon}</span>
                  </div>
                  <h3 className="font-display font-semibold text-lg text-white">{paso.title}</h3>
                  <p className="text-sm text-white/40 mt-2 leading-relaxed">{paso.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </AnimatedSection>

        {/* PRODUCTOS */}
        {products.length > 0 && (
          <section className="section-pad bg-carbon border-t border-white/5">
            <div className="container-page">
              <div className="section-head flex flex-col sm:flex-row items-start sm:items-end justify-between gap-6">
                <div>
                  <span className="badge badge-geo mb-4">Resultados</span>
                  <h2 className="font-display text-3xl sm:text-5xl font-bold text-white mt-6 text-balance">
                    Más <span className="text-primary-light">solicitados</span>
                  </h2>
                  <p className="mt-4 text-white/40">Los favoritos de nuestros clientes</p>
                </div>
                <Link
                  href="/catalogo"
                  className="inline-flex items-center gap-2 btn-ghost"
                >
                  Ver todo el catálogo
                  <HiOutlineArrowRight size={15} />
                </Link>
              </div>
              <div ref={productsRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 sm:gap-8">
                {products.map(product => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onClick={() => router.push(`/producto/${product.id}`)}
                  />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* CITA */}
        <AnimatedSection className="section-pad bg-carbon/50 relative overflow-hidden">
          <GeometricDecor variant="compas" className="absolute inset-0 w-full h-full opacity-20" />
          <div className="relative container-page text-center py-8">
            <span className="font-mono text-3xl text-primary-light">“</span>
            <p className="font-display text-2xl sm:text-3xl text-white/60 font-light italic leading-relaxed mt-2">
              Toda gran idea comienza con un mate.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
              <span className="seal seal-argentina">Hecho en Argentina</span>
              <span className="seal seal-leather">Calidad certificada</span>
            </div>
          </div>
        </AnimatedSection>
      </main>
      <Footer />
    </>
  )
}
