'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import ProductCard from '@/components/ProductCard'
import GeometricDecor from '@/components/ui/GeometricDecor'
import {
  HiOutlineShoppingBag,
  HiOutlineChatBubbleLeftRight,
  HiOutlineChevronRight,
  HiOutlineTruck,
  HiOutlineShieldCheck,
  HiOutlineSparkles,
} from 'react-icons/hi2'
import { getOptimizedUrl } from '@/lib/images'

const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER

const SPECS = [
  { key: 'Origen', value: 'Argentina' },
  { key: 'Garantía', value: '100% artesanal' },
  { key: 'Entrega', value: 'Envíos a todo el país' },
]

const BENEFITS = [
  { icon: HiOutlineTruck, title: 'Envío seguro', desc: 'Packaging reforzado para que llegue intacto.' },
  { icon: HiOutlineShieldCheck, title: 'Calidad garantizada', desc: 'Seleccionado a mano por nuestros artesanos.' },
  { icon: HiOutlineSparkles, title: 'Precisión artesanal', desc: 'Cada pieza pasa por un control de calidad.' },
]

const FAQS = [
  { q: '¿Cómo hago el pedido?', a: 'Elegí tu producto y presioná "Comprar por WhatsApp". Te atendemos personalmente para coordinar pago y envío.' },
  { q: '¿Hacen envíos a todo el país?', a: 'Sí. Coordinamos el envío por correo y despachamos con embalaje reforzado.' },
  { q: '¿Los mates vienen listos para usar?', a: 'Sí. Recomendamos curar el mate siguiendo nuestra guía de cuidados para potenciar su sabor.' },
]

