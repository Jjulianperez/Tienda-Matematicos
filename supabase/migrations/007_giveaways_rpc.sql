-- ============================================================================
-- 007_giveaways_rpc.sql — MateMáticos Sorteos: funciones transaccionales
-- ============================================================================
-- Migración ADITIVA. Solo crea funciones (requiere 006_giveaways.sql).
--
-- Cada función es UNA transacción: bloquea las filas que necesita
-- (SELECT ... FOR UPDATE / FOR SHARE), valida el estado y escribe todo junto,
-- o falla y no deja nada a medias. La API las llama con service_role.
--
-- Los errores que provocan estas funciones son códigos estables en minúsculas
-- (por ejemplo 'giveaway_not_active'). Los triggers de 006 usan el mismo
-- formato "codigo: explicación". La API traduce el código a un mensaje.
--
-- El sorteo en sí se calcula fuera de la base (lib/giveaways/draw.js):
--   giveaway_begin_draw     entrega semilla y lista congelada
--   giveaway_complete_draw  verifica y guarda el resultado
-- Esta migración no calcula ganadores: comprueba que el resultado sea
-- consistente con la semilla comprometida y con la lista congelada.
--
-- Todas las funciones quedan ejecutables solo por service_role.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- Auditoría y notificaciones
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION giveaway_log(
  p_giveaway_id UUID,
  p_actor UUID,
  p_action TEXT,
  p_entity TEXT,
  p_entity_id TEXT,
  p_before JSONB,
  p_after JSONB,
  p_reason TEXT
) RETURNS VOID
LANGUAGE sql
AS $$
  INSERT INTO giveaway_audit_logs (giveaway_id, actor_admin_id, action, entity, entity_id, before, after, reason)
  VALUES (p_giveaway_id, p_actor, p_action, p_entity, p_entity_id, p_before, p_after, p_reason);
$$;

CREATE OR REPLACE FUNCTION giveaway_enqueue(
  p_giveaway_id UUID,
  p_kind TEXT,
  p_dedupe_key TEXT,
  p_payload JSONB
) RETURNS VOID
LANGUAGE sql
AS $$
  INSERT INTO giveaway_notifications (giveaway_id, kind, dedupe_key, payload)
  VALUES (p_giveaway_id, p_kind, p_dedupe_key, COALESCE(p_payload, '{}'::jsonb))
  ON CONFLICT (dedupe_key) DO NOTHING;
$$;


-- ---------------------------------------------------------------------------
-- Publicar: draft -> scheduled
-- ---------------------------------------------------------------------------
-- Recibe la semilla (generada con crypto en la API), guarda el secreto y
-- publica su compromiso. Valida que el sorteo esté completo.

CREATE OR REPLACE FUNCTION giveaway_schedule(p_giveaway_id UUID, p_actor UUID, p_seed_hex TEXT)
RETURNS giveaways
LANGUAGE plpgsql
AS $$
DECLARE
  g giveaways%ROWTYPE;
BEGIN
  SELECT * INTO g FROM giveaways WHERE id = p_giveaway_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'giveaway_not_found'; END IF;
  IF g.status <> 'draft' THEN RAISE EXCEPTION 'giveaway_invalid_state'; END IF;

  IF p_seed_hex IS NULL OR p_seed_hex !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'giveaway_invalid_seed';
  END IF;
  IF g.starts_at IS NULL OR g.ends_at IS NULL THEN RAISE EXCEPTION 'giveaway_missing_dates'; END IF;
  IF g.ends_at <= NOW() THEN RAISE EXCEPTION 'giveaway_ends_in_past'; END IF;
  IF g.terms_text IS NULL OR length(btrim(g.terms_text)) = 0 THEN
    RAISE EXCEPTION 'giveaway_missing_terms';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM giveaway_requirements WHERE giveaway_id = g.id AND slot = 1) THEN
    RAISE EXCEPTION 'giveaway_missing_requirements';
  END IF;
  IF EXISTS (SELECT 1 FROM giveaway_requirements WHERE giveaway_id = g.id AND slot > g.max_opportunities) THEN
    RAISE EXCEPTION 'giveaway_requirement_slot_invalid';
  END IF;

  INSERT INTO giveaway_secrets (giveaway_id, seed_hex) VALUES (g.id, p_seed_hex);

  UPDATE giveaways
  SET status = 'scheduled',
      seed_commitment = encode(sha256(decode(p_seed_hex, 'hex')), 'hex'),
      version = version + 1
  WHERE id = g.id
  RETURNING * INTO g;

  PERFORM giveaway_log(g.id, p_actor, 'giveaway_scheduled', 'giveaway', g.id::text, NULL,
    jsonb_build_object('seed_commitment', g.seed_commitment, 'starts_at', g.starts_at, 'ends_at', g.ends_at), NULL);
  RETURN g;
