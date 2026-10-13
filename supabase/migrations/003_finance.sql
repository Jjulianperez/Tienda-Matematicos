-- ============================================================================
-- 003_finance.sql — Finanzas: fecha de confirmación + costo de producto
-- ============================================================================
-- Migración ADITIVA. No modifica ni borra columnas existentes.
--
-- Dos cambios independientes:
--
-- 1. orders.confirmed_at
--    Para saber en qué mes entró la plata de verdad. Hasta ahora la única
--    fecha era created_at (cuándo pidió el cliente), que no sirve para caja:
--    una orden pedida el 30 de septiembre y confirmada el 2 de octubre es
--    plata de octubre, no de septiembre.
--
-- 2. products.cost
--    Columna preparada para calcular ganancia. Queda NULL y sin usar por
--    ahora: la sección Finanzas muestra facturación, no ganancia. Cuando
--    cargues los costos, la ganancia ya tiene dónde vivir.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. Fecha de confirmación
-- ---------------------------------------------------------------------------

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;

-- Backfill de las órdenes que ya están confirmadas.
--
-- Aproximación inevitable: no sabemos cuándo se confirmaron, así que usamos
-- created_at. Es lo mejor que se puede hacer con la información que existe.
-- De acá en adelante el trigger lo hace bien solo.
UPDATE orders
SET confirmed_at = created_at
WHERE status = 'confirmed'
  AND confirmed_at IS NULL;

-- El trigger mantiene confirmed_at sin depender de que la aplicación se
-- acuerde de setearlo. Así no puede haber confirmaciones sin fecha, ni desde
-- el panel ni desde un script ni desde el SQL Editor.
CREATE OR REPLACE FUNCTION orders_set_confirmed_at() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'confirmed' THEN
    -- Al insertar una orden ya confirmada: sellamos ahora.
    -- Al actualizar: solo resellamos si ANTES no estaba confirmada. Si sigue
    -- confirmada y se edita otra cosa, se respeta la fecha original.
    IF TG_OP = 'INSERT' THEN
      NEW.confirmed_at = COALESCE(NEW.confirmed_at, NOW());
    ELSIF OLD.status IS DISTINCT FROM 'confirmed' THEN
      NEW.confirmed_at = NOW();
    END IF;
  ELSE
    -- pending o cancelled: no es plata que entró. Si se cancela una orden
    -- confirmada, la fecha se borra; si después se vuelve a confirmar, se
    -- sella de nuevo con la fecha nueva.
    NEW.confirmed_at = NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_orders_confirmed_at ON orders;
CREATE TRIGGER trg_orders_confirmed_at
  BEFORE INSERT OR UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION orders_set_confirmed_at();

-- Índice para agrupar por mes sin escanear toda la tabla.
CREATE INDEX IF NOT EXISTS idx_orders_confirmed_at
  ON orders (confirmed_at)
  WHERE confirmed_at IS NOT NULL;


-- ---------------------------------------------------------------------------
-- 2. Costo del producto (para ganancia, todavía sin usar)
-- ---------------------------------------------------------------------------

-- Nullable a propósito: NULL significa "todavía no cargué el costo", que es
-- distinto de "el costo es 0". Cuando exista la pantalla de ganancia, los
-- productos sin costo se van a poder listar como pendientes de completar.
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS cost DECIMAL(10,2)
  CHECK (cost IS NULL OR cost >= 0);


-- ---------------------------------------------------------------------------
-- Vista auxiliar de facturación mensual
-- ---------------------------------------------------------------------------
-- Misma advertencia que en customer_stats: la app NO usa esta vista, calcula
-- todo en lib/finance.js para que los estados que cuentan como venta estén
-- definidos en un solo lugar (PURCHASE_STATUSES). Esta vista es para consultas
-- ad-hoc desde el SQL Editor.
CREATE OR REPLACE VIEW monthly_revenue AS
SELECT
  TO_CHAR(
    COALESCE(confirmed_at, created_at) AT TIME ZONE 'America/Argentina/Buenos_Aires',
    'YYYY-MM'
  ) AS month,
  COUNT(DISTINCT COALESCE(order_number, id::text)) AS orders,
  COUNT(*) AS lines,
  SUM(price_at_order * COALESCE(quantity, 1)) AS revenue
FROM orders
WHERE status = 'confirmed'
GROUP BY 1
ORDER BY 1;
