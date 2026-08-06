# MateMáticos

Tienda online de **mates, bombillas, termos, yerbas y accesorios** para el mate. Identidad visual oscura (carbon + olive `#6E8B3D`) con tipografías Fraunces / Space Grotesk y detalles matemáticos (π, √x, fórmulas) que dan identidad a la marca.

## Stack

- **Next.js 16.2.12** (App Router + Turbopack) y **React 19**
- **Tailwind CSS v4** (PostCSS)
- **Supabase** (PostgreSQL): productos, categorías, pedidos, promociones y admins
- **Cloudinary**: subida y almacenamiento de imágenes de producto
- **framer-motion 12** + **GSAP** + **Lenis 1.3** (scroll suave)
- **react-icons 5**
- Deploy en **Vercel**

## Negocio y cómo funciona la venta

- **Venta por WhatsApp**: el checkout no usa pasarela de pagos. El carrito arma un pedido y lo envía por mensaje a `wa.me` con el número de WhatsApp del negocio (`NEXT_PUBLIC_WHATSAPP_NUMBER`). Cada pedido se registra además en Supabase con su número, items, precios y datos del cliente.
- **Promos automáticas por categoría**: una promoción define `min_quantity` y un descuento (`percent` o `fixed`). Cuando el carrito supera la cantidad mínima de productos de esa categoría, el precio unitario se ajusta en vivo (`getEffectiveUnitPrice` en `lib/pricing.js`).
- **Combos**: son una línea de precio fijo: el admin define el combo, la imagen, el precio y los items que lo componen; se vende como un único ítem.
- **Admin**: panel privado accesible **solo por URL** (`/admin/login`, sin enlace público en la web). El login valida contra la tabla `admins` con JWT y bcrypt.

## Estructura

```
app/
  page.js               # Home con animaciones y decoración geométrica
  catalogo/page.js      # Catálogo con buscador, filtros, orden y chips "En oferta"
  producto/[id]/page.js # Detalle de producto (envío, beneficios, agregar/comprar)
  carrito/page.js       # Checkout por WhatsApp
  admin/                # dashboard, login, productos, promociones, ordenes
  api/                  # auth, categories, products, orders, promotions, upload
components/
  Header.jsx, Footer.jsx, SmoothScroll.jsx
  ProductCard.jsx, ProductGrid.jsx, ComboCard.jsx, Modal.jsx
  CartSidebar.jsx, CartIcon.jsx
  admin/  # AdminLayout (panel lateral), FormModal, ProductSelect, fields (kit de pestañas)
  ui/     # GeometricDecor (fórmulas SVG de fondo)
context/CartContext.jsx # Carrito (localStorage, key "matematicos-cart")
lib/
  supabase.js, auth.js, cloudinary.js, email.js (Resend)
  pricing.js  # precios efectivos con promos y combos
  images.js   # utilidades de imágenes
  lenisLock.js + animations.js
supabase-schema.sql      # Migración pendiente de aplicar en Supabase
```

## Setup

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # build de producción
npm run lint
```

Variables de entorno (ver `.env.example`): URL y claves de Supabase, Cloudinary, `NEXT_PUBLIC_WHATSAPP_NUMBER`, secreto JWT y credenciales de Resend.

### Base de datos

Ejecutar `supabase-schema.sql` en el **SQL Editor** del proyecto Supabase (`esatyxgwuzsunnlsztqr`). Crea las tablas `categories`, `products`, `orders`, `promotions`, `promotion_items` y `admins`, y las categorías por defecto. Después crear el admin con `node scripts/create-admin.js`.

> **Pendiente**: las tablas `promotions`/`promotion_items` todavía **no existen** en Supabase (error PGRST205). El admin de promociones y las secciones de home/catálogo dependen de aplicar esa migración.

## Decisiones técnicas relevantes

- **Lupa y placeholder del buscador**: `pl-12`/`pr-10` (dentro de `@layer utilities` en Tailwind v4) eran pisados por `.input-dark` (sin capa), porque en CSS una regla sin capa gana a las capas. Se resolvió con clases propias `.input-search`/`.input-select` (sin capa, definidas después de `.input-dark`) que garantizan el padding.
- **Lupa del catálogo**: se centra con flexbox (`inset-y-0 flex items-center`) en vez de `top-1/2 -translate-y-1/2`, que rasterizaba el trazo diagonal del SVG.
- **Scroll con Lenis**: Lenis intercepta el scroll global; los contenedores con scroll interno usan `data-lenis-prevent` y los modales llaman `stopLenis()`/`startLenis()` (`lib/lenisLock.js`).
- **Chevron del select**: `<svg>` superpuesto en vez de `background-image` inline (que se repetía en algunos navegadores).
- **Menú mobile**: vive dentro del `<header>` sticky para que no se despegue al hacer scroll.
- **Admin sin acceso público**: se quitó el ícono de usuario del header y el link del menú mobile; solo por URL directa.

## Verificación

- `npm run build` y `npm run lint` pasan (0 errores; solo warnings pre-existentes de `<img>` en el admin, que se pueden migrar a `next/image`).
