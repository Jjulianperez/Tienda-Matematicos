-- ============================================================================
-- 005_increment_clicks.sql — Incremento atómico de whatsapp_clicks (H4)
-- ============================================================================
-- Migración ADITIVA. Solo crea una función; no toca tablas ni datos.
--
-- Por qué: POST /api/orders hacía .update({ whatsapp_clicks: { inc: 1 } }), y
-- supabase-js no interpreta eso como incremento. El valor nunca subía, así
-- que el orden "populares" de /api/products quedaba fijo.
--
-- La función suma 1 a cada producto de la lista en un solo UPDATE.
-- Solo service_role puede ejecutarla: la clave anon no debe poder inflar
-- los contadores.
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_whatsapp_clicks(p_product_ids UUID[])
RETURNS VOID
LANGUAGE sql
AS $$
  UPDATE products
  SET whatsapp_clicks = COALESCE(whatsapp_clicks, 0) + 1
  WHERE id = ANY(p_product_ids);
$$;

REVOKE ALL ON FUNCTION increment_whatsapp_clicks(UUID[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION increment_whatsapp_clicks(UUID[]) TO service_role;
