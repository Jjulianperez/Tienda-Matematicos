-- ============================================================================
-- 006_giveaways.sql — MateMáticos Sorteos: tablas, restricciones y triggers
-- ============================================================================
-- Migración ADITIVA. Crea tablas y funciones nuevas; lo único que toca de lo
-- existente es agregar la columna admins.role.
--
-- Las reglas importantes viven ACÁ, en PostgreSQL, y no en el código de la
-- aplicación: un bug o un acceso directo a la base no puede saltárselas.
--   - Máquina de estados del sorteo (un trigger rechaza transiciones inválidas).
--   - Después de cerrar, nadie puede agregar, cambiar ni borrar participaciones.
--   - Máximo dos oportunidades por persona; la segunda exige la primera.
--   - Un sorteo solo puede tener UN resultado.
--   - El registro de auditoría es append-only.
--
-- Las funciones transaccionales que operan sobre estas tablas están en
-- 007_giveaways_rpc.sql.
--
-- TODAS las tablas tienen RLS activado, sin policies, y sin permisos para
-- anon ni authenticated: solo se accede con service_role desde la API.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. Rol de administrador
-- ---------------------------------------------------------------------------
-- owner: puede confirmar sorteos. reviewer: solo revisa evidencias.
-- Los admins existentes quedan como owner.

ALTER TABLE admins
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'owner';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admins_role_check') THEN
    ALTER TABLE admins ADD CONSTRAINT admins_role_check CHECK (role IN ('owner', 'reviewer'));
  END IF;
END $$;


-- ---------------------------------------------------------------------------
-- 2. Transiciones de estado permitidas
-- ---------------------------------------------------------------------------
-- Misma tabla que lib/giveaways/states.js. scripts/test-giveaway-db.js
-- comprueba que coincidan.