export default function ProductoDetalle() {
  const { id } = useParams()
  const router = useRouter()
  const [product, setProduct] = useState(null)
  const [related, setRelated] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeImg, setActiveImg] = useState(0)
  const [zoom, setZoom] = useState(false)
  const [openFaq, setOpenFaq] = useState(0)

  useEffect(() => {
    setLoading(true)
    setActiveImg(0)
    setZoom(false)
    setOpenFaq(0)

    fetch(`/api/products/${id}`)
      .then(res => {
        if (!res.ok) throw new Error('not found')
        return res.json()
      })
      .then(async (data) => {
        setProduct(data)

        const params = new URLSearchParams()
        if (data.category_id) params.set('categoria', data.categories?.slug)
        const res = await fetch(`/api/products?${params}`)
        const all = await res.json()
        const rest = all.filter(p => p.id !== data.id).slice(0, 4)
        setRelated(rest.length >= 2 ? rest : all.filter(p => p.id !== data.id).slice(0, 4))
        setLoading(false)
      })
      .catch(() => {
        setLoading(false)
        router.replace('/catalogo')
      })
  }, [id])

  if (loading) {
    return (
      <>
        <Header />
        <main className="flex-1 bg-carbon min-h-screen">
          <div className="container-page py-12 sm:py-16 animate-pulse">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20">
              <div className="aspect-square bg-white/5 rounded-3xl" />
              <div className="space-y-4 py-6">
                <div className="h-4 bg-white/5 rounded w-1/4" />
                <div className="h-12 bg-white/5 rounded w-3/4" />
                <div className="h-4 bg-white/5 rounded w-1/3" />
                <div className="h-28 bg-white/5 rounded" />
                <div className="h-12 bg-white/5 rounded w-1/2" />
              </div>
            </div>
          </div>
        </main>
      </>
    )
  }

  if (!product) return null

  const images = product.images?.length ? product.images : [null]
  const whatsappMessage = encodeURIComponent(
    `Hola, vengo del catálogo de MateMáticos.\n\nQuiero consultar por:\n` +
    `*${product.name}*\n` +
    `Precio: $${Number(product.price).toLocaleString('es-AR')}\n\n` +
    `¿Está disponible?`
  )

  return (
    <>
      <Header />
      <main className="flex-1 bg-carbon min-h-screen relative">
        <GeometricDecor variant="blueprint" className="absolute inset-0 w-full h-full opacity-30" />
        <div className="relative container-page py-16 sm:py-20">
          {/* Breadcrumb */}
          <nav className="flex flex-wrap items-center gap-1.5 text-xs text-white/30 mb-12">
            <Link href="/" className="hover:text-primary-light transition-colors">Inicio</Link>
            <HiOutlineChevronRight size={12} />
            <Link href="/catalogo" className="hover:text-primary-light transition-colors">Catálogo</Link>
            {product.categories?.name && (
              <>
                <HiOutlineChevronRight size={12} />
                <Link
                  href={`/catalogo?categoria=${product.categories.slug}`}
                  className="hover:text-primary-light transition-colors"
                >
                  {product.categories.name}
                </Link>
              </>
            )}
            <HiOutlineChevronRight size={12} />
            <span className="text-white/60 line-clamp-1">{product.name}</span>
          </nav>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20">
            {/* Galería */}
            <div>
              <div
                className="relative aspect-square rounded-3xl overflow-hidden bg-white/5 cursor-zoom-in group shadow-[var(--shadow-card)]"
                onMouseEnter={() => setZoom(true)}
                onMouseLeave={() => setZoom(false)}
              >
                {images[activeImg] ? (
                  <Image
                    src={getOptimizedUrl(images[activeImg], 900)}
                    alt={product.name}
                    fill
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className={`object-cover transition-transform duration-500 ${
                      zoom ? 'scale-150' : 'scale-100 group-hover:scale-105'
                    }`}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full bg-gradient-to-br from-primary/10 to-transparent">
                    <span className="text-8xl opacity-20">🧉</span>
                  </div>
                )}

                {product.stock > 0 ? (
                  <span className="absolute top-4 left-4 badge badge-stock">Disponible · {product.stock} en stock</span>
                ) : (
                  <span className="absolute top-4 left-4 badge badge-sinstock">Sin stock</span>
                )}
                {product.featured && (
                  <span className="absolute top-4 right-4 badge badge-premium">Premium</span>
                )}
              </div>

              {images.length > 1 && (
                <div className="flex gap-3 mt-4">
                  {images.map((img, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveImg(i)}
                      className={`relative w-20 aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                        activeImg === i
                          ? 'border-primary-light'
                          : 'border-transparent opacity-60 hover:opacity-100'
                      }`}
                    >
                      {img ? (
                        <Image src={getOptimizedUrl(img, 200)} alt="" fill className="object-cover" />
                      ) : (
                        <span className="flex items-center justify-center h-full text-2xl opacity-20">🧉</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex flex-col">
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <span className="badge badge-geo">Cálculo certificado</span>
                <span className="seal seal-leather">Artesanal</span>
              </div>
              <h1 className="font-display font-bold text-4xl sm:text-5xl text-white text-balance leading-[1.08]">
                {product.name}
              </h1>

              <p className="mt-6 text-3xl font-display font-semibold text-primary-light">
                ${Number(product.price).toLocaleString('es-AR')}
              </p>
              <p className="text-xs text-white/30 mt-2">
                {Number(product.whatsapp_clicks || 0).toLocaleString('es-AR')} consultas de clientes
              </p>

              <div className="divider-geo my-8" />

              <p className="text-white/60 leading-relaxed">
                {product.description}
              </p>

              {/* Specs */}
              <div className="grid grid-cols-3 gap-4 mt-8">
                {SPECS.map(spec => (
                  <div key={spec.key} className="card-dark p-5 text-center">
                    <p className="text-[0.6rem] uppercase tracking-widest text-white/30">{spec.key}</p>
                    <p className="font-display font-semibold text-sm text-white mt-2">{spec.value}</p>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <div className="flex flex-col sm:flex-row gap-4 mt-10">
                {product.stock > 0 ? (
                  <a
                    href={`https://wa.me/${WHATSAPP_NUMBER}?text=${whatsappMessage}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary flex-1 py-4"
                  >
                    <HiOutlineShoppingBag size={20} />
                    Comprar por WhatsApp
                  </a>
                ) : (
                  <a
                    href={`https://wa.me/${WHATSAPP_NUMBER}?text=${whatsappMessage}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-outline flex-1 py-4"
                  >
                    <HiOutlineChatBubbleLeftRight size={20} />
                    Consultar disponibilidad
                  </a>
                )}
                <button
                  onClick={() => router.push('/catalogo')}
                  className="btn-ghost border border-white/10"
                >
                  Seguir explorando
                </button>
              </div>

              {/* Beneficios */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-10">
                {BENEFITS.map(b => (
                  <div key={b.title} className="card-dark p-5">
                    <b.icon className="text-primary-light mb-3" size={22} />
                    <p className="font-display font-semibold text-sm text-white">{b.title}</p>
                    <p className="text-xs text-white/40 mt-1.5 leading-relaxed">{b.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* FAQ */}
          <section className="mt-24">
            <h2 className="font-display font-bold text-3xl sm:text-4xl text-white text-balance">
              Preguntas <span className="text-primary-light">frecuentes</span>
            </h2>
            <div className="space-y-4 max-w-3xl mt-8">
              {FAQS.map((faq, i) => (
                <div key={faq.q} className="card-dark overflow-hidden">
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? -1 : i)}
                    className="w-full flex items-center justify-between gap-6 p-6 text-left"
                  >
                    <span className="font-display font-semibold text-white">{faq.q}</span>
                    <span className={`text-primary-light text-xl transition-transform duration-300 shrink-0 ${openFaq === i ? 'rotate-45' : ''}`}>
                      +
                    </span>
                  </button>
                  {openFaq === i && (
                    <p className="px-6 pb-6 text-sm text-white/50 leading-relaxed">{faq.a}</p>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Relacionados */}
          {related.length > 0 && (
            <section className="mt-24">
              <div className="section-head flex flex-col sm:flex-row items-start sm:items-end justify-between gap-6">
                <h2 className="font-display font-bold text-3xl sm:text-4xl text-white text-balance">
                  También te puede <span className="text-primary-light">interesar</span>
                </h2>
                <Link href="/catalogo" className="inline-flex items-center gap-2 btn-ghost">
                  Ver todo
                  <HiOutlineChevronRight size={14} />
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 sm:gap-8">
                {related.map(p => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    onClick={() => router.push(`/producto/${p.id}`)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      </main>
      <Footer />
    </>
  )
}
