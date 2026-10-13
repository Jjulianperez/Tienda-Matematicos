# Migraciones de Supabase

Este proyecto usa **migraciones aditivas**. A diferencia de un archivo monolítico (`supabase-schema.sql`), cada archivo en esta carpeta es idempotente (`IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP TRIGGER IF EXISTS`) y solo añade cambios.

## ¿Cuándo ejecutar qué?

### Base de datos existente (ya tenés tablas y datos)
1. Ejecutá las migraciones nuevas en orden: `002_customers.sql` y `003_finance.sql` en el SQL Editor de Supabase.
2. Ejecutá el backfill: `node scripts/seed-customers.js` (vincula pedidos existentes al CRM).

`003_finance.sql` es re-ejecutable: agrega `orders.confirmed_at` (y sella las órdenes ya confirmadas con su `created_at`), instala el trigger que la mantiene al día, y agrega `products.cost` (todavía sin usar).

### Base de datos nueva (desde cero)
1. Ejecutá `001_init.sql` (foto del esquema base).
2. Ejecutá `002_customers.sql`.
3. Ejecutá `003_finance.sql`.
4. Creá el admin: `node scripts/create-admin.js admin@ejemplo.com tu-contraseña`
5. Sembrá productos (opcional): `node scripts/seed-products.js`

## Notas importantes

- Las migraciones son **aditivas** a propósito. Esto evita romper producción. No incluimos `DROP COLUMN`, renames ni cambios destructivos en la misma versión.
- La columna `orders.customer_id` es `NULLABLE`. Los pedidos históricos quedan sin enlazar hasta el backfill; eso es correcto y no rompe nada.
- `phone` se **normaliza en runtime** (`lib/customers.js`). Nunca confíes en limpiar teléfonos solo con SQL: hay formatos con `+`, espacios, guiones, paréntesis, `15`/`9` de móvil en Argentina.
- El agregado de estadísticas **no** usa la vista `customer_stats`. Se calcula directamente desde la API (con `GROUP BY` + filtro por estados de compra) para que los estados sean configurables desde código.
- Estados que cuentan como compra (`PURCHASE_STATUSES` en `lib/customers.js`) hoy son: `['confirmed', 'preparing', 'shipped', 'delivered']`. `pending` y `cancelled` no cuentan. Los estados que todavía no existen simplemente nunca coinciden.
- `orders.confirmed_at` lo mantiene un **trigger**, no la aplicación: así no puede haber confirmaciones sin fecha, ni desde el panel ni desde el SQL Editor. Si una orden se cancela, la fecha se borra; si se vuelve a confirmar, se sella de nuevo.

## Finanzas

`003_finance.sql` agrega lo necesario para el cálculo de facturación:

- `orders.confirmed_at`: en qué mes entró la plata. Se usa en lugar de `created_at` para agrupar por mes.
- `products.cost`: costo unitario, para calcular ganancia más adelante. Hoy es `NULL` en todo el catálogo y no se usa.
- Vista `monthly_revenue`: solo para consultas ad-hoc desde el SQL Editor. La app **no** la usa: calcula todo en `lib/finance.js` para que los estados que cuentan como venta estén definidos en un solo lugar.

## Limpiar pedidos de prueba

`scripts/purge-test-orders.js` borra pedidos de un rango de fechas. **Por defecto no borra nada**: muestra qué borraría. Para que borre de verdad hay que pasar `--apply`.

```bash
# Simulación (no borra)
node scripts/purge-test-orders.js

# Borrado real, rango y estado configurables
node scripts/purge-test-orders.js --from=2026-08-01 --to=2026-08-31 --status=cancelled --apply
```

No toca el stock: el stock baja al confirmar y se devuelve al cancelar una confirmada, así que una orden cancelada nunca dejó stock descontado.

## Backfill (pedidos existentes)

El script `scripts/seed-customers.js`:

- Lee todos los pedidos con `customer_phone` no vacío y sin `customer_id`.
- Normaliza el teléfono (`normalizePhone`).
- Hace `upsert` de cliente (crea o actualiza `name`/`phone_display` si hay cambios).
- Enlaza `orders.customer_id`.
- Actualiza `first_order_at`/`last_order_at` de cada cliente.
- **Es idempotente**: podés correrlo varias veces sin duplicar clientes.

```bash
node scripts/seed-customers.js
```
