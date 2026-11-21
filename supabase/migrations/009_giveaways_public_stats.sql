-- ============================================================================
-- 009_giveaways_public_stats.sql — Sorteos: cifras públicas en vivo
-- ============================================================================
-- Migración ADITIVA (requiere 006 y 007). Solo crea funciones nuevas.
--
-- La web pública muestra cuántas personas participan y cuántas oportunidades
-- hay, y la vista de números marca cuáles ya se asignaron. Son datos agregados:
-- nunca incluyen nombres, teléfonos ni a quién pertenece cada ticket.
--
-- "Participa" = tiene al menos una oportunidad (ticket). Quien se inscribió pero
-- todavía no cumplió los requisitos no cuenta.
-- ============================================================================


-- Cifras de un sorteo. Con p_with_ranges devuelve además los tickets asignados
-- como rangos consecutivos ([[1,40],[42,60]]): compacto aunque haya miles, y
-- correcto si algún ticket desapareció (por ejemplo, al borrar un participante
-- antes de congelar la lista). Máximo 500 rangos.
CREATE OR REPLACE FUNCTION giveaway_public_stats(p_giveaway_id UUID, p_with_ranges BOOLEAN DEFAULT FALSE)
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'participants', (SELECT COUNT(DISTINCT participant_id) FROM giveaway_entries WHERE giveaway_id = p_giveaway_id),
    'tickets', (SELECT COUNT(*) FROM giveaway_entries WHERE giveaway_id = p_giveaway_id),
    'ranges', CASE
      WHEN p_with_ranges THEN (
        SELECT COALESCE(jsonb_agg(jsonb_build_array(r.lo, r.hi) ORDER BY r.lo), '[]'::jsonb)
        FROM (
          SELECT MIN(s.ticket_number) AS lo, MAX(s.ticket_number) AS hi
          FROM (
            SELECT ticket_number,
                   ticket_number - ROW_NUMBER() OVER (ORDER BY ticket_number) AS grp
            FROM giveaway_entries
            WHERE giveaway_id = p_giveaway_id
          ) s
          GROUP BY s.grp
          ORDER BY MIN(s.ticket_number)
          LIMIT 500
        ) r
      )
      ELSE NULL
    END
  );
$$;


-- Cifras de todos los sorteos que se muestran en la web pública, por id. Una
-- sola consulta para la lista, en vez de una por tarjeta.
CREATE OR REPLACE FUNCTION giveaway_public_counts()
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(jsonb_object_agg(
    g.id::text,
    jsonb_build_object(
      'participants', (SELECT COUNT(DISTINCT e.participant_id) FROM giveaway_entries e WHERE e.giveaway_id = g.id),
      'tickets', (SELECT COUNT(*) FROM giveaway_entries e WHERE e.giveaway_id = g.id)
    )
  ), '{}'::jsonb)
  FROM giveaways g
  WHERE g.status IN ('scheduled', 'active', 'closing', 'ready', 'drawing', 'completed');
$$;


-- ---------------------------------------------------------------------------
-- Permisos: solo service_role (la API pública las llama con la clave de servicio)
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  f RECORD;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('giveaway_public_stats', 'giveaway_public_counts')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f.signature);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', f.signature);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', f.signature);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.signature);
    END IF;
  END LOOP;
END $$;
