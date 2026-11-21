-- ============================================================================
-- 008_giveaways_support.sql — Sorteos: límite de peticiones y resúmenes
-- ============================================================================
-- Migración ADITIVA (requiere 006 y 007). Crea una tabla y funciones nuevas.
--
-- 1. Límite de peticiones para los endpoints públicos (inscripción, subida de
--    evidencias). En serverless un contador en memoria no sirve: cada
--    instancia tiene el suyo. Acá el contador vive en la base y es compartido.
--    La clave que llega es un hash (la API nunca guarda la IP en claro).
--
-- 2. Resúmenes para el panel admin: una sola consulta devuelve la lista de
--    sorteos con sus conteos, en vez de una consulta por sorteo.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. Límite de peticiones (ventana fija)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS giveaway_rate_limits (
  bucket TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  hits INTEGER NOT NULL DEFAULT 0 CHECK (hits >= 0),
  PRIMARY KEY (bucket, window_start)
);

-- Suma una petición a la ventana actual y devuelve true si todavía está dentro
-- del límite. Es atómico: dos peticiones simultáneas no pueden saltarse el tope.
CREATE OR REPLACE FUNCTION giveaway_rate_limit_hit(
  p_bucket TEXT,
  p_limit INTEGER,
  p_window_seconds INTEGER
) RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_window TIMESTAMPTZ;
  v_hits INTEGER;
BEGIN
  IF p_limit < 1 OR p_window_seconds < 1 THEN
    RAISE EXCEPTION 'rate_limit_invalid';
  END IF;

  v_window := to_timestamp(floor(extract(epoch FROM NOW()) / p_window_seconds) * p_window_seconds);

  INSERT INTO giveaway_rate_limits (bucket, window_start, hits)
  VALUES (p_bucket, v_window, 1)
  ON CONFLICT (bucket, window_start)
  DO UPDATE SET hits = giveaway_rate_limits.hits + 1
  RETURNING hits INTO v_hits;

  RETURN v_hits <= p_limit;
END;
$$;

-- Borra ventanas viejas. Lo llama el cron.
CREATE OR REPLACE FUNCTION giveaway_rate_limit_purge(p_older_than INTERVAL DEFAULT INTERVAL '1 day')
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM giveaway_rate_limits WHERE window_start < NOW() - p_older_than;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;


-- ---------------------------------------------------------------------------
-- 2. Resúmenes para el panel admin
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION giveaway_admin_overview(p_giveaway_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'participants', (SELECT COUNT(*) FROM giveaway_participants WHERE giveaway_id = p_giveaway_id),
    'tickets', (SELECT COUNT(*) FROM giveaway_entries WHERE giveaway_id = p_giveaway_id),
    'pending_evidence', (SELECT COUNT(*) FROM giveaway_evidence WHERE giveaway_id = p_giveaway_id AND status = 'pending'),
    'approved_evidence', (SELECT COUNT(*) FROM giveaway_evidence WHERE giveaway_id = p_giveaway_id AND status = 'approved'),
    'rejected_evidence', (SELECT COUNT(*) FROM giveaway_evidence WHERE giveaway_id = p_giveaway_id AND status = 'rejected'),
    'pending_notifications', (SELECT COUNT(*) FROM giveaway_notifications WHERE giveaway_id = p_giveaway_id AND status = 'pending')
  );
$$;

CREATE OR REPLACE FUNCTION giveaway_admin_list()
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', g.id,
      'slug', g.slug,
      'title', g.title,
      'prize_name', g.prize_name,
      'format', g.format,
      'status', g.status,
      'starts_at', g.starts_at,
      'ends_at', g.ends_at,
      'winners_count', g.winners_count,
      'alternates_count', g.alternates_count,
      'created_at', g.created_at,
      'participants', (SELECT COUNT(*) FROM giveaway_participants p WHERE p.giveaway_id = g.id),
      'tickets', (SELECT COUNT(*) FROM giveaway_entries e WHERE e.giveaway_id = g.id),
      'pending_evidence', (SELECT COUNT(*) FROM giveaway_evidence v WHERE v.giveaway_id = g.id AND v.status = 'pending')
    )
    ORDER BY g.created_at DESC
  ), '[]'::jsonb)
  FROM giveaways g;
$$;


-- ---------------------------------------------------------------------------
-- Permisos: RLS sin policies y funciones solo para service_role
-- ---------------------------------------------------------------------------

ALTER TABLE giveaway_rate_limits ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  f RECORD;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE giveaway_rate_limits FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE giveaway_rate_limits FROM authenticated;
  END IF;

  FOR f IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'giveaway_rate_limit_hit', 'giveaway_rate_limit_purge',
        'giveaway_admin_overview', 'giveaway_admin_list'
      )
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