END;
$$;


-- ---------------------------------------------------------------------------
-- Cron: transiciones por tiempo
-- ---------------------------------------------------------------------------
-- Idempotente: correrla dos veces seguidas no cambia nada la segunda vez.
-- Nunca sortea. Solo abre (scheduled -> active) y cierra (active -> closing).
-- `p_now` existe para poder probarla con otra hora.

CREATE OR REPLACE FUNCTION giveaway_tick(p_now TIMESTAMPTZ DEFAULT NOW())
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  r RECORD;
  v_activated INTEGER := 0;
  v_closed INTEGER := 0;
BEGIN
  FOR r IN
    SELECT id FROM giveaways
    WHERE status = 'scheduled' AND starts_at <= p_now
    ORDER BY starts_at
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE giveaways SET status = 'active', version = version + 1 WHERE id = r.id;
    PERFORM giveaway_log(r.id, NULL, 'giveaway_activated', 'giveaway', r.id::text, NULL, NULL, 'automático');
    v_activated := v_activated + 1;
  END LOOP;

  FOR r IN
    SELECT id FROM giveaways
    WHERE status = 'active' AND ends_at <= p_now
    ORDER BY ends_at
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE giveaways SET status = 'closing', version = version + 1 WHERE id = r.id;
    PERFORM giveaway_log(r.id, NULL, 'giveaway_closing', 'giveaway', r.id::text, NULL, NULL, 'automático');
    PERFORM giveaway_enqueue(r.id, 'giveaway_closed', 'giveaway_closed:' || r.id::text, '{}'::jsonb);
    v_closed := v_closed + 1;
  END LOOP;

  RETURN jsonb_build_object('activated', v_activated, 'closed', v_closed);
END;
$$;


-- ---------------------------------------------------------------------------
-- Inscripción
-- ---------------------------------------------------------------------------
-- Idempotente por (sorteo, idempotency_key). Teléfono e Instagram son únicos
-- por sorteo. Si el teléfono ya es de un cliente de la tienda, se vincula;
-- nunca se crea un cliente desde acá.

