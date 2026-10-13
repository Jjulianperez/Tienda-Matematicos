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
- **Panel de administración** privado con gestión de productos, promociones, pedidos, clientes y configuración
- **CRM de clientes** con historial de compras, ticket promedio, notas y etiquetas
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
    clientes/page.js          CRM de clientes
    configuracion/page.js     Configuración general
  api/                        API routes (auth, products, orders, customers, etc.)
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
  customers.js                Normalización de teléfonos y lógica del CRM
supabase/
  migrations/                 Migraciones versionadas (aditivas)
scripts/
  create-admin.js             Alta del usuario admin
  seed-customers.js           Backfill: pedidos antiguos → clientes
  test-customers.js           Tests del normalizador de teléfonos
  _load-lib.js                Puente para usar lib/ desde scripts CommonJS
supabase-schema.sql           Schema de base de datos (legacy, usar migraciones)
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
# Ejecutar supabase/migrations/001_init.sql en el SQL Editor de Supabase
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

### Migraciones

A partir de ahora el esquema se versiona en `supabase/migrations/`, con archivos
aditivos e idempotentes. `supabase-schema.sql` queda como referencia histórica
para bases creadas antes de este cambio.

```bash
# Base ya existente: aplicar solo la migración nueva
#   (pegar 002_customers.sql en el SQL Editor de Supabase)

# Base nueva: aplicar en orden
#   001_init.sql
#   002_customers.sql

# Luego, vincular los pedidos ya existentes al CRM (idempotente)
npm run seed:customers

# Tests de la lógica de teléfonos
npm run test:customers
```

Ver `supabase/migrations/README.md` para el detalle.

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

## CRM de clientes

Cada pedido queda enlazado a un cliente por `orders.customer_id`. El teléfono se
normaliza en runtime (`lib/customers.js`), así que `+54 9 11 5555-4444`,
`011 15 5555-4444` y `11 5555-4444` terminan en el mismo cliente.

Dos decisiones que conviene no romper:

- **Los totales se calculan al leer, no se guardan.** No hay contadores
  desnormalizados en la tabla, así que no pueden desincronizarse cuando un
  pedido se cancela o se borra. Si algún día hay muchos clientes, el siguiente
  paso es una vista de Postgres (ya está la de ejemplo en la migración).
- **Un cliente se crea al llegar el pedido, no al confirmarlo.** Así también
  quedan registradas las consultas que nunca se convirtieron. Los estados
  `pending` y `cancelled` no cuentan como compra.

Si en el futuro se agregan estados de pedido (`preparing`, `shipped`, `delivered`),
hay que sumarlos a `PURCHASE_STATUSES` en `lib/customers.js`.

## Licencia

Proyecto privado.
