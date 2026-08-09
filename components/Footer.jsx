import Link from 'next/link'
import Image from 'next/image'
import GeometricDecor from './ui/GeometricDecor'
import WhatsAppLink from './ui/WhatsAppLink'

export default function Footer() {
  const columns = [
    {
      title: 'Tienda',
      links: [
        { label: 'Mates', href: '/catalogo?categoria=mates' },
        { label: 'Bombillas', href: '/catalogo?categoria=bombillas' },
        { label: 'Termos', href: '/catalogo?categoria=termos' },
        { label: 'Yerbas', href: '/catalogo?categoria=yerbas' },
        { label: 'Accesorios', href: '/catalogo?categoria=accesorios' },
      ],
    },
    {
      title: 'Información',
      links: [
        { label: 'Nuestra historia', href: '/' },
        { label: 'La fórmula del mate', href: '/' },
        { label: 'Guía de cuidados', href: '/' },
        { label: 'Envíos', href: '/' },
        { label: 'Preguntas frecuentes', href: '/' },
      ],
    },
    {
      title: 'Contacto',
      links: [
        { label: 'WhatsApp', whatsapp: true },
        { label: 'Instagram', href: '#' },
        { label: 'Email', href: 'mailto:hola@matematicos.com' },
      ],
    },
  ]

  return (
    <footer className="relative bg-carbon border-t border-white/5 overflow-hidden">
      <GeometricDecor variant="formulas" className="absolute inset-0 w-full h-full opacity-40" />
      <div className="relative container-page py-24 sm:py-28">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-16 lg:gap-14">
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-3 mb-7">
              <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0">
                <Image
                  src="/assets/brand/favicon.png"
                  alt="MateMáticos"
                  width={40}
                  height={40}
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="font-display font-semibold text-2xl text-white">
                Mate<span className="text-primary-light">Máticos</span>
              </span>
            </Link>
            <p className="text-white/40 text-sm leading-relaxed max-w-sm">
              El mate perfecto no es casualidad. Es matemática. Productos artesanales seleccionados con precisión de ingeniería.
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              <span className="seal seal-leather">Precisión Artesanal</span>
              <span className="seal seal-argentina">Hecho en Argentina</span>
            </div>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="font-display font-semibold text-white text-sm uppercase tracking-widest mb-6">
                {col.title}
              </h3>
              <ul className="space-y-4">
                {col.links.map((link) => (
                  <li key={link.label}>
                    {link.whatsapp ? (
                      <WhatsAppLink className="text-sm text-white/40 hover:text-primary-light transition-colors">
                        {link.label}
                      </WhatsAppLink>
                    ) : (
                      <Link
                        href={link.href}
                        target={link.href.startsWith('http') ? '_blank' : undefined}
                        rel={link.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                        className="text-sm text-white/40 hover:text-primary-light transition-colors"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="divider-geo mt-20 mb-10">
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 2 L22 8 L22 16 L12 22 L2 16 L2 8 Z" strokeDasharray="0.5 1.5" />
            <circle cx="12" cy="12" r="5" strokeDasharray="1 1.2" />
          </svg>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <p className="text-sm text-white/30">
            © {new Date().getFullYear()} MateMáticos. Todos los derechos reservados.
          </p>
          <p className="text-sm text-white/30 italic font-display">
            Toda gran idea comienza con un mate.
          </p>
        </div>
      </div>
    </footer>
  )
}
