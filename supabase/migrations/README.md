# Migraciones de Supabase

Este proyecto usa **migraciones aditivas**. A diferencia de un archivo monolítico (`supabase-schema.sql`), cada archivo en esta carpeta es idempotente (`IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP TRIGGER IF EXISTS`) y solo añade cambios.

## ¿Cuándo ejecutar qué?

### Base de datos existente (ya tenés tablas y datos)
1. Ejecutá **únicamente** `002_customers.sql` en el SQL Editor de Supabase.
2. Ejecutá el backfill: `node scripts/seed-customers.js` (vincula pedidos existentes al CRM).

### Base de datos nueva (desde cero)
1. Ejecutá `001_init.sql` (foto del esquema base).
2. Ejecutá `002_customers.sql`.
3. Creá el admin: `node scripts/create-admin.js admin@ejemplo.com tu-contraseña`
4. Sembrá productos (opcional): `node scripts/seed-products.js`

## Notas importantes

- Las migraciones son **aditivas** a propósito. Esto evita romper producción. No incluimos `DROP COLUMN`, renames ni cambios destructivos en la misma versión.
- La columna `orders.customer_id` es `NULLABLE`. Los pedidos históricos quedan sin enlazar hasta el backfill; eso es correcto y no rompe nada.
- `phone` se **normaliza en runtime** (`lib/customers.js`). Nunca confíes en limpiar teléfonos solo con SQL: hay formatos con `+`, espacios, guiones, paréntesis, `15`/`9` de móvil en Argentina.
- El agregado de estadísticas **no** usa la vista `customer_stats`. Se calcula directamente desde la API (con `GROUP BY` + filtro por estados de compra) para que los estados sean configurables desde código.
- Estados que cuentan como compra (`PURCHASE_STATUSES`) hoy son: `['confirmed']`. Se pueden ampliar a `['confirmed','preparing','shipped','delivered']` cuando pases a Pedidos v2 (bloque 0.2), sin tocar la tabla. 

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
