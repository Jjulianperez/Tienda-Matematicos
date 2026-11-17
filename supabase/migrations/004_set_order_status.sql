-- ============================================================================
-- 004_set_order_status.sql — Cambio de estado de pedidos con stock transaccional (H3)
-- ============================================================================
-- Migración ADITIVA. Solo crea funciones; no toca tablas ni datos.
--
-- Por qué: el PATCH de /api/orders/[id] leía el stock, lo escribía producto por
-- producto y recién después cambiaba el estado. Eso permitía descontar dos
-- veces al confirmar dos veces, descuentos parciales si fallaba un componente
-- de combo, y carreras entre dos admins.
--
-- Ahora todo ocurre en una sola transacción: la orden se bloquea con FOR UPDATE,
-- el stock se ajusta con UPDATE ... WHERE stock >= cantidad, y el estado se
-- escribe al final. Si algo falla, Postgres deshace todo.
--
-- Reglas de stock:
--   - Entrar a 'confirmed' desde otro estado descuenta el stock.
--   - Salir de 'confirmed' hacia otro estado devuelve el stock.
--   - Cualquier otro cambio no toca el stock.
--   - Pedir el mismo estado que ya tiene es un no-op.
--
-- Las funciones quedan ejecutables solo con service_role. Sin este REVOKE,
-- cualquiera con la clave anon podría llamarlas por PostgREST y mover stock.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. Productos y cantidades que mueve una orden
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION order_stock_targets(o orders)
RETURNS TABLE (product_id UUID, quantity INTEGER)
LANGUAGE sql
STABLE
AS $$
  SELECT (c->>'product_id')::UUID, COALESCE((c->>'quantity')::INTEGER, 1)
  FROM jsonb_array_elements(COALESCE(o.combo_items, '[]'::jsonb)) AS c
  WHERE o.combo_items IS NOT NULL
  UNION ALL
  SELECT o.product_id, o.quantity
  WHERE o.combo_items IS NULL AND o.product_id IS NOT NULL;
$$;


-- ---------------------------------------------------------------------------
-- 2. Cambio de estado transaccional
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_order_status(p_order_id UUID, p_status TEXT)
RETURNS orders
LANGUAGE plpgsql
AS $$
DECLARE
  v_order orders%ROWTYPE;
  v_target RECORD;
  v_direction INTEGER := 0;
BEGIN
  IF p_status NOT IN ('pending', 'confirmed', 'cancelled') THEN
    RAISE EXCEPTION 'Estado inválido' USING ERRCODE = '22023';
  END IF;

  -- Bloquea la fila: dos cambios sobre la misma orden se serializan.
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orden no encontrada' USING ERRCODE = 'P0002';
  END IF;

  IF v_order.status = p_status THEN
    RETURN v_order;
  END IF;

  IF p_status = 'confirmed' THEN
    v_direction := -1;
  ELSIF v_order.status = 'confirmed' THEN
    v_direction := 1;
  END IF;

  IF v_direction <> 0 THEN
    FOR v_target IN SELECT * FROM order_stock_targets(v_order) LOOP
      IF v_direction = -1 THEN
        UPDATE products
        SET stock = stock - v_target.quantity
        WHERE id = v_target.product_id AND stock >= v_target.quantity;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'Stock insuficiente para confirmar la orden' USING ERRCODE = 'P0001';
        END IF;
      ELSE
        UPDATE products
        SET stock = stock + v_target.quantity
        WHERE id = v_target.product_id;
      END IF;
    END LOOP;
  END IF;

  -- El trigger orders_set_confirmed_at (003) se encarga de confirmed_at.
  UPDATE orders SET status = p_status WHERE id = p_order_id RETURNING * INTO v_order;
  RETURN v_order;
END;
$$;


-- ---------------------------------------------------------------------------
-- 3. Permisos: solo service_role
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION order_stock_targets(orders) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION set_order_status(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION set_order_status(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION order_stock_targets(orders) TO service_role;
