-- ============================================================================
-- 002_customers.sql — CRM de clientes
-- ============================================================================
-- Migración ADITIVA: solo crea cosas nuevas. No modifica ni borra nada
-- existente, así que es segura de aplicar sobre producción.
--
-- Decisión de diseño: `orders.customer_id` es una FK real, no un match por
-- teléfono en cada consulta. Beneficios:
--   - No hay que normalizar teléfonos en SQL (se normaliza en lib/customers.js)
--   - Las estadísticas se agregan con un group by sobre la FK
--   - Si un cliente cambia de número, el historial no se rompe
--
-- `phone` sigue siendo UNIQUE y es la clave con la que se busca o crea el
-- cliente en el momento de recibir un pedido.
-- ============================================================================

CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Teléfono NORMALIZADO (solo dígitos, código de área sin 0, sin el 9 móvil).
  -- Es la clave única con la que se evita duplicar clientes.
  -- Ver lib/customers.js -> normalizePhone()
  phone TEXT NOT NULL UNIQUE,

  -- Teléfono tal como lo escribió el cliente, para mostrar en pantalla
  phone_display TEXT,

  name TEXT,
  email TEXT,

  -- Notas internas y etiquetas, editables desde /admin/clientes
  notes TEXT,
  tags TEXT[] DEFAULT '{}',

  -- Caché de fechas. La fuente de verdad para los montos es el agregado
  -- sobre orders; estas columnas solo existen para ordenar y mostrar rápido.
  first_order_at TIMESTAMPTZ,
  last_order_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enlace pedido → cliente. NULLABLE a propósito: los pedidos viejo no
-- tienen cliente hasta que corras el backfill (scripts/seed-customers.js).
-- NULL también queda válido para pedidos anónimos o consultas sin teléfono.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;

-- Índices para los patrones de consulta que usa la app
CREATE INDEX IF NOT EXISTS idx_customers_last_order_at ON customers (last_order_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_customers_tags ON customers USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders (customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);

-- Trigger para mantener updated_at al día sin código de aplicación
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_customers_updated_at ON customers;
CREATE TRIGGER trg_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW
  EXECUTE FUNCTION touch_updated_at();

-- ---------------------------------------------------------------------------
-- Vista de estadísticas
-- ---------------------------------------------------------------------------
-- Útil para consultas ad-hoc o reportes. La app calcula los agregados en
-- lib/customers.js (fuente única de la lista PURCHASE_STATUSES), así que
-- si cambiás los estados que cuentan como venta tenés que actualizar AMBOS
-- lugares. Por eso la app NO usa esta vista.
--
-- 'pending' no cuenta: es una consulta, no una compra.
-- 'cancelled' no cuenta.
CREATE OR REPLACE VIEW customer_stats AS
SELECT
  c.id AS customer_id,
  COUNT(o.id) FILTER (WHERE o.status IN ('confirmed', 'preparing', 'shipped', 'delivered')) AS order_count,
  COALESCE(
    SUM(o.price_at_order * o.quantity) FILTER (WHERE o.status IN ('confirmed', 'preparing', 'shipped', 'delivered')),
    0
  ) AS total_spent,
  MAX(o.created_at) FILTER (WHERE o.status IN ('confirmed', 'preparing', 'shipped', 'delivered')) AS last_purchase_at
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
GROUP BY c.id;
