# MateMáticos

Tienda online de **mates, bombillas, termos, yerbas y accesorios** para el mate. Identidad visual oscura con acentos en verde oliva, tipografías Fraunces y Space Grotesk, y detalles matemáticos que dan identidad a la marca.

## Características

- **Catálogo** con buscador, filtros por categoría, ordenamiento y badges de oferta
- **Detalle de producto** con galería de imágenes, beneficios y botón de compra
- **Carrito de compras** con persistencia en `localStorage`
- **Checkout por WhatsApp** — los pedidos se envían directamente al número del negocio
- **Promociones automáticas** por cantidad mínima de productos por categoría
- **Combos** a precio fijo con composición de productos
- **Descuentos por peso acumulado** en categorías
- **Panel de administración** privado con gestión de productos, promociones, pedidos y configuración
- **Notificación de mensualidad** que recuerda el pago del servicio a partir del día 13 de cada mes
- **Bloqueo manual del panel admin** controlado por una variable centralizada
- **Diseño responsive** optimizado para desktop, tablet y mobile
- **Animaciones** con framer-motion, GSAP y scroll suave con Lenis

## Stack

| Capa | Tecnología |
|------|-----------|
| Framework | [Next.js 16](https://nextjs.org/) (App Router + Turbopack) |
| UI | [React 19](https://react.dev/) + [Tailwind CSS v4](https://tailwindcss.com/) |
| Animaciones | [Framer Motion](https://www.framer.com/motion/) + [GSAP](https://gsap.com/) + [Lenis](https://lenis.darkroom.engineering/) |
| Base de datos | [Supabase](https://supabase.com/) (PostgreSQL) |
| Imágenes | [Cloudinary](https://cloudinary.com/) |
| Email | [Resend](https://resend.com/) |
| Despliegue | [Vercel](https://vercel.com/) |

## Cómo funciona la venta

La tienda opera sin pasarela de pagos. El flujo es:

1. El cliente browsa el catálogo y agrega productos al carrito
2. Al confirmar, se genera un pedido con número, items, precios y datos del cliente
3. Se envía un mensaje por **WhatsApp** al número del negocio con el resumen del pedido
4. El pedido se registra en Supabase para seguimiento desde el panel admin

## Estructura del proyecto

```
app/
  page.js                     Home con animaciones y decoración geométrica
  catalogo/page.js            Catálogo con buscador, filtros y chips de oferta
  producto/[id]/page.js       Detalle de producto
  carrito/page.js             Checkout por WhatsApp
  admin/                      Panel de administración
    login/page.js             Login del admin
    dashboard/page.js         Dashboard con estadísticas
    productos/page.js         CRUD de productos
    promociones/page.js       Gestión de promociones y combos
    ordenes/page.js           Listado de pedidos
    configuracion/page.js     Configuración general
  api/                        API routes (auth, products, orders, etc.)
components/
  Header.jsx, Footer.jsx      Navegación y pie de página
  ProductCard.jsx             Tarjeta de producto
  ProductGrid.jsx             Grilla responsive de productos
  ComboCard.jsx               Tarjeta de combos
  Modal.jsx                   Sistema de modales (Alert, Confirm, Toast)
  CartSidebar.jsx             Sidebar del carrito
  SmoothScroll.jsx            Wrapper de Lenis
  admin/
    AdminLayout.jsx           Layout del panel admin (sidebar + header)
    AdminBlockedScreen.jsx    Pantalla de panel bloqueado
    PaymentNotice.jsx         Notificación mensual de pago
    FormModal.jsx             Modal de formularios
    fields.jsx                Kit de componentes de formulario
  ui/
    GeometricDecor.jsx        Decoraciones SVG geométricas
    LoadingModal.jsx          Modal de carga
    CartIcon.jsx              Ícono del carrito
context/
  CartContext.jsx              Estado global del carrito (localStorage)
lib/
  admin-config.js             Configuración del panel admin
  supabase.js                 Cliente Supabase
  auth.js                     Autenticación JWT
  pricing.js                  Lógica de precios, promos y combos
  cloudinary.js               Utilidades de Cloudinary
  email.js                    Envío de emails con Resend
  images.js                   Utilidades de imágenes
  settings.js                 Configuración del admin (Supabase)
  site-settings.js            Configuración pública del sitio
supabase-schema.sql           Schema de base de datos
```

## Variables de entorno

Copiar `.env.example` a `.env.local` y completar:

```bash
cp .env.example .env.local
```

| Variable | Descripción |
|----------|------------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Key anónima de Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Key de servicio de Supabase |
| `JWT_SECRET` | Secreto para JWT (generar con `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) |
| `CLOUDINARY_CLOUD_NAME` | Nombre del cloud de Cloudinary |
| `CLOUDINARY_API_KEY` | API key de Cloudinary |
| `CLOUDINARY_API_SECRET` | API secret de Cloudinary |
| `RESEND_API_KEY` | API key de Resend |
| `RESEND_TO_EMAIL` | Email destino para notificaciones |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | Número de WhatsApp del negocio (código de país + número) |

## Setup

```bash
# Instalar dependencias
npm install

# Base de datos
# Ejecutar supabase-schema.sql en el SQL Editor de Supabase
# Crear el admin:
node scripts/create-admin.js admin@ejemplo.com tu-contraseña

# Desarrollo
npm run dev          # http://localhost:3000

# Producción
npm run build
npm run start

# Lint
npm run lint
```

## Panel de administración

Accesible en `/admin/login` (sin enlace público en la web). Login con JWT y bcrypt contra la tabla `admins`.

### Bloqueo del panel

En `lib/admin-config.js` se encuentra la configuración centralizada:

```js
export const ADMIN_PANEL_ENABLED = true   // panel operativo
export const PAYMENT_DUE_DAY = 13         // día de cobro mensual
export const PAYMENT_TIMEZONE = 'America/Argentina/Buenos_Aires'
```

- `ADMIN_PANEL_ENABLED = true` → el panel funciona normalmente
- `ADMIN_PANEL_ENABLED = false` → el panel muestra una pantalla de bloqueo

La tienda pública **no se ve afectada** por este cambio.

### Notificación de mensualidad

A partir del día 13 de cada mes, se muestra un recordatorio al administrador al ingresar al panel. La notificación se cierra una vez por mes usando `localStorage` (`monthly_payment_notice_YYYY_MM`).

## Licencia

Proyecto privado.