CREATE OR REPLACE FUNCTION giveaway_transition_allowed(p_from TEXT, p_to TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (p_from, p_to) IN (
    ('draft', 'scheduled'),
    ('draft', 'cancelled'),
    ('scheduled', 'active'),
    ('scheduled', 'cancelled'),
    ('active', 'closing'),
    ('active', 'cancelled'),
    ('closing', 'ready'),
    ('closing', 'active'),
    ('closing', 'cancelled'),
    ('ready', 'drawing'),
    ('ready', 'cancelled'),
    ('drawing', 'completed'),
    ('drawing', 'ready')
  );
$$;


-- ---------------------------------------------------------------------------
-- 3. Sorteos
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS giveaways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE
    CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) <= 80),
  title TEXT NOT NULL CHECK (length(btrim(title)) > 0),
  description TEXT,
  prize_name TEXT NOT NULL CHECK (length(btrim(prize_name)) > 0),
  prize_description TEXT,
  prize_image_url TEXT,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  format TEXT NOT NULL DEFAULT 'ruleta' CHECK (format IN ('ruleta', 'urna', 'numeros')),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'scheduled', 'active', 'closing', 'ready', 'drawing', 'completed', 'cancelled')),
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  winners_count INTEGER NOT NULL DEFAULT 1 CHECK (winners_count BETWEEN 1 AND 100),
  alternates_count INTEGER NOT NULL DEFAULT 0 CHECK (alternates_count BETWEEN 0 AND 100),
  -- Cuántas oportunidades puede tener cada persona. v1 usa 2.
  max_opportunities INTEGER NOT NULL DEFAULT 2 CHECK (max_opportunities BETWEEN 1 AND 2),
  terms_text TEXT,
  terms_version INTEGER NOT NULL DEFAULT 1 CHECK (terms_version >= 1),
  -- Último número de ticket entregado. Se incrementa con UPDATE ... RETURNING.
  ticket_counter INTEGER NOT NULL DEFAULT 0 CHECK (ticket_counter >= 0),
  -- Compromiso público de la semilla: SHA-256 de sus bytes, en hex.
  seed_commitment TEXT CHECK (seed_commitment IS NULL OR seed_commitment ~ '^[0-9a-f]{64}$'),
  -- Huella de la lista congelada de tickets (ver lib/giveaways/draw.js).
  tickets_hash TEXT CHECK (tickets_hash IS NULL OR tickets_hash ~ '^[0-9a-f]{64}$'),
  tickets_count INTEGER CHECK (tickets_count IS NULL OR tickets_count >= 0),
  frozen_at TIMESTAMPTZ,
  cancelled_reason TEXT,
  -- Control optimista para el editor del admin.
  version INTEGER NOT NULL DEFAULT 1,
  created_by UUID REFERENCES admins(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT giveaways_window_ok
    CHECK (starts_at IS NULL OR ends_at IS NULL OR starts_at < ends_at),
  -- Fuera de borrador y cancelado, el sorteo tiene fechas y semilla comprometida.
  CONSTRAINT giveaways_published_complete
    CHECK (
      status IN ('draft', 'cancelled')
      OR (starts_at IS NOT NULL AND ends_at IS NOT NULL AND seed_commitment IS NOT NULL)
    ),
  -- Lista congelada: desde 'ready' en adelante existe la huella.
  CONSTRAINT giveaways_frozen_has_hash
    CHECK (
      status NOT IN ('ready', 'drawing', 'completed')
      OR (tickets_hash IS NOT NULL AND tickets_count IS NOT NULL AND frozen_at IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_giveaways_scheduled_start
  ON giveaways (starts_at) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_giveaways_active_end
  ON giveaways (ends_at) WHERE status = 'active';

-- Trigger de protección del sorteo: estados, campos inmutables y borrado.
CREATE OR REPLACE FUNCTION giveaways_guard() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status NOT IN ('draft', 'cancelled') THEN
      RAISE EXCEPTION 'giveaway_cannot_delete: no se puede borrar un sorteo en estado %', OLD.status
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     AND NOT giveaway_transition_allowed(OLD.status, NEW.status) THEN
    RAISE EXCEPTION 'giveaway_invalid_transition: % -> %', OLD.status, NEW.status
      USING ERRCODE = 'check_violation';
  END IF;

  -- Las reglas del juego no cambian después de salir de borrador.
  IF OLD.status <> 'draft' AND (
       NEW.slug IS DISTINCT FROM OLD.slug
    OR NEW.winners_count IS DISTINCT FROM OLD.winners_count
    OR NEW.alternates_count IS DISTINCT FROM OLD.alternates_count
    OR NEW.max_opportunities IS DISTINCT FROM OLD.max_opportunities
    OR NEW.terms_text IS DISTINCT FROM OLD.terms_text
    OR NEW.terms_version IS DISTINCT FROM OLD.terms_version
  ) THEN
    RAISE EXCEPTION 'giveaway_rules_locked: las reglas no se pueden cambiar después de publicar'
      USING ERRCODE = 'check_violation';
  END IF;

  -- La semilla comprometida no se reemplaza.
  IF OLD.seed_commitment IS NOT NULL AND NEW.seed_commitment IS DISTINCT FROM OLD.seed_commitment THEN
    RAISE EXCEPTION 'giveaway_commitment_locked: el compromiso de la semilla no se puede cambiar'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Con el sorteo en marcha no se cambian el premio ni la fecha de inicio.
  IF OLD.status NOT IN ('draft', 'scheduled') AND (
       NEW.prize_name IS DISTINCT FROM OLD.prize_name
    OR NEW.starts_at IS DISTINCT FROM OLD.starts_at
  ) THEN
    RAISE EXCEPTION 'giveaway_rules_locked: el premio y el inicio no se pueden cambiar en marcha'
      USING ERRCODE = 'check_violation';
  END IF;

  -- La fecha de cierre solo se mueve en borrador, programado, o al extender
  -- (closing -> active).
  IF NEW.ends_at IS DISTINCT FROM OLD.ends_at
     AND NOT (OLD.status IN ('draft', 'scheduled') OR (OLD.status = 'closing' AND NEW.status = 'active')) THEN
    RAISE EXCEPTION 'giveaway_rules_locked: el cierre solo se mueve al extender el sorteo'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Los tickets entregados nunca se "des-entregan".
  IF NEW.ticket_counter < OLD.ticket_counter THEN
    RAISE EXCEPTION 'giveaway_counter_locked: el contador de tickets no puede bajar'
      USING ERRCODE = 'check_violation';
  END IF;

  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_giveaways_guard ON giveaways;
CREATE TRIGGER trg_giveaways_guard
  BEFORE UPDATE OR DELETE ON giveaways
  FOR EACH ROW EXECUTE FUNCTION giveaways_guard();


-- ---------------------------------------------------------------------------
-- 4. Semilla secreta
-- ---------------------------------------------------------------------------
-- Vive aparte para que ninguna consulta de lectura del sorteo la traiga por
-- accidente. Se revela recién al ejecutar el sorteo.

CREATE TABLE IF NOT EXISTS giveaway_secrets (
  giveaway_id UUID PRIMARY KEY REFERENCES giveaways(id) ON DELETE CASCADE,
  seed_hex TEXT NOT NULL CHECK (seed_hex ~ '^[0-9a-f]{64}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ---------------------------------------------------------------------------
-- 5. Requisitos
-- ---------------------------------------------------------------------------
-- Cada requisito pertenece a una oportunidad (slot). Una oportunidad se otorga
-- cuando TODOS los requisitos de ese slot están cumplidos.
--   declarative     la persona declara que lo hizo (queda registrado, no probado)
--   evidence_upload sube una captura que un admin aprueba o rechaza
--   text_answer     responde con texto
--   external_link   deja un enlace (solo registro)

CREATE TABLE IF NOT EXISTS giveaway_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  giveaway_id UUID NOT NULL REFERENCES giveaways(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position >= 1),
  slot INTEGER NOT NULL CHECK (slot IN (1, 2)),
  kind TEXT NOT NULL CHECK (kind IN ('declarative', 'evidence_upload', 'text_answer', 'external_link')),
  title TEXT NOT NULL CHECK (length(btrim(title)) > 0),
  instructions TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (giveaway_id, position),
  UNIQUE (id, giveaway_id)
);


-- ---------------------------------------------------------------------------
-- 6. Participantes
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS giveaway_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  giveaway_id UUID NOT NULL REFERENCES giveaways(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL CHECK (length(btrim(full_name)) > 0),
  -- Normalizado con normalizePhone (lib/customers.js). Clave de unicidad.
  phone_normalized TEXT NOT NULL CHECK (length(phone_normalized) > 0),
  phone_display TEXT,
  email TEXT,
  ig_handle TEXT,
  ig_handle_normalized TEXT,
  -- Solo se vincula a un cliente existente; nunca se crea uno desde acá.
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  marketing_consent BOOLEAN NOT NULL DEFAULT false,
  terms_version INTEGER NOT NULL CHECK (terms_version >= 1),
  terms_accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Solo se guarda el hash del token del comprobante.
  access_token_hash TEXT NOT NULL UNIQUE CHECK (access_token_hash ~ '^[0-9a-f]{64}$'),
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (giveaway_id, phone_normalized),
  UNIQUE (id, giveaway_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_giveaway_participants_ig
  ON giveaway_participants (giveaway_id, ig_handle_normalized)
  WHERE ig_handle_normalized IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_giveaway_participants_idempotency
  ON giveaway_participants (giveaway_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_giveaway_participants_customer
  ON giveaway_participants (customer_id) WHERE customer_id IS NOT NULL;


-- ---------------------------------------------------------------------------
-- 7. Evidencias (capturas que revisa un admin)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS giveaway_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  giveaway_id UUID NOT NULL,
  participant_id UUID NOT NULL,
  requirement_id UUID NOT NULL,
  attempt_no INTEGER NOT NULL DEFAULT 1 CHECK (attempt_no >= 1),
  -- Ruta dentro del bucket PRIVADO. Nunca se expone una URL pública.
  storage_path TEXT NOT NULL,
  mime TEXT NOT NULL CHECK (mime IN ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0),
  -- SHA-256 del archivo: una misma captura no se puede usar dos veces.
  sha256 TEXT NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  reviewed_by UUID REFERENCES admins(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  FOREIGN KEY (participant_id, giveaway_id)
    REFERENCES giveaway_participants (id, giveaway_id) ON DELETE CASCADE,
  FOREIGN KEY (requirement_id, giveaway_id)
    REFERENCES giveaway_requirements (id, giveaway_id) ON DELETE CASCADE,
  UNIQUE (participant_id, requirement_id, attempt_no),
  UNIQUE (giveaway_id, sha256),
  CONSTRAINT giveaway_evidence_rejection_needs_reason
    CHECK (status <> 'rejected' OR (rejection_reason IS NOT NULL AND length(btrim(rejection_reason)) > 0)),
  CONSTRAINT giveaway_evidence_reviewed_has_date
    CHECK (status = 'pending' OR reviewed_at IS NOT NULL)
);

-- Una sola evidencia vigente (pendiente o aprobada) por persona y requisito.
-- Si la rechazan, puede subir otra.
CREATE UNIQUE INDEX IF NOT EXISTS uq_giveaway_evidence_active
  ON giveaway_evidence (participant_id, requirement_id)
  WHERE status IN ('pending', 'approved');
CREATE INDEX IF NOT EXISTS idx_giveaway_evidence_pending
  ON giveaway_evidence (giveaway_id) WHERE status = 'pending';


-- ---------------------------------------------------------------------------
-- 8. Respuestas sin archivo (declaración, texto, enlace)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS giveaway_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  giveaway_id UUID NOT NULL,
  participant_id UUID NOT NULL,
  requirement_id UUID NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (participant_id, giveaway_id)
    REFERENCES giveaway_participants (id, giveaway_id) ON DELETE CASCADE,
  FOREIGN KEY (requirement_id, giveaway_id)
    REFERENCES giveaway_requirements (id, giveaway_id) ON DELETE CASCADE,
  UNIQUE (participant_id, requirement_id)
);


-- ---------------------------------------------------------------------------
-- 9. Oportunidades (tickets)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS giveaway_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  giveaway_id UUID NOT NULL,
  participant_id UUID NOT NULL,
  slot INTEGER NOT NULL CHECK (slot IN (1, 2)),
  ticket_number INTEGER NOT NULL CHECK (ticket_number >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (participant_id, giveaway_id)
    REFERENCES giveaway_participants (id, giveaway_id) ON DELETE CASCADE,
  UNIQUE (giveaway_id, participant_id, slot),
  UNIQUE (giveaway_id, ticket_number)
);

CREATE INDEX IF NOT EXISTS idx_giveaway_entries_giveaway
  ON giveaway_entries (giveaway_id);

CREATE OR REPLACE FUNCTION giveaway_entries_guard() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.slot > (SELECT max_opportunities FROM giveaways WHERE id = NEW.giveaway_id) THEN
      RAISE EXCEPTION 'giveaway_slot_not_allowed: este sorteo no admite la oportunidad %', NEW.slot
        USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.slot = 2 AND NOT EXISTS (
      SELECT 1 FROM giveaway_entries
      WHERE participant_id = NEW.participant_id AND slot = 1
    ) THEN
      RAISE EXCEPTION 'giveaway_slot_requires_first: la segunda oportunidad requiere la primera'
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.slot = 1 AND EXISTS (
      SELECT 1 FROM giveaway_entries
      WHERE participant_id = OLD.participant_id AND slot = 2
    ) THEN
      RAISE EXCEPTION 'giveaway_slot_requires_first: no se puede quitar la primera oportunidad si existe la segunda'
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN OLD;
  END IF;

  -- UPDATE: una oportunidad no cambia de dueño, de slot ni de número.
  IF NEW.giveaway_id IS DISTINCT FROM OLD.giveaway_id
     OR NEW.participant_id IS DISTINCT FROM OLD.participant_id
     OR NEW.slot IS DISTINCT FROM OLD.slot
     OR NEW.ticket_number IS DISTINCT FROM OLD.ticket_number THEN
    RAISE EXCEPTION 'giveaway_entry_immutable: una oportunidad no se puede modificar'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_giveaway_entries_guard ON giveaway_entries;
CREATE TRIGGER trg_giveaway_entries_guard
  BEFORE INSERT OR UPDATE OR DELETE ON giveaway_entries
  FOR EACH ROW EXECUTE FUNCTION giveaway_entries_guard();


-- ---------------------------------------------------------------------------
-- 10. Congelamiento: qué se puede tocar en cada estado
-- ---------------------------------------------------------------------------
--   requisitos      solo en draft y scheduled
--   participantes   se crean solo con el sorteo active; no cambian desde ready
--   respuestas      solo con el sorteo active
--   evidencias      se suben solo en active; se revisan en active y closing
--   oportunidades   solo en active y closing
-- Desde 'ready' la lista de tickets queda fija, y su huella ya es pública.

CREATE OR REPLACE FUNCTION giveaway_phase_guard() RETURNS TRIGGER AS $$
DECLARE
  v_giveaway_id UUID;
  v_status TEXT;
BEGIN
  v_giveaway_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.giveaway_id ELSE NEW.giveaway_id END;
  SELECT status INTO v_status FROM giveaways WHERE id = v_giveaway_id;

  -- El sorteo ya no existe: es el borrado en cascada de un borrador.
  IF v_status IS NULL THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  IF TG_TABLE_NAME = 'giveaway_requirements' THEN
    IF v_status NOT IN ('draft', 'scheduled') THEN
      RAISE EXCEPTION 'giveaway_phase_locked: los requisitos solo se editan en borrador o programado (estado: %)', v_status
        USING ERRCODE = 'check_violation';
    END IF;

  ELSIF TG_TABLE_NAME = 'giveaway_participants' THEN
    IF TG_OP = 'INSERT' AND v_status <> 'active' THEN
      RAISE EXCEPTION 'giveaway_phase_locked: el sorteo no admite inscripciones (estado: %)', v_status
        USING ERRCODE = 'check_violation';
    ELSIF TG_OP <> 'INSERT' AND v_status IN ('ready', 'drawing', 'completed', 'cancelled') THEN
      RAISE EXCEPTION 'giveaway_phase_locked: los participantes están congelados (estado: %)', v_status
        USING ERRCODE = 'check_violation';
    END IF;

  ELSIF TG_TABLE_NAME = 'giveaway_submissions' THEN
    IF v_status <> 'active' THEN
      RAISE EXCEPTION 'giveaway_phase_locked: el sorteo no admite respuestas (estado: %)', v_status
        USING ERRCODE = 'check_violation';
    END IF;

  ELSIF TG_TABLE_NAME = 'giveaway_evidence' THEN
    IF TG_OP = 'INSERT' AND v_status <> 'active' THEN
      RAISE EXCEPTION 'giveaway_phase_locked: el sorteo no admite evidencias nuevas (estado: %)', v_status
        USING ERRCODE = 'check_violation';
    ELSIF TG_OP <> 'INSERT' AND v_status NOT IN ('active', 'closing') THEN
      RAISE EXCEPTION 'giveaway_phase_locked: las evidencias están congeladas (estado: %)', v_status
        USING ERRCODE = 'check_violation';
    END IF;

  ELSIF TG_TABLE_NAME = 'giveaway_entries' THEN
    IF v_status NOT IN ('active', 'closing') THEN
      RAISE EXCEPTION 'giveaway_phase_locked: las oportunidades están congeladas (estado: %)', v_status
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_giveaway_requirements_phase ON giveaway_requirements;
CREATE TRIGGER trg_giveaway_requirements_phase
  BEFORE INSERT OR UPDATE OR DELETE ON giveaway_requirements
  FOR EACH ROW EXECUTE FUNCTION giveaway_phase_guard();

DROP TRIGGER IF EXISTS trg_giveaway_participants_phase ON giveaway_participants;
CREATE TRIGGER trg_giveaway_participants_phase
  BEFORE INSERT OR UPDATE OR DELETE ON giveaway_participants
  FOR EACH ROW EXECUTE FUNCTION giveaway_phase_guard();

DROP TRIGGER IF EXISTS trg_giveaway_submissions_phase ON giveaway_submissions;
CREATE TRIGGER trg_giveaway_submissions_phase
  BEFORE INSERT OR UPDATE OR DELETE ON giveaway_submissions
  FOR EACH ROW EXECUTE FUNCTION giveaway_phase_guard();

DROP TRIGGER IF EXISTS trg_giveaway_evidence_phase ON giveaway_evidence;
CREATE TRIGGER trg_giveaway_evidence_phase
  BEFORE INSERT OR UPDATE OR DELETE ON giveaway_evidence
  FOR EACH ROW EXECUTE FUNCTION giveaway_phase_guard();

DROP TRIGGER IF EXISTS trg_giveaway_entries_phase ON giveaway_entries;
CREATE TRIGGER trg_giveaway_entries_phase
  BEFORE INSERT OR UPDATE OR DELETE ON giveaway_entries
  FOR EACH ROW EXECUTE FUNCTION giveaway_phase_guard();


-- ---------------------------------------------------------------------------
-- 11. Resultado del sorteo
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS giveaway_draws (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  giveaway_id UUID NOT NULL REFERENCES giveaways(id),
  status TEXT NOT NULL DEFAULT 'drawing' CHECK (status IN ('drawing', 'completed', 'failed')),
  algorithm TEXT,
  seed_commitment TEXT NOT NULL CHECK (seed_commitment ~ '^[0-9a-f]{64}$'),
  -- Se completa al terminar: es la semilla revelada.
  seed_hex TEXT CHECK (seed_hex IS NULL OR seed_hex ~ '^[0-9a-f]{64}$'),
  tickets_count INTEGER NOT NULL CHECK (tickets_count >= 1),
  tickets_hash TEXT NOT NULL CHECK (tickets_hash ~ '^[0-9a-f]{64}$'),
  executed_by UUID REFERENCES admins(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  failed_reason TEXT,
  result JSONB,
  UNIQUE (id, giveaway_id),
  CONSTRAINT giveaway_draws_completed_complete
    CHECK (
      status <> 'completed'
      OR (seed_hex IS NOT NULL AND completed_at IS NOT NULL AND result IS NOT NULL AND algorithm IS NOT NULL)
    )
);

-- UN solo sorteo vigente por giveaway. Los intentos fallidos no cuentan.
CREATE UNIQUE INDEX IF NOT EXISTS uq_giveaway_draws_one_live
  ON giveaway_draws (giveaway_id)
  WHERE status IN ('drawing', 'completed');

CREATE OR REPLACE FUNCTION giveaway_draws_guard() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'giveaway_draw_immutable: los sorteos no se borran'
      USING ERRCODE = 'check_violation';
  END IF;
  IF OLD.status IN ('completed', 'failed') THEN
    RAISE EXCEPTION 'giveaway_draw_immutable: un sorteo terminado no se modifica'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_giveaway_draws_guard ON giveaway_draws;
CREATE TRIGGER trg_giveaway_draws_guard
  BEFORE UPDATE OR DELETE ON giveaway_draws
  FOR EACH ROW EXECUTE FUNCTION giveaway_draws_guard();

CREATE TABLE IF NOT EXISTS giveaway_winners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  giveaway_id UUID NOT NULL,
  draw_id UUID NOT NULL,
  participant_id UUID NOT NULL,
  ticket_number INTEGER NOT NULL CHECK (ticket_number >= 1),
  role TEXT NOT NULL CHECK (role IN ('winner', 'alternate')),
  position INTEGER NOT NULL CHECK (position >= 1),
  status TEXT NOT NULL DEFAULT 'selected'
    CHECK (status IN ('selected', 'notified', 'confirmed', 'forfeited')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (draw_id, giveaway_id) REFERENCES giveaway_draws (id, giveaway_id),
  FOREIGN KEY (participant_id, giveaway_id) REFERENCES giveaway_participants (id, giveaway_id),
  UNIQUE (draw_id, role, position),
  -- Una persona figura una sola vez en todo el resultado.
  UNIQUE (giveaway_id, participant_id)
);

-- Los resultados no se reescriben: solo puede avanzar el estado de entrega.
CREATE OR REPLACE FUNCTION giveaway_winners_guard() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'giveaway_winner_immutable: los ganadores no se borran'
      USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.giveaway_id IS DISTINCT FROM OLD.giveaway_id
     OR NEW.draw_id IS DISTINCT FROM OLD.draw_id
     OR NEW.participant_id IS DISTINCT FROM OLD.participant_id
     OR NEW.ticket_number IS DISTINCT FROM OLD.ticket_number
     OR NEW.role IS DISTINCT FROM OLD.role
     OR NEW.position IS DISTINCT FROM OLD.position THEN
    RAISE EXCEPTION 'giveaway_winner_immutable: el resultado no se puede modificar'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_giveaway_winners_guard ON giveaway_winners;
CREATE TRIGGER trg_giveaway_winners_guard
  BEFORE UPDATE OR DELETE ON giveaway_winners
  FOR EACH ROW EXECUTE FUNCTION giveaway_winners_guard();


-- ---------------------------------------------------------------------------
-- 12. Notificaciones (outbox)
-- ---------------------------------------------------------------------------
-- El sorteo nunca depende de que un email salga. Se encola acá y un proceso
-- aparte envía lo pendiente. dedupe_key evita duplicados ante reintentos.

CREATE TABLE IF NOT EXISTS giveaway_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  giveaway_id UUID REFERENCES giveaways(id) ON DELETE CASCADE,
  participant_id UUID REFERENCES giveaway_participants(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  dedupe_key TEXT NOT NULL UNIQUE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_giveaway_notifications_pending
  ON giveaway_notifications (created_at) WHERE status = 'pending';


-- ---------------------------------------------------------------------------
-- 13. Auditoría append-only
-- ---------------------------------------------------------------------------
-- Sin clave foránea al sorteo ni al admin a propósito: el registro tiene que
-- sobrevivir aunque se borre un borrador o se elimine un admin.

CREATE TABLE IF NOT EXISTS giveaway_audit_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  giveaway_id UUID,
  actor_admin_id UUID,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id TEXT,
  before JSONB,
  after JSONB,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_giveaway_audit_logs_giveaway
  ON giveaway_audit_logs (giveaway_id, created_at);

CREATE OR REPLACE FUNCTION giveaway_audit_guard() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'giveaway_audit_immutable: el registro de auditoría no se modifica ni se borra'
    USING ERRCODE = 'check_violation';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_giveaway_audit_guard ON giveaway_audit_logs;
CREATE TRIGGER trg_giveaway_audit_guard
  BEFORE UPDATE OR DELETE ON giveaway_audit_logs
  FOR EACH ROW EXECUTE FUNCTION giveaway_audit_guard();

DROP TRIGGER IF EXISTS trg_giveaway_audit_truncate ON giveaway_audit_logs;
CREATE TRIGGER trg_giveaway_audit_truncate
  BEFORE TRUNCATE ON giveaway_audit_logs
  FOR EACH STATEMENT EXECUTE FUNCTION giveaway_audit_guard();


-- ---------------------------------------------------------------------------
-- 14. Permisos: RLS activado y sin acceso para anon ni authenticated
-- ---------------------------------------------------------------------------
-- RLS sin policies ya deniega todo a anon/authenticated. El REVOKE es una
-- segunda barrera por si alguien agrega una policy por error. service_role se
-- salta RLS y es el único que usa la API.

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'giveaways', 'giveaway_secrets', 'giveaway_requirements', 'giveaway_participants',
    'giveaway_evidence', 'giveaway_submissions', 'giveaway_entries', 'giveaway_draws',
    'giveaway_winners', 'giveaway_notifications', 'giveaway_audit_logs'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE format('REVOKE ALL ON TABLE %I FROM anon', t);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      EXECUTE format('REVOKE ALL ON TABLE %I FROM authenticated', t);
    END IF;
  END LOOP;
END $$;