CREATE OR REPLACE FUNCTION giveaway_enter(
  p_giveaway_id UUID,
  p_full_name TEXT,
  p_phone_normalized TEXT,
  p_phone_display TEXT,
  p_email TEXT,
  p_ig_handle TEXT,
  p_ig_handle_normalized TEXT,
  p_marketing_consent BOOLEAN,
  p_terms_version INTEGER,
  p_token_hash TEXT,
  p_idempotency_key TEXT
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  g giveaways%ROWTYPE;
  v_id UUID;
  v_customer UUID;
  v_constraint TEXT;
BEGIN
  SELECT * INTO g FROM giveaways WHERE id = p_giveaway_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'giveaway_not_found'; END IF;
  IF g.status <> 'active' OR NOW() < g.starts_at OR NOW() >= g.ends_at THEN
    RAISE EXCEPTION 'giveaway_not_active';
  END IF;
  IF p_terms_version IS DISTINCT FROM g.terms_version THEN
    RAISE EXCEPTION 'giveaway_terms_outdated';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_id FROM giveaway_participants
    WHERE giveaway_id = g.id AND idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN jsonb_build_object('participant_id', v_id, 'created', false);
    END IF;
  END IF;

  SELECT id INTO v_customer FROM customers WHERE phone = p_phone_normalized LIMIT 1;

  BEGIN
    INSERT INTO giveaway_participants (
      giveaway_id, full_name, phone_normalized, phone_display, email,
      ig_handle, ig_handle_normalized, customer_id, marketing_consent,
      terms_version, access_token_hash, idempotency_key
    ) VALUES (
      g.id, p_full_name, p_phone_normalized, p_phone_display, NULLIF(btrim(p_email), ''),
      p_ig_handle, p_ig_handle_normalized, v_customer, COALESCE(p_marketing_consent, false),
      g.terms_version, p_token_hash, p_idempotency_key
    )
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
    IF v_constraint LIKE '%phone_normalized%' THEN
      RAISE EXCEPTION 'giveaway_phone_taken';
    ELSIF v_constraint LIKE '%_ig' THEN
      RAISE EXCEPTION 'giveaway_instagram_taken';
    ELSIF v_constraint LIKE '%idempotency%' THEN
      -- Dos pedidos idénticos a la vez: el otro ganó la carrera.
      SELECT id INTO v_id FROM giveaway_participants
      WHERE giveaway_id = g.id AND idempotency_key = p_idempotency_key;
      RETURN jsonb_build_object('participant_id', v_id, 'created', false);
    ELSE
      RAISE;
    END IF;
  END;

  RETURN jsonb_build_object('participant_id', v_id, 'created', true);
END;
$$;


-- ---------------------------------------------------------------------------
-- Oportunidades: se otorgan cuando se cumplen TODOS los requisitos del slot
-- ---------------------------------------------------------------------------
-- Función interna. Devuelve cuántas oportunidades nuevas se crearon.
-- Cumplido = evidencia aprobada (evidence_upload) o respuesta registrada
-- (declarative, text_answer, external_link). El slot 2 solo se evalúa si el
-- slot 1 ya existe.

CREATE OR REPLACE FUNCTION giveaway_refresh_entries(p_participant_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_giveaway_id UUID;
  v_max INTEGER;
  v_slot INTEGER;
  v_total INTEGER;
  v_met INTEGER;
  v_ticket INTEGER;
  v_created INTEGER := 0;
BEGIN
  SELECT p.giveaway_id, g.max_opportunities INTO v_giveaway_id, v_max
  FROM giveaway_participants p JOIN giveaways g ON g.id = p.giveaway_id
  WHERE p.id = p_participant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'participant_not_found'; END IF;

  FOR v_slot IN 1..v_max LOOP
    IF EXISTS (SELECT 1 FROM giveaway_entries WHERE participant_id = p_participant_id AND slot = v_slot) THEN
      CONTINUE;
    END IF;

    SELECT COUNT(*) INTO v_total FROM giveaway_requirements
    WHERE giveaway_id = v_giveaway_id AND slot = v_slot;
    IF v_total = 0 THEN EXIT; END IF;

    SELECT COUNT(*) INTO v_met FROM giveaway_requirements r
    WHERE r.giveaway_id = v_giveaway_id AND r.slot = v_slot AND (
      (r.kind = 'evidence_upload' AND EXISTS (
        SELECT 1 FROM giveaway_evidence e
        WHERE e.participant_id = p_participant_id AND e.requirement_id = r.id AND e.status = 'approved'))
      OR
      (r.kind <> 'evidence_upload' AND EXISTS (
        SELECT 1 FROM giveaway_submissions s
        WHERE s.participant_id = p_participant_id AND s.requirement_id = r.id))
    );
    IF v_met < v_total THEN EXIT; END IF;

    -- Número de ticket: incremento atómico sobre la fila del sorteo.
    UPDATE giveaways SET ticket_counter = ticket_counter + 1
    WHERE id = v_giveaway_id
    RETURNING ticket_counter INTO v_ticket;

    INSERT INTO giveaway_entries (giveaway_id, participant_id, slot, ticket_number)
    VALUES (v_giveaway_id, p_participant_id, v_slot, v_ticket);
    v_created := v_created + 1;
  END LOOP;

  RETURN v_created;
END;
$$;


-- ---------------------------------------------------------------------------
-- Evidencia (captura) y respuestas
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION giveaway_submit_evidence(
  p_participant_id UUID,
  p_requirement_id UUID,
  p_storage_path TEXT,
  p_mime TEXT,
  p_size_bytes INTEGER,
  p_sha256 TEXT
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  g giveaways%ROWTYPE;
  v_giveaway_id UUID;
  v_kind TEXT;
  v_attempt INTEGER;
  v_id UUID;
  v_constraint TEXT;
BEGIN
  SELECT giveaway_id INTO v_giveaway_id FROM giveaway_participants WHERE id = p_participant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'participant_not_found'; END IF;

  SELECT * INTO g FROM giveaways WHERE id = v_giveaway_id FOR SHARE;
  IF g.status <> 'active' OR NOW() >= g.ends_at THEN RAISE EXCEPTION 'giveaway_not_active'; END IF;

  SELECT kind INTO v_kind FROM giveaway_requirements
  WHERE id = p_requirement_id AND giveaway_id = v_giveaway_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'requirement_not_found'; END IF;
  IF v_kind <> 'evidence_upload' THEN RAISE EXCEPTION 'requirement_kind_mismatch'; END IF;

  SELECT COALESCE(MAX(attempt_no), 0) + 1 INTO v_attempt FROM giveaway_evidence
  WHERE participant_id = p_participant_id AND requirement_id = p_requirement_id;

  BEGIN
    INSERT INTO giveaway_evidence (
      giveaway_id, participant_id, requirement_id, attempt_no,
      storage_path, mime, size_bytes, sha256
    ) VALUES (
      v_giveaway_id, p_participant_id, p_requirement_id, v_attempt,
      p_storage_path, p_mime, p_size_bytes, p_sha256
    ) RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
    IF v_constraint LIKE '%sha256%' THEN
      RAISE EXCEPTION 'evidence_duplicate';
    ELSE
      RAISE EXCEPTION 'evidence_already_submitted';
    END IF;
  END;

  RETURN jsonb_build_object('evidence_id', v_id, 'attempt_no', v_attempt);
END;
$$;

CREATE OR REPLACE FUNCTION giveaway_submit_answer(
  p_participant_id UUID,
  p_requirement_id UUID,
  p_payload JSONB
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  g giveaways%ROWTYPE;
  v_giveaway_id UUID;
  v_kind TEXT;
  v_payload JSONB;
  v_new INTEGER;
BEGIN
  SELECT giveaway_id INTO v_giveaway_id FROM giveaway_participants WHERE id = p_participant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'participant_not_found'; END IF;

  SELECT * INTO g FROM giveaways WHERE id = v_giveaway_id FOR SHARE;
  IF g.status <> 'active' OR NOW() >= g.ends_at THEN RAISE EXCEPTION 'giveaway_not_active'; END IF;

  SELECT kind INTO v_kind FROM giveaway_requirements
  WHERE id = p_requirement_id AND giveaway_id = v_giveaway_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'requirement_not_found'; END IF;

  IF v_kind = 'evidence_upload' THEN
    RAISE EXCEPTION 'requirement_kind_mismatch';
  ELSIF v_kind = 'text_answer' THEN
    IF COALESCE(length(btrim(p_payload->>'text')), 0) = 0 OR length(p_payload->>'text') > 1000 THEN
      RAISE EXCEPTION 'answer_invalid';
    END IF;
    v_payload := jsonb_build_object('text', btrim(p_payload->>'text'));
  ELSIF v_kind = 'external_link' THEN
    IF COALESCE(p_payload->>'url', '') !~ '^https?://[^\s]+$' OR length(p_payload->>'url') > 500 THEN
      RAISE EXCEPTION 'answer_invalid';
    END IF;
    v_payload := jsonb_build_object('url', p_payload->>'url');
  ELSE
    v_payload := jsonb_build_object('declared', true);
  END IF;

  INSERT INTO giveaway_submissions (giveaway_id, participant_id, requirement_id, payload)
  VALUES (v_giveaway_id, p_participant_id, p_requirement_id, v_payload)
  ON CONFLICT (participant_id, requirement_id) DO UPDATE SET payload = EXCLUDED.payload;

  v_new := giveaway_refresh_entries(p_participant_id);
  RETURN jsonb_build_object('entries_created', v_new);
END;
$$;


-- ---------------------------------------------------------------------------
-- Revisión de evidencias (admin)
-- ---------------------------------------------------------------------------
-- Aprobar puede crear la oportunidad. Rechazar exige un motivo.

CREATE OR REPLACE FUNCTION giveaway_review_evidence(
  p_evidence_id UUID,
  p_admin_id UUID,
  p_decision TEXT,
  p_reason TEXT
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  g giveaways%ROWTYPE;
  e giveaway_evidence%ROWTYPE;
  v_giveaway_id UUID;
  v_new INTEGER := 0;
BEGIN
  IF p_decision NOT IN ('approved', 'rejected') THEN RAISE EXCEPTION 'invalid_decision'; END IF;
  IF p_decision = 'rejected' AND (p_reason IS NULL OR length(btrim(p_reason)) = 0) THEN
    RAISE EXCEPTION 'reason_required';
  END IF;

  SELECT giveaway_id INTO v_giveaway_id FROM giveaway_evidence WHERE id = p_evidence_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'evidence_not_found'; END IF;

  -- Orden de bloqueo: primero el sorteo, después la evidencia.
  SELECT * INTO g FROM giveaways WHERE id = v_giveaway_id FOR UPDATE;
  IF g.status NOT IN ('active', 'closing') THEN RAISE EXCEPTION 'giveaway_not_reviewable'; END IF;

  SELECT * INTO e FROM giveaway_evidence WHERE id = p_evidence_id FOR UPDATE;
  IF e.status <> 'pending' THEN RAISE EXCEPTION 'evidence_not_pending'; END IF;

  UPDATE giveaway_evidence
  SET status = p_decision,
      rejection_reason = CASE WHEN p_decision = 'rejected' THEN btrim(p_reason) ELSE NULL END,
      reviewed_by = p_admin_id,
      reviewed_at = NOW()
  WHERE id = e.id;

  IF p_decision = 'approved' THEN
    v_new := giveaway_refresh_entries(e.participant_id);
  END IF;

  PERFORM giveaway_log(g.id, p_admin_id, 'evidence_' || p_decision, 'evidence', e.id::text,
    jsonb_build_object('status', 'pending'),
    jsonb_build_object('status', p_decision, 'participant_id', e.participant_id, 'requirement_id', e.requirement_id),
    NULLIF(btrim(p_reason), ''));

  RETURN jsonb_build_object('status', p_decision, 'entries_created', v_new);
END;
$$;


-- ---------------------------------------------------------------------------
-- Extender: closing -> active (auditado, con motivo)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION giveaway_extend(
  p_giveaway_id UUID,
  p_actor UUID,
  p_new_ends_at TIMESTAMPTZ,
  p_reason TEXT
) RETURNS giveaways
LANGUAGE plpgsql
AS $$
DECLARE
  g giveaways%ROWTYPE;
  v_before TIMESTAMPTZ;
BEGIN
  IF p_reason IS NULL OR length(btrim(p_reason)) = 0 THEN RAISE EXCEPTION 'reason_required'; END IF;

  SELECT * INTO g FROM giveaways WHERE id = p_giveaway_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'giveaway_not_found'; END IF;
  IF g.status <> 'closing' THEN RAISE EXCEPTION 'giveaway_invalid_state'; END IF;
  IF p_new_ends_at IS NULL OR p_new_ends_at <= NOW() THEN RAISE EXCEPTION 'giveaway_ends_in_past'; END IF;

  v_before := g.ends_at;
  UPDATE giveaways SET status = 'active', ends_at = p_new_ends_at, version = version + 1
  WHERE id = g.id RETURNING * INTO g;

  PERFORM giveaway_log(g.id, p_actor, 'giveaway_extended', 'giveaway', g.id::text,
    jsonb_build_object('ends_at', v_before), jsonb_build_object('ends_at', g.ends_at), btrim(p_reason));
  RETURN g;
END;
$$;


-- ---------------------------------------------------------------------------
-- Congelar: closing -> ready
-- ---------------------------------------------------------------------------
-- Exige cero evidencias pendientes y al menos un ticket. Calcula la huella de
-- la lista (mismo formato que lib/giveaways/draw.js: "numero:participante\n"
-- por línea, ordenado por número de ticket).

CREATE OR REPLACE FUNCTION giveaway_freeze(p_giveaway_id UUID, p_actor UUID)
RETURNS giveaways
LANGUAGE plpgsql
AS $$
DECLARE
  g giveaways%ROWTYPE;
  v_count INTEGER;
  v_hash TEXT;
BEGIN
  SELECT * INTO g FROM giveaways WHERE id = p_giveaway_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'giveaway_not_found'; END IF;
  IF g.status <> 'closing' THEN RAISE EXCEPTION 'giveaway_invalid_state'; END IF;

  IF EXISTS (SELECT 1 FROM giveaway_evidence WHERE giveaway_id = g.id AND status = 'pending') THEN
    RAISE EXCEPTION 'giveaway_has_pending_evidence';
  END IF;

  SELECT COUNT(*) INTO v_count FROM giveaway_entries WHERE giveaway_id = g.id;
  IF v_count = 0 THEN RAISE EXCEPTION 'giveaway_no_tickets'; END IF;

  v_hash := giveaway_compute_tickets_hash(g.id);

  UPDATE giveaways
  SET status = 'ready', tickets_hash = v_hash, tickets_count = v_count, frozen_at = NOW(), version = version + 1
  WHERE id = g.id RETURNING * INTO g;

  PERFORM giveaway_log(g.id, p_actor, 'giveaway_frozen', 'giveaway', g.id::text, NULL,
    jsonb_build_object('tickets_hash', v_hash, 'tickets_count', v_count), NULL);
  RETURN g;
END;
$$;

CREATE OR REPLACE FUNCTION giveaway_compute_tickets_hash(p_giveaway_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT encode(sha256(convert_to(
    COALESCE(
      (SELECT string_agg(ticket_number::text || ':' || participant_id::text || E'\n', '' ORDER BY ticket_number)
       FROM giveaway_entries WHERE giveaway_id = p_giveaway_id),
      ''),
    'UTF8')), 'hex');
$$;


-- ---------------------------------------------------------------------------
-- Ejecutar el sorteo: ready -> drawing -> completed
-- ---------------------------------------------------------------------------
-- begin: entrega semilla y lista. Se puede repetir si el proceso se cayó
-- (reanuda el mismo sorteo en curso; no crea otro).
-- complete: verifica y guarda. Si ya estaba completo devuelve lo guardado.

CREATE OR REPLACE FUNCTION giveaway_begin_draw(p_giveaway_id UUID, p_actor UUID, p_confirm_slug TEXT)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  g giveaways%ROWTYPE;
  d giveaway_draws%ROWTYPE;
  v_seed TEXT;
BEGIN
  SELECT * INTO g FROM giveaways WHERE id = p_giveaway_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'giveaway_not_found'; END IF;
  IF g.status NOT IN ('ready', 'drawing') THEN RAISE EXCEPTION 'giveaway_invalid_state'; END IF;
  IF p_confirm_slug IS DISTINCT FROM g.slug THEN RAISE EXCEPTION 'confirmation_mismatch'; END IF;

  IF g.status = 'ready' THEN
    INSERT INTO giveaway_draws (giveaway_id, status, seed_commitment, tickets_count, tickets_hash, executed_by)
    VALUES (g.id, 'drawing', g.seed_commitment, g.tickets_count, g.tickets_hash, p_actor)
    RETURNING * INTO d;
    UPDATE giveaways SET status = 'drawing', version = version + 1 WHERE id = g.id;
    PERFORM giveaway_log(g.id, p_actor, 'draw_started', 'draw', d.id::text, NULL,
      jsonb_build_object('tickets_hash', g.tickets_hash), NULL);
  ELSE
    SELECT * INTO d FROM giveaway_draws WHERE giveaway_id = g.id AND status = 'drawing';
    IF NOT FOUND THEN RAISE EXCEPTION 'giveaway_invalid_state'; END IF;
  END IF;

  SELECT seed_hex INTO v_seed FROM giveaway_secrets WHERE giveaway_id = g.id;
  IF v_seed IS NULL THEN RAISE EXCEPTION 'draw_seed_missing'; END IF;

  RETURN jsonb_build_object(
    'draw_id', d.id,
    'seed_hex', v_seed,
    'seed_commitment', g.seed_commitment,
    'tickets_hash', g.tickets_hash,
    'winners_count', g.winners_count,
    'alternates_count', g.alternates_count,
    'tickets', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('ticket_number', ticket_number, 'participant_id', participant_id)
                       ORDER BY ticket_number)
      FROM giveaway_entries WHERE giveaway_id = g.id), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION giveaway_complete_draw(
  p_giveaway_id UUID,
  p_actor UUID,
  p_algorithm TEXT,
  p_results JSONB
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  g giveaways%ROWTYPE;
  d giveaway_draws%ROWTYPE;
  v_seed TEXT;
  v_participants INTEGER;
  v_exp_winners INTEGER;
  v_exp_alternates INTEGER;
  v_rows INTEGER;
  v_distinct INTEGER;
BEGIN
  SELECT * INTO g FROM giveaways WHERE id = p_giveaway_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'giveaway_not_found'; END IF;

  -- Ejecución repetida: se devuelve lo ya guardado, sin recalcular.
  IF g.status = 'completed' THEN
    SELECT * INTO d FROM giveaway_draws WHERE giveaway_id = g.id AND status = 'completed';
    RETURN jsonb_build_object(
      'draw_id', d.id, 'already_completed', true, 'seed_hex', d.seed_hex,
      'seed_commitment', d.seed_commitment, 'tickets_hash', d.tickets_hash, 'results', d.result->'results');
  END IF;

  IF g.status <> 'drawing' THEN RAISE EXCEPTION 'giveaway_invalid_state'; END IF;

  SELECT * INTO d FROM giveaway_draws WHERE giveaway_id = g.id AND status = 'drawing' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'giveaway_invalid_state'; END IF;

  -- 1. La semilla guardada tiene que coincidir con el compromiso publicado.
  SELECT seed_hex INTO v_seed FROM giveaway_secrets WHERE giveaway_id = g.id;
  IF v_seed IS NULL OR encode(sha256(decode(v_seed, 'hex')), 'hex') IS DISTINCT FROM g.seed_commitment THEN
    RAISE EXCEPTION 'draw_seed_mismatch';
  END IF;

  -- 2. La lista de tickets no puede haber cambiado desde el congelamiento.
  IF giveaway_compute_tickets_hash(g.id) IS DISTINCT FROM g.tickets_hash THEN
    RAISE EXCEPTION 'draw_tickets_changed';
  END IF;

  -- 3. El resultado tiene que ser coherente con la lista y las reglas.
  IF p_results IS NULL OR jsonb_typeof(p_results) <> 'array' OR jsonb_array_length(p_results) = 0 THEN
    RAISE EXCEPTION 'draw_invalid_result';
  END IF;

  SELECT COUNT(DISTINCT participant_id) INTO v_participants FROM giveaway_entries WHERE giveaway_id = g.id;
  v_exp_winners := LEAST(g.winners_count, v_participants);
  v_exp_alternates := LEAST(g.alternates_count, v_participants - v_exp_winners);

  SELECT COUNT(*), COUNT(DISTINCT participant_id) INTO v_rows, v_distinct
  FROM jsonb_to_recordset(p_results) AS r(role TEXT, "position" INTEGER, participant_id UUID, ticket_number INTEGER);

  IF v_rows <> v_exp_winners + v_exp_alternates OR v_distinct <> v_rows THEN
    RAISE EXCEPTION 'draw_invalid_result';
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_results) AS r(role TEXT, "position" INTEGER, participant_id UUID, ticket_number INTEGER)
    WHERE r.role NOT IN ('winner', 'alternate')
       OR NOT EXISTS (
         SELECT 1 FROM giveaway_entries e
         WHERE e.giveaway_id = g.id AND e.participant_id = r.participant_id AND e.ticket_number = r.ticket_number)
  ) THEN
    RAISE EXCEPTION 'draw_invalid_result';
  END IF;

  IF ARRAY(SELECT "position" FROM jsonb_to_recordset(p_results) AS r(role TEXT, "position" INTEGER, participant_id UUID, ticket_number INTEGER)
           WHERE role = 'winner' ORDER BY "position")
       IS DISTINCT FROM ARRAY(SELECT x FROM generate_series(1, v_exp_winners) x)
     OR ARRAY(SELECT "position" FROM jsonb_to_recordset(p_results) AS r(role TEXT, "position" INTEGER, participant_id UUID, ticket_number INTEGER)
           WHERE role = 'alternate' ORDER BY "position")
       IS DISTINCT FROM ARRAY(SELECT x FROM generate_series(1, v_exp_alternates) x) THEN
    RAISE EXCEPTION 'draw_invalid_result';
  END IF;

  INSERT INTO giveaway_winners (giveaway_id, draw_id, participant_id, ticket_number, role, position)
  SELECT g.id, d.id, r.participant_id, r.ticket_number, r.role, r."position"
  FROM jsonb_to_recordset(p_results) AS r(role TEXT, "position" INTEGER, participant_id UUID, ticket_number INTEGER);

  UPDATE giveaway_draws
  SET status = 'completed', algorithm = p_algorithm, seed_hex = v_seed, completed_at = NOW(),
      result = jsonb_build_object('algorithm', p_algorithm, 'results', p_results)
  WHERE id = d.id;

  UPDATE giveaways SET status = 'completed', version = version + 1 WHERE id = g.id;

  PERFORM giveaway_enqueue(g.id, 'giveaway_completed', 'giveaway_completed:' || g.id::text, '{}'::jsonb);
  PERFORM giveaway_log(g.id, p_actor, 'draw_completed', 'draw', d.id::text, NULL,
    jsonb_build_object('algorithm', p_algorithm, 'results', p_results), NULL);

  RETURN jsonb_build_object(
    'draw_id', d.id, 'already_completed', false, 'seed_hex', v_seed,
    'seed_commitment', g.seed_commitment, 'tickets_hash', g.tickets_hash, 'results', p_results);
END;
$$;

-- Error recuperable durante el sorteo: drawing -> ready, con el intento anotado.
CREATE OR REPLACE FUNCTION giveaway_abort_draw(p_giveaway_id UUID, p_actor UUID, p_reason TEXT)
RETURNS giveaways
LANGUAGE plpgsql
AS $$
DECLARE
  g giveaways%ROWTYPE;
BEGIN
  SELECT * INTO g FROM giveaways WHERE id = p_giveaway_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'giveaway_not_found'; END IF;
  IF g.status <> 'drawing' THEN RAISE EXCEPTION 'giveaway_invalid_state'; END IF;

  UPDATE giveaway_draws SET status = 'failed', failed_reason = COALESCE(NULLIF(btrim(p_reason), ''), 'sin detalle')
  WHERE giveaway_id = g.id AND status = 'drawing';

  UPDATE giveaways SET status = 'ready', version = version + 1 WHERE id = g.id RETURNING * INTO g;

  PERFORM giveaway_log(g.id, p_actor, 'draw_aborted', 'giveaway', g.id::text, NULL, NULL, p_reason);
  RETURN g;
END;
$$;


-- ---------------------------------------------------------------------------
-- Cancelar (antes de sortear), con motivo
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION giveaway_cancel(p_giveaway_id UUID, p_actor UUID, p_reason TEXT)
RETURNS giveaways
LANGUAGE plpgsql
AS $$
DECLARE
  g giveaways%ROWTYPE;
  v_before TEXT;
BEGIN
  IF p_reason IS NULL OR length(btrim(p_reason)) = 0 THEN RAISE EXCEPTION 'reason_required'; END IF;

  SELECT * INTO g FROM giveaways WHERE id = p_giveaway_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'giveaway_not_found'; END IF;
  IF NOT giveaway_transition_allowed(g.status, 'cancelled') THEN
    RAISE EXCEPTION 'giveaway_invalid_state';
  END IF;

  v_before := g.status;
  UPDATE giveaways SET status = 'cancelled', cancelled_reason = btrim(p_reason), version = version + 1
  WHERE id = g.id RETURNING * INTO g;

  PERFORM giveaway_log(g.id, p_actor, 'giveaway_cancelled', 'giveaway', g.id::text,
    jsonb_build_object('status', v_before), jsonb_build_object('status', 'cancelled'), btrim(p_reason));
  RETURN g;
END;
$$;


-- ---------------------------------------------------------------------------
-- Permisos: solo service_role puede llamar a estas funciones
-- ---------------------------------------------------------------------------
-- Sin esto, cualquiera con la clave anon podría invocarlas por PostgREST
-- (/rest/v1/rpc/...), porque Postgres da EXECUTE a PUBLIC por defecto.

DO $$
DECLARE
  f RECORD;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'giveaway_log', 'giveaway_enqueue', 'giveaway_schedule', 'giveaway_tick',
        'giveaway_enter', 'giveaway_refresh_entries', 'giveaway_submit_evidence',
        'giveaway_submit_answer', 'giveaway_review_evidence', 'giveaway_extend',
        'giveaway_freeze', 'giveaway_compute_tickets_hash', 'giveaway_begin_draw',
        'giveaway_complete_draw', 'giveaway_abort_draw', 'giveaway_cancel'
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
