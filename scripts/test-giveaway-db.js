// Test de las migraciones de sorteos contra PostgreSQL real (embebido).
// Ejecutar: npm run test:giveaway-db
//
// Usa @electric-sql/pglite, un PostgreSQL 18 compilado a WebAssembly, en
// memoria. Aplica 001 a 003 y 006 y 007, y prueba reglas, triggers, funciones
// y permisos con datos armados a mano. No toca ninguna base real.
//
// Limitación: pglite tiene UNA conexión, así que acá se prueba que cada paso
// respete las reglas sobre el estado que dejó el anterior, pero no la
// concurrencia real entre dos conexiones.

const fs = require('node:fs')
const path = require('node:path')
const nodeCrypto = require('node:crypto')
const { loadLibModule } = require('./_load-lib')

const draw = loadLibModule('giveaways/draw.js', ['deriveDraw', 'verifyDraw', 'ticketsHash', 'seedCommitment'])
const states = loadLibModule('giveaways/states.js', ['GIVEAWAY_STATUSES', 'canTransition'])

const MIGRATIONS = [
  '001_init.sql',
  '002_customers.sql',
  '003_finance.sql',
  '006_giveaways.sql',
  '007_giveaways_rpc.sql',
]

let failures = 0

function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) failures++
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}${ok ? '' : ` -> esperado ${JSON.stringify(expected)}, obtenido ${JSON.stringify(actual)}`}`)
}

const sha = text => nodeCrypto.createHash('sha256').update(text).digest('hex')

async function main() {
  const { PGlite } = await import('@electric-sql/pglite')
  const db = new PGlite()

  const q = async (sql, params = []) => (await db.query(sql, params)).rows
  const one = async (sql, params = []) => (await q(sql, params))[0]

  // Devuelve 'ok' si la operación falló con un mensaje que contiene `fragment`.
  async function failsWith(fragment, fn) {
    try {
      await fn()
      return `no falló (se esperaba "${fragment}")`
    } catch (error) {
      return error.message.includes(fragment) ? 'ok' : `falló con otro mensaje: ${error.message}`
    }
  }

  async function asRole(role, fn) {
    await db.exec(`SET ROLE ${role}`)
    try {
      return await fn()
    } finally {
      await db.exec('RESET ROLE')
    }
  }

  // Imita los permisos por defecto de Supabase: anon, authenticated y
  // service_role reciben todo sobre lo que se crea en el esquema public.
  await db.exec(`
    CREATE ROLE anon NOLOGIN;
    CREATE ROLE authenticated NOLOGIN;
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
  `)

  for (const file of MIGRATIONS) {
    await db.exec(fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', file), 'utf8'))
  }
  // Las migraciones son idempotentes: una segunda pasada no debe fallar.
  let secondPass = 'ok'
  try {
    for (const file of MIGRATIONS.slice(3)) {
      await db.exec(fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', file), 'utf8'))
    }
  } catch (error) {
    secondPass = error.message
  }
  check('las migraciones 006 y 007 se pueden aplicar dos veces', secondPass, 'ok')

  // -------------------------------------------------------------------------
  // Auxiliares de datos
  // -------------------------------------------------------------------------
  const admin = await one(`INSERT INTO admins (email, password_hash) VALUES ('owner@test.com', 'x') RETURNING id`)
  check('los admins existentes quedan como owner', (await one('SELECT role FROM admins')).role, 'owner')

  let seq = 0
  const seedOf = n => sha(`seed-${n}`)

  async function newGiveaway({ startsHours = -1, endsHours = 24, winners = 1, alternates = 0, max = 2, terms = 'Bases y condiciones' } = {}) {
    seq += 1
    const row = await one(
      `INSERT INTO giveaways (slug, title, prize_name, starts_at, ends_at, winners_count, alternates_count, max_opportunities, terms_text)
       VALUES ($1, $2, 'Premio', now() + $3 * interval '1 hour', now() + $4 * interval '1 hour', $5, $6, $7, $8)
       RETURNING id, slug`,
      [`sorteo-${seq}`, `Sorteo ${seq}`, startsHours, endsHours, winners, alternates, max, terms]
    )
    return { ...row, seed: seedOf(seq) }
  }

  async function addRequirement(giveawayId, slot, kind, position) {
    return (
      await one(
        `INSERT INTO giveaway_requirements (giveaway_id, position, slot, kind, title) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [giveawayId, position, slot, kind, `Requisito ${position}`]
      )
    ).id
  }

  // Las funciones que devuelven una fila de giveaways se leen con SELECT * FROM.
  const schedule = (g, actor = admin.id) =>
    one(`SELECT * FROM giveaway_schedule($1::uuid, $2::uuid, $3)`, [g.id, actor, g.seed])
  const tick = (hoursAhead = 0) => one(`SELECT giveaway_tick(now() + $1 * interval '1 hour') AS r`, [hoursAhead]).then(x => x.r)
  // jsonb reordena las claves: se compara por campos, no como texto.
  const counts = t => [t.activated, t.closed]
  const norm = results => results.map(r => [r.role, r.position, r.participant_id, r.ticket_number])
  const status = async id => (await one('SELECT status FROM giveaways WHERE id = $1', [id])).status

  async function enter(giveawayId, i, overrides = {}) {
    const p = {
      name: `Persona ${i}`,
      phone: `5426570${String(i).padStart(5, '0')}`,
      ig: `persona_${i}`,
      terms: 1,
      key: `clave-${giveawayId}-${i}`,
      ...overrides,
    }
    // El token real es aleatorio; acá depende de la clave para que cada
    // inscripción distinta tenga el suyo, y la misma petición repetida el mismo.
    const token = sha(`token-${giveawayId}-${p.key}`)
    const row = await one(
      `SELECT giveaway_enter($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) AS r`,
      [giveawayId, p.name, p.phone, p.phone, null, p.ig, p.ig, true, p.terms, token, p.key]
    )
    return row.r
  }

  const submitEvidence = (participantId, requirementId, label) =>
    one(`SELECT giveaway_submit_evidence($1::uuid, $2::uuid, $3, 'image/png', 1234, $4) AS r`, [
      participantId,
      requirementId,
      `giveaway/${participantId}/${label}.png`,
      sha(`imagen-${label}`),
    ]).then(x => x.r)

  const submitAnswer = (participantId, requirementId, payload = {}) =>
    one(`SELECT giveaway_submit_answer($1::uuid, $2::uuid, $3::jsonb) AS r`, [
      participantId,
      requirementId,
      JSON.stringify(payload),
    ]).then(x => x.r)

  const review = (evidenceId, decision, reason = null) =>
    one(`SELECT giveaway_review_evidence($1::uuid, $2::uuid, $3, $4) AS r`, [evidenceId, admin.id, decision, reason]).then(x => x.r)

  const freeze = id => one(`SELECT * FROM giveaway_freeze($1::uuid, $2::uuid)`, [id, admin.id])
  const beginDraw = (id, slug) =>
    one(`SELECT giveaway_begin_draw($1::uuid, $2::uuid, $3) AS r`, [id, admin.id, slug]).then(x => x.r)
  const completeDraw = (id, results) =>
    one(`SELECT giveaway_complete_draw($1::uuid, $2::uuid, 'mm-hmac-sha256-v1', $3::jsonb) AS r`, [
      id,
      admin.id,
      JSON.stringify(results),
    ]).then(x => x.r)

  // Sorteo listo para ejecutar, armado rápido con requisitos declarativos
  // (no hace falta que un admin revise nada).
  async function readyGiveaway({ participants = 6, winners = 2, alternates = 1, withSecondSlot = false } = {}) {
    const g = await newGiveaway({ winners, alternates })
    const r1 = await addRequirement(g.id, 1, 'declarative', 1)
    const r2 = withSecondSlot ? await addRequirement(g.id, 2, 'declarative', 2) : null
    await schedule(g)
    await tick(0)
    const people = []
    for (let i = 1; i <= participants; i++) {
      const entered = await enter(g.id, i)
      await submitAnswer(entered.participant_id, r1)
      if (r2 && i % 2 === 0) await submitAnswer(entered.participant_id, r2)
      people.push(entered.participant_id)
    }
    await tick(48)
    await freeze(g.id)
    return { ...g, r1, r2, people }
  }

  // -------------------------------------------------------------------------
  // 1. La tabla de transiciones de la base coincide con la de JavaScript
  // -------------------------------------------------------------------------
  {
    const mismatches = []
    for (const from of states.GIVEAWAY_STATUSES) {
      for (const to of states.GIVEAWAY_STATUSES) {
        const inDb = (await one('SELECT giveaway_transition_allowed($1, $2) AS ok', [from, to])).ok
        if (inDb !== states.canTransition(from, to)) mismatches.push(`${from}->${to}`)
      }
    }
    check('la tabla de transiciones coincide entre SQL y JavaScript', mismatches, [])
  }

  // -------------------------------------------------------------------------
  // 2. Publicación
  // -------------------------------------------------------------------------
  const g1 = await newGiveaway({ winners: 2, alternates: 1 })
  check('sin requisitos no se puede publicar', await failsWith('giveaway_missing_requirements', () => schedule(g1)), 'ok')

  const r1 = await addRequirement(g1.id, 1, 'evidence_upload', 1)
  const r2 = await addRequirement(g1.id, 2, 'evidence_upload', 2)

  const noTerms = await newGiveaway({ terms: '   ' })
  await addRequirement(noTerms.id, 1, 'declarative', 1)
  check('sin bases no se puede publicar', await failsWith('giveaway_missing_terms', () => schedule(noTerms)), 'ok')

  const pastGiveaway = await newGiveaway({ startsHours: -3, endsHours: -2 })
  await addRequirement(pastGiveaway.id, 1, 'declarative', 1)
  check('no se publica un sorteo que ya terminó', await failsWith('giveaway_ends_in_past', () => schedule(pastGiveaway)), 'ok')

  const slotMismatch = await newGiveaway({ max: 1 })
  await addRequirement(slotMismatch.id, 1, 'declarative', 1)
  await addRequirement(slotMismatch.id, 2, 'declarative', 2)
  check('un requisito de slot 2 exige max_opportunities = 2', await failsWith('giveaway_requirement_slot_invalid', () => schedule(slotMismatch)), 'ok')

  check('semilla inválida es rechazada', await failsWith('giveaway_invalid_seed', () =>
    one(`SELECT giveaway_schedule($1::uuid, $2::uuid, 'corta')`, [g1.id, admin.id])), 'ok')

  const scheduled = await schedule(g1)
  check('al publicar queda en scheduled', scheduled.status, 'scheduled')
  check('el compromiso es SHA-256 de los bytes de la semilla', scheduled.seed_commitment, await draw.seedCommitment(g1.seed))
  check('la semilla queda guardada aparte', (await one('SELECT seed_hex FROM giveaway_secrets WHERE giveaway_id = $1', [g1.id])).seed_hex, g1.seed)
  check('no se publica dos veces', await failsWith('giveaway_invalid_state', () => schedule(g1)), 'ok')

  // -------------------------------------------------------------------------
  // 3. Cron: transiciones por tiempo
  // -------------------------------------------------------------------------
  const futureGiveaway = await newGiveaway({ startsHours: 5, endsHours: 48 })
  await addRequirement(futureGiveaway.id, 1, 'declarative', 1)
  await schedule(futureGiveaway)
  check('un sorteo programado a futuro no admite inscripciones', await failsWith('giveaway_not_active', () => enter(futureGiveaway.id, 1)), 'ok')

  check('el cron activa lo que ya empezó', counts(await tick(0)), [1, 0])
  check('el cron es idempotente', counts(await tick(0)), [0, 0])
  check('el sorteo ya empezado quedó activo', await status(g1.id), 'active')
  check('el sorteo futuro sigue programado', await status(futureGiveaway.id), 'scheduled')

  check('con el sorteo activo no se editan los requisitos', await failsWith('giveaway_phase_locked', () =>
    q('INSERT INTO giveaway_requirements (giveaway_id, position, slot, kind, title) VALUES ($1, 9, 1, $2, $3)', [g1.id, 'declarative', 'extra'])), 'ok')
  check('las reglas del sorteo no cambian tras publicar', await failsWith('giveaway_rules_locked', () =>
    q('UPDATE giveaways SET winners_count = 3 WHERE id = $1', [g1.id])), 'ok')
  check('no se borra un sorteo activo', await failsWith('giveaway_cannot_delete', () =>
    q('DELETE FROM giveaways WHERE id = $1', [g1.id])), 'ok')
  check('no se salta la máquina de estados con un UPDATE', await failsWith('giveaway_invalid_transition', () =>
    q(`UPDATE giveaways SET status = 'ready' WHERE id = $1`, [g1.id])), 'ok')

  // -------------------------------------------------------------------------
  // 4. Inscripción
  // -------------------------------------------------------------------------
  const customer = await one(`INSERT INTO customers (phone, name) VALUES ('54265700001', 'Cliente existente') RETURNING id`)
  const customersBefore = (await one('SELECT COUNT(*)::int AS n FROM customers')).n

  const p1 = await enter(g1.id, 1, { phone: '54265700001' })
  check('la primera inscripción crea al participante', p1.created, true)
  check('si el teléfono ya es de un cliente, se vincula', (await one('SELECT customer_id FROM giveaway_participants WHERE id = $1', [p1.participant_id])).customer_id, customer.id)
  check('inscribirse no crea clientes nuevos', (await one('SELECT COUNT(*)::int AS n FROM customers')).n, customersBefore)

  const again = await enter(g1.id, 1, { phone: '54265700001' })
  check('repetir la misma petición (misma clave) no duplica', [again.created, again.participant_id], [false, p1.participant_id])
  check('el mismo teléfono con otra clave es rechazado', await failsWith('giveaway_phone_taken', () =>
    enter(g1.id, 1, { phone: '54265700001', key: 'otra-clave', ig: 'otro_usuario' })), 'ok')
  check('el mismo Instagram con otro teléfono es rechazado', await failsWith('giveaway_instagram_taken', () =>
    enter(g1.id, 77, { ig: 'persona_1' })), 'ok')
  check('bases desactualizadas son rechazadas', await failsWith('giveaway_terms_outdated', () =>
    enter(g1.id, 88, { terms: 2 })), 'ok')

  const people = [p1.participant_id]
  for (let i = 2; i <= 6; i++) people.push((await enter(g1.id, i)).participant_id)

  // -------------------------------------------------------------------------
  // 5. Evidencias y oportunidades
  // -------------------------------------------------------------------------
  const evR2first = await submitEvidence(people[0], r2, 'p1-r2')
  const approveR2first = await review(evR2first.evidence_id, 'approved')
  check('aprobar la 2.ª oportunidad antes que la 1.ª no crea tickets', approveR2first.entries_created, 0)

  const evP1 = await submitEvidence(people[0], r1, 'p1-r1')
  check('subir la misma evidencia dos veces es rechazado', await failsWith('evidence_already_submitted', () =>
    submitEvidence(people[0], r1, 'p1-r1-otra')), 'ok')
  check('la misma captura usada por otra persona es rechazada', await failsWith('evidence_duplicate', () =>
    submitEvidence(people[1], r1, 'p1-r1')), 'ok')

  check('rechazar sin motivo no se permite', await failsWith('reason_required', () => review(evP1.evidence_id, 'rejected')), 'ok')
  const approveP1 = await review(evP1.evidence_id, 'approved')
  check('aprobar la 1.ª con la 2.ª ya aprobada otorga las dos oportunidades', approveP1.entries_created, 2)
  check('los tickets salen numerados desde 1', (await q('SELECT ticket_number FROM giveaway_entries WHERE giveaway_id = $1 ORDER BY ticket_number', [g1.id])).map(r => r.ticket_number), [1, 2])
  check('no se revisa dos veces la misma evidencia', await failsWith('evidence_not_pending', () => review(evP1.evidence_id, 'approved')), 'ok')

  // Persona 2: rechazo y reenvío.
  const evP2 = await submitEvidence(people[1], r1, 'p2-r1')
  await review(evP2.evidence_id, 'rejected', 'No se ve la cuenta')
  const evP2b = await submitEvidence(people[1], r1, 'p2-r1-nueva')
  check('tras un rechazo puede reenviar (intento 2)', evP2b.attempt_no, 2)
  await review(evP2b.evidence_id, 'approved')

  // Personas 3 a 5 aprobadas; la persona 6 queda pendiente a propósito.
  for (const [idx, label] of [[2, 'p3'], [3, 'p4'], [4, 'p5']]) {
    const ev = await submitEvidence(people[idx], r1, `${label}-r1`)
    await review(ev.evidence_id, 'approved')
  }
  const evP6 = await submitEvidence(people[5], r1, 'p6-r1')

  check('el contador del sorteo coincide con los tickets entregados', [
    (await one('SELECT ticket_counter FROM giveaways WHERE id = $1', [g1.id])).ticket_counter,
    (await one('SELECT COUNT(*)::int AS n FROM giveaway_entries WHERE giveaway_id = $1', [g1.id])).n,
  ], [6, 6])
  check('un participante no puede tener la 2.ª sin la 1.ª (trigger)', await failsWith('giveaway_slot_requires_first', () =>
    q(`INSERT INTO giveaway_entries (giveaway_id, participant_id, slot, ticket_number) VALUES ($1, $2, 2, 99)`, [g1.id, people[5]])), 'ok')
  check('no existe una 3.ª oportunidad', await failsWith('giveaway_slot_not_allowed', () =>
    q(`INSERT INTO giveaway_entries (giveaway_id, participant_id, slot, ticket_number) VALUES ($1, $2, 3, 99)`, [g1.id, people[5]])), 'ok')
  check('un ticket de otro sorteo no se puede mezclar (clave compuesta)', await failsWith('foreign key', async () => {
    const other = await newGiveaway()
    await addRequirement(other.id, 1, 'declarative', 1)
    await schedule(other)
    await tick(0)
    await q(`INSERT INTO giveaway_entries (giveaway_id, participant_id, slot, ticket_number) VALUES ($1, $2, 1, 1)`, [other.id, people[5]])
  }), 'ok')

  // -------------------------------------------------------------------------
  // 6. Cierre y congelamiento
  // -------------------------------------------------------------------------
  check('no se congela un sorteo que sigue activo', await failsWith('giveaway_invalid_state', () => freeze(g1.id)), 'ok')

  // Cierran g1, el sorteo auxiliar del caso de clave compuesta y el que estaba
  // programado a futuro (el cron lo activa y lo cierra en la misma pasada).
  check('el cron cierra al llegar la hora', counts(await tick(48)).slice(1), [3])
  check('el sorteo quedó en closing', await status(g1.id), 'closing')
  check('el cierre encola el aviso al admin una sola vez', (await one(`SELECT COUNT(*)::int AS n FROM giveaway_notifications WHERE giveaway_id = $1 AND kind = 'giveaway_closed'`, [g1.id])).n, 1)
  check('el cron no repite el cierre', counts(await tick(48)), [0, 0])

  check('cerrado: no admite inscripciones nuevas', await failsWith('giveaway_not_active', () => enter(g1.id, 50)), 'ok')
  check('cerrado: no admite evidencias nuevas', await failsWith('giveaway_not_active', () => submitEvidence(people[5], r2, 'tarde')), 'ok')
  check('cerrado: tampoco por SQL directo', await failsWith('giveaway_phase_locked', () =>
    q(`INSERT INTO giveaway_participants (giveaway_id, full_name, phone_normalized, terms_version, access_token_hash)
       VALUES ($1, 'Tarde', '5400000', 1, $2)`, [g1.id, sha('tarde')])), 'ok')

  check('con evidencias pendientes no se congela', await failsWith('giveaway_has_pending_evidence', () => freeze(g1.id)), 'ok')
  await review(evP6.evidence_id, 'approved')

  const frozen = await freeze(g1.id)
  check('al congelar queda en ready', frozen.status, 'ready')
  check('se guardan huella y cantidad de tickets', [frozen.tickets_count, typeof frozen.tickets_hash], [7, 'string'])

  const frozenTickets = await q('SELECT ticket_number, participant_id FROM giveaway_entries WHERE giveaway_id = $1', [g1.id])
  check('la huella de SQL coincide con la de JavaScript', frozen.tickets_hash, await draw.ticketsHash(frozenTickets))

  check('congelado: no se agregan oportunidades', await failsWith('giveaway_phase_locked', () =>
    q(`INSERT INTO giveaway_entries (giveaway_id, participant_id, slot, ticket_number) VALUES ($1, $2, 2, 100)`, [g1.id, people[5]])), 'ok')
  check('congelado: no se tocan las evidencias', await failsWith('giveaway_phase_locked', () =>
    q(`UPDATE giveaway_evidence SET status = 'pending' WHERE id = $1`, [evP6.evidence_id])), 'ok')
  check('congelado: no se borran participantes', await failsWith('giveaway_phase_locked', () =>
    q('DELETE FROM giveaway_participants WHERE id = $1', [people[0]])), 'ok')
  check('congelado: no se borra una oportunidad', await failsWith('giveaway_phase_locked', () =>
    q('DELETE FROM giveaway_entries WHERE giveaway_id = $1 AND slot = 2', [g1.id])), 'ok')

  // -------------------------------------------------------------------------
  // 7. Ejecución del sorteo
  // -------------------------------------------------------------------------
  check('la ejecución exige escribir el nombre del sorteo', await failsWith('confirmation_mismatch', () => beginDraw(g1.id, 'otro')), 'ok')

  const begun = await beginDraw(g1.id, g1.slug)
  check('al empezar entrega la semilla y la lista congelada', [begun.seed_hex, begun.tickets.length], [g1.seed, 7])
  check('el sorteo pasa a drawing', await status(g1.id), 'drawing')
  const resumed = await beginDraw(g1.id, g1.slug)
  check('reanudar no crea otro sorteo', resumed.draw_id, begun.draw_id)

  const derived = await draw.deriveDraw({
    seedHex: begun.seed_hex,
    tickets: begun.tickets,
    winnersCount: begun.winners_count,
    alternatesCount: begun.alternates_count,
  })

  check('un resultado adulterado es rechazado', await failsWith('draw_invalid_result', () => completeDraw(g1.id, [
    { ...derived.results[0], ticket_number: 999 }, ...derived.results.slice(1),
  ])), 'ok')
  check('no se acepta un participante repetido', await failsWith('draw_invalid_result', () => completeDraw(g1.id, [
    derived.results[0], { ...derived.results[1], participant_id: derived.results[0].participant_id, ticket_number: derived.results[0].ticket_number }, derived.results[2],
  ])), 'ok')
  check('no se acepta un resultado incompleto', await failsWith('draw_invalid_result', () => completeDraw(g1.id, derived.results.slice(0, 2))), 'ok')
  check('el estado sigue en drawing tras los rechazos', await status(g1.id), 'drawing')

  const done = await completeDraw(g1.id, derived.results)
  check('el sorteo se completa', await status(g1.id), 'completed')
  check('se revela la semilla', done.seed_hex, g1.seed)
  check('se guardan 2 ganadores y 1 suplente', (await q(`SELECT role, position FROM giveaway_winners WHERE giveaway_id = $1 ORDER BY role DESC, position`, [g1.id])).map(r => `${r.role}${r.position}`), ['winner1', 'winner2', 'alternate1'])

  const repeated = await completeDraw(g1.id, derived.results)
  check('ejecutar dos veces devuelve el mismo resultado', [repeated.already_completed, norm(repeated.results)], [true, norm(derived.results)])
  check('queda un único sorteo vigente', (await one(`SELECT COUNT(*)::int AS n FROM giveaway_draws WHERE giveaway_id = $1 AND status IN ('drawing', 'completed')`, [g1.id])).n, 1)
  check('por SQL tampoco se puede crear un segundo sorteo vigente', await failsWith('uq_giveaway_draws_one_live', () =>
    q(`INSERT INTO giveaway_draws (giveaway_id, status, seed_commitment, tickets_count, tickets_hash)
       VALUES ($1, 'drawing', $2, 1, $3)`, [g1.id, frozen.seed_commitment, frozen.tickets_hash])), 'ok')

  const verification = await draw.verifyDraw({
    seedHex: done.seed_hex,
    seedCommitmentHex: done.seed_commitment,
    ticketsHashHex: done.tickets_hash,
    tickets: begun.tickets,
    winnersCount: begun.winners_count,
    alternatesCount: begun.alternates_count,
    results: done.results,
  })
  check('cualquiera puede verificar el resultado con los datos públicos', verification.ok, true)

  check('un sorteo terminado no se modifica', await failsWith('giveaway_draw_immutable', () =>
    q(`UPDATE giveaway_draws SET algorithm = 'otro' WHERE giveaway_id = $1`, [g1.id])), 'ok')
  check('los sorteos no se borran', await failsWith('giveaway_draw_immutable', () =>
    q('DELETE FROM giveaway_draws WHERE giveaway_id = $1', [g1.id])), 'ok')
  check('el resultado no se reescribe', await failsWith('giveaway_winner_immutable', () =>
    q(`UPDATE giveaway_winners SET role = 'alternate' WHERE giveaway_id = $1 AND position = 1 AND role = 'winner'`, [g1.id])), 'ok')
  check('los ganadores no se borran', await failsWith('giveaway_winner_immutable', () =>
    q('DELETE FROM giveaway_winners WHERE giveaway_id = $1', [g1.id])), 'ok')
  check('el estado de entrega sí puede avanzar', (await q(`UPDATE giveaway_winners SET status = 'notified' WHERE giveaway_id = $1 AND role = 'winner' AND position = 1 RETURNING status`, [g1.id]))[0].status, 'notified')
  check('un sorteo completado no se cancela', await failsWith('giveaway_invalid_state', () =>
    one(`SELECT giveaway_cancel($1::uuid, $2::uuid, 'x')`, [g1.id, admin.id])), 'ok')

  // -------------------------------------------------------------------------
  // 8. Casos de falla durante la ejecución
  // -------------------------------------------------------------------------
  {
    const g = await readyGiveaway({ participants: 4, winners: 1, alternates: 1 })
    const b = await beginDraw(g.id, g.slug)
    const d = await draw.deriveDraw({ seedHex: b.seed_hex, tickets: b.tickets, winnersCount: 1, alternatesCount: 1 })

    await db.exec('SET session_replication_role = replica') // salta los triggers solo para armar la falla
    await q('UPDATE giveaway_secrets SET seed_hex = $1 WHERE giveaway_id = $2', [sha('otra-semilla'), g.id])
    await db.exec('SET session_replication_role = DEFAULT')
    check('una semilla distinta de la comprometida es rechazada', await failsWith('draw_seed_mismatch', () => completeDraw(g.id, d.results)), 'ok')

    await q('UPDATE giveaway_secrets SET seed_hex = $1 WHERE giveaway_id = $2', [g.seed, g.id])
    const aborted = await one(`SELECT * FROM giveaway_abort_draw($1::uuid, $2::uuid, 'se cayó el servidor')`, [g.id, admin.id])
    check('abortar devuelve el sorteo a ready', aborted.status, 'ready')
    check('el intento abortado queda registrado como failed', (await one(`SELECT status FROM giveaway_draws WHERE giveaway_id = $1`, [g.id])).status, 'failed')

    const b2 = await beginDraw(g.id, g.slug)
    check('después de abortar se puede empezar de nuevo', b2.draw_id === b.draw_id, false)
    const d2 = await draw.deriveDraw({ seedHex: b2.seed_hex, tickets: b2.tickets, winnersCount: 1, alternatesCount: 1 })
    await completeDraw(g.id, d2.results)
    check('y completar con el mismo resultado de siempre', [await status(g.id), norm(d2.results)], ['completed', norm(d.results)])
  }
  {
    const g = await readyGiveaway({ participants: 3, winners: 1, alternates: 0 })
    const b = await beginDraw(g.id, g.slug)
    const d = await draw.deriveDraw({ seedHex: b.seed_hex, tickets: b.tickets, winnersCount: 1, alternatesCount: 0 })
    await db.exec('ALTER TABLE giveaway_entries DISABLE TRIGGER USER') // solo para simular manipulación directa
    await q(`INSERT INTO giveaway_entries (giveaway_id, participant_id, slot, ticket_number) VALUES ($1, $2, 2, 999)`, [g.id, g.people[0]])
    await db.exec('ALTER TABLE giveaway_entries ENABLE TRIGGER USER')
    check('detecta tickets agregados después del congelamiento', await failsWith('draw_tickets_changed', () => completeDraw(g.id, d.results)), 'ok')
  }

  // -------------------------------------------------------------------------
  // 9. Cancelar y extender
  // -------------------------------------------------------------------------
  {
    const g = await newGiveaway()
    await addRequirement(g.id, 1, 'declarative', 1)
    await schedule(g)
    await tick(0)
    check('cancelar exige un motivo', await failsWith('reason_required', () =>
      one(`SELECT giveaway_cancel($1::uuid, $2::uuid, '  ')`, [g.id, admin.id])), 'ok')
    const cancelled = await one(`SELECT * FROM giveaway_cancel($1::uuid, $2::uuid, 'Error en las bases')`, [g.id, admin.id])
    check('un sorteo activo se puede cancelar', [cancelled.status, cancelled.cancelled_reason], ['cancelled', 'Error en las bases'])
    check('un sorteo cancelado no vuelve atrás', await failsWith('giveaway_invalid_transition', () =>
      q(`UPDATE giveaways SET status = 'active' WHERE id = $1`, [g.id])), 'ok')
  }
  {
    const g = await newGiveaway()
    await addRequirement(g.id, 1, 'declarative', 1)
    await schedule(g)
    await tick(0)
    await tick(48)
    check('extender exige un motivo', await failsWith('reason_required', () =>
      one(`SELECT giveaway_extend($1::uuid, $2::uuid, now() + interval '1 day', '')`, [g.id, admin.id])), 'ok')
    check('extender a una fecha pasada es rechazado', await failsWith('giveaway_ends_in_past', () =>
      one(`SELECT giveaway_extend($1::uuid, $2::uuid, now() - interval '1 day', 'x')`, [g.id, admin.id])), 'ok')
    const extended = await one(`SELECT * FROM giveaway_extend($1::uuid, $2::uuid, now() + interval '3 days', 'Falla de Instagram')`, [g.id, admin.id])
    check('extender reabre el sorteo y deja registro', [extended.status,
      (await one(`SELECT reason FROM giveaway_audit_logs WHERE giveaway_id = $1 AND action = 'giveaway_extended'`, [g.id])).reason],
      ['active', 'Falla de Instagram'])
  }
  {
    const g = await newGiveaway({ max: 1 })
    const req = await addRequirement(g.id, 1, 'declarative', 1)
    await schedule(g)
    await tick(0)
    const e = await enter(g.id, 1)
    await submitAnswer(e.participant_id, req)
    check('con max_opportunities = 1 no hay 2.ª oportunidad', await failsWith('giveaway_slot_not_allowed', () =>
      q(`INSERT INTO giveaway_entries (giveaway_id, participant_id, slot, ticket_number) VALUES ($1, $2, 2, 50)`, [g.id, e.participant_id])), 'ok')
  }
  {
    // Respuestas de texto y enlace.
    const g = await newGiveaway()
    const rt = await addRequirement(g.id, 1, 'text_answer', 1)
    const rl = await addRequirement(g.id, 1, 'external_link', 2)
    await schedule(g)
    await tick(0)
    const e = await enter(g.id, 1)
    check('una respuesta vacía es rechazada', await failsWith('answer_invalid', () => submitAnswer(e.participant_id, rt, { text: '  ' })), 'ok')
    check('un enlace inválido es rechazado', await failsWith('answer_invalid', () => submitAnswer(e.participant_id, rl, { url: 'javascript:alert(1)' })), 'ok')
    const first = await submitAnswer(e.participant_id, rt, { text: 'Mi respuesta' })
    check('con un requisito pendiente todavía no hay ticket', first.entries_created, 0)
    const second = await submitAnswer(e.participant_id, rl, { url: 'https://instagram.com/p/abc' })
    check('al cumplir todos los requisitos del slot se entrega el ticket', second.entries_created, 1)
    check('subir evidencia a un requisito de texto es rechazado', await failsWith('requirement_kind_mismatch', () => submitEvidence(e.participant_id, rt, 'x')), 'ok')
  }

  // -------------------------------------------------------------------------
  // 10. Auditoría
  // -------------------------------------------------------------------------
  const actions = (await q(`SELECT DISTINCT action FROM giveaway_audit_logs WHERE giveaway_id = $1 ORDER BY action`, [g1.id])).map(r => r.action)
  check('queda registro de todo el ciclo de vida', actions, [
    'draw_completed', 'draw_started', 'evidence_approved', 'evidence_rejected',
    'giveaway_activated', 'giveaway_closing', 'giveaway_frozen', 'giveaway_scheduled',
  ])
  check('la auditoría no se edita', await failsWith('giveaway_audit_immutable', () => q(`UPDATE giveaway_audit_logs SET action = 'x'`)), 'ok')
  check('la auditoría no se borra', await failsWith('giveaway_audit_immutable', () => q('DELETE FROM giveaway_audit_logs')), 'ok')
  check('la auditoría no se vacía', await failsWith('giveaway_audit_immutable', () => q('TRUNCATE giveaway_audit_logs')), 'ok')

  // -------------------------------------------------------------------------
  // 11. Permisos: anon y authenticated no pueden nada
  // -------------------------------------------------------------------------
  for (const role of ['anon', 'authenticated']) {
    check(`${role} no lee la tabla de sorteos`, await failsWith('permission denied', () =>
      asRole(role, () => q('SELECT * FROM giveaways'))), 'ok')
    check(`${role} no lee la semilla secreta`, await failsWith('permission denied', () =>
      asRole(role, () => q('SELECT * FROM giveaway_secrets'))), 'ok')
    check(`${role} no lee los participantes`, await failsWith('permission denied', () =>
      asRole(role, () => q('SELECT * FROM giveaway_participants'))), 'ok')
    check(`${role} no puede llamar al cron`, await failsWith('permission denied', () =>
      asRole(role, () => q('SELECT giveaway_tick()'))), 'ok')
    check(`${role} no puede inscribir`, await failsWith('permission denied', () =>
      asRole(role, () => q(`SELECT giveaway_enter($1::uuid, 'x', 'x', 'x', null, null, null, true, 1, $2, null)`, [g1.id, sha('x')]))), 'ok')
  }
  check('service_role sí puede usar las funciones', (await asRole('service_role', () => q('SELECT giveaway_tick() AS r')))[0].r.activated >= 0, true)
  check('service_role sí lee las tablas', (await asRole('service_role', () => q('SELECT COUNT(*)::int AS n FROM giveaways')))[0].n > 0, true)

  check('todas las tablas de sorteos tienen RLS activado', (await q(`
    SELECT relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND relname LIKE 'giveaway%' AND NOT relrowsecurity`)).length, 0)

  // -------------------------------------------------------------------------
  // 12. Un borrador se puede borrar con todo lo suyo
  // -------------------------------------------------------------------------
  {
    const g = await newGiveaway()
    await addRequirement(g.id, 1, 'declarative', 1)
    await q('DELETE FROM giveaways WHERE id = $1', [g.id])
    check('un borrador se borra junto con sus requisitos', (await one('SELECT COUNT(*)::int AS n FROM giveaway_requirements WHERE giveaway_id = $1', [g.id])).n, 0)
  }

  if (failures > 0) {
    console.log(`\n${failures} caso(s) fallaron`)
    process.exitCode = 1
  } else {
    console.log('\nTodos los casos pasaron')
  }

  await db.close()
}

main().catch(error => {
  console.error('ERROR en el test:', error)
  process.exit(1)
})
