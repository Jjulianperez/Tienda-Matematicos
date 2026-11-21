// Test de la capa de servidor de sorteos: errores, validación, evidencias y tokens.
// Ejecutar: npm run test:giveaway-server
//
// Son funciones puras; no toca la base ni la red.

const nodeCrypto = require('node:crypto')
const { loadLibModule } = require('./_load-lib')

const errors = loadLibModule('giveaways/errors.js', ['mapDbError', 'extractErrorCode'])
const validation = loadLibModule('giveaways/validation.js', [
  'slugify',
  'isUuid',
  'validateGiveawayInput',
  'validateRequirementInput',
  'validateEntryInput',
  'validateAnswerInput',
  'validateReviewInput',
])
const evidence = loadLibModule('giveaways/evidence.js', [
  'MAX_EVIDENCE_BYTES',
  'detectEvidenceType',
  'validateEvidenceFile',
  'evidenceStoragePath',
])
const tokens = loadLibModule('giveaways/tokens.js', ['deriveAccessToken', 'isValidAccessToken'])
const { requirementStates } = loadLibModule('giveaways/participation.js', ['requirementStates'])
const stage = loadLibModule('giveaways/stage.js', [
  'wheelSegmentCount',
  'segmentOfTicket',
  'segmentRange',
  'wheelTargetRotation',
  'angleUnderPointer',
  'numberBlock',
  'spinDurationMs',
  'rollDelays',
])

let failures = 0

function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) failures++
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}${ok ? '' : ` -> esperado ${JSON.stringify(expected)}, obtenido ${JSON.stringify(actual)}`}`)
}

const UUID = '3f2b8c1e-6a4d-4e0b-9c75-1d2e3f4a5b6c'

async function main() {
  // -------------------------------------------------------------------------
  // Errores de la base
  // -------------------------------------------------------------------------
  const map = message => errors.mapDbError({ message })
  check('código simple', map('giveaway_not_active'), { status: 409, error: 'El sorteo no está recibiendo participaciones en este momento', code: 'giveaway_not_active' })
  check('código de trigger con explicación', map('giveaway_phase_locked: los requisitos solo se editan en borrador').code, 'giveaway_phase_locked')
  check('no encontrado es 404', map('giveaway_not_found').status, 404)
  check('el teléfono repetido es 409', map('giveaway_phone_taken').status, 409)
  check('un error desconocido no filtra el texto interno', map('relation "x" does not exist'), { status: 500, error: 'Error del servidor', code: 'unknown' })
  check('sin error es un error del servidor', errors.mapDbError(null).status, 500)
  check(
    'enlace repetido se reconoce por la restricción',
    errors.mapDbError({ code: '23505', message: 'duplicate key value violates unique constraint "giveaways_slug_key"' }).code,
    'giveaway_slug_taken'
  )
  check('extrae el código', [errors.extractErrorCode('abc_def: texto'), errors.extractErrorCode('Mensaje con Mayúscula')], ['abc_def', null])

  // -------------------------------------------------------------------------
  // Enlaces (slug)
  // -------------------------------------------------------------------------
  check('slug quita acentos y símbolos', validation.slugify('¡Gran Sorteo de Verano! 2026'), 'gran-sorteo-de-verano-2026')
  check('slug de texto vacío', validation.slugify('   '), '')
  check('slug se corta en 80 sin guion final', validation.slugify('a'.repeat(79) + ' b').endsWith('-'), false)

  // -------------------------------------------------------------------------
  // Alta de sorteo
  // -------------------------------------------------------------------------
  const valid = {
    title: 'Sorteo de verano',
    prize_name: 'Kit matero',
    starts_at: '2026-12-01T12:00:00Z',
    ends_at: '2026-12-10T12:00:00Z',
    terms_text: 'Bases',
  }
  {
    const r = validation.validateGiveawayInput(valid)
    check('un sorteo válido pasa', r.ok, true)
    check('el enlace sale del título', r.value.slug, 'sorteo-de-verano')
    check('los valores por defecto', [r.value.format, r.value.winners_count, r.value.alternates_count, r.value.max_opportunities], ['ruleta', 1, 0, 2])
    check('las fechas se normalizan a ISO', r.value.starts_at, '2026-12-01T12:00:00.000Z')
  }
  check('falta el título', validation.validateGiveawayInput({ ...valid, title: '' }).errors.title, 'Este campo es obligatorio')
  check('título muy corto', Boolean(validation.validateGiveawayInput({ ...valid, title: 'ab' }).errors.title), true)
  check('el cierre debe ser posterior al inicio', validation.validateGiveawayInput({ ...valid, ends_at: '2026-11-30T12:00:00Z' }).errors.ends_at, 'El cierre tiene que ser posterior al inicio')
  check('fecha inválida', validation.validateGiveawayInput({ ...valid, starts_at: 'ayer' }).errors.starts_at, 'La fecha no es válida')
  check('formato inválido', Boolean(validation.validateGiveawayInput({ ...valid, format: 'bingo' }).errors.format), true)
  check('ganadores fuera de rango', Boolean(validation.validateGiveawayInput({ ...valid, winners_count: 0 }).errors.winners_count), true)
  check('más de 2 oportunidades no existe', Boolean(validation.validateGiveawayInput({ ...valid, max_opportunities: 3 }).errors.max_opportunities), true)
  check('imagen del premio solo https', Boolean(validation.validateGiveawayInput({ ...valid, prize_image_url: 'http://x.com/a.png' }).errors.prize_image_url), true)
  check('enlace con mayúsculas es rechazado', Boolean(validation.validateGiveawayInput({ ...valid, slug: 'Mi Sorteo' }).errors.slug), true)
  check('producto inválido', Boolean(validation.validateGiveawayInput({ ...valid, product_id: 'no-es-uuid' }).errors.product_id), true)
  check('producto válido', validation.validateGiveawayInput({ ...valid, product_id: UUID }).value.product_id, UUID)

  {
    const r = validation.validateGiveawayInput({ title: 'Nuevo título' }, { partial: true })
    check('en una edición parcial solo se validan los campos enviados', [r.ok, Object.keys(r.value)], [true, ['title']])
    check('una edición parcial igual rechaza lo inválido', validation.validateGiveawayInput({ winners_count: 500 }, { partial: true }).ok, false)
  }

  // -------------------------------------------------------------------------
  // Requisitos
  // -------------------------------------------------------------------------
  check('requisito válido', validation.validateRequirementInput({ slot: 1, kind: 'evidence_upload', title: 'Seguir la cuenta' }).ok, true)
  check('tipo de requisito inválido', Boolean(validation.validateRequirementInput({ slot: 1, kind: 'otro', title: 'Seguir' }).errors.kind), true)
  check('slot 3 inválido', Boolean(validation.validateRequirementInput({ slot: 3, kind: 'declarative', title: 'Seguir' }).errors.slot), true)

  // -------------------------------------------------------------------------
  // Inscripción pública
  // -------------------------------------------------------------------------
  const entry = {
    full_name: 'Ana Pérez',
    phone: '2657 58-3046',
    email: 'Ana@Ejemplo.com',
    ig_handle: '@Ana.Perez',
    accept_terms: true,
    marketing_consent: true,
    terms_version: 1,
    idempotency_key: 'a'.repeat(32),
  }
  {
    const r = validation.validateEntryInput(entry)
    check('una inscripción válida pasa', r.ok, true)
    check('el Instagram se normaliza', r.value.ig_handle_normalized, 'ana.perez')
    check('el email queda en minúsculas', r.value.email, 'ana@ejemplo.com')
    check('el teléfono se normaliza', typeof r.value.phone_normalized, 'string')
    check('el consentimiento de marketing es opcional y explícito', validation.validateEntryInput({ ...entry, marketing_consent: undefined }).value.marketing_consent, false)
  }
  check('sin aceptar las bases no pasa', validation.validateEntryInput({ ...entry, accept_terms: false }).errors.accept_terms, 'Tenés que aceptar las bases y condiciones')
  check('teléfono inválido', Boolean(validation.validateEntryInput({ ...entry, phone: '12' }).errors.phone_normalized), true)
  check('Instagram inválido', Boolean(validation.validateEntryInput({ ...entry, ig_handle: 'no valido!' }).errors.ig_handle_normalized), true)
  check('email inválido', Boolean(validation.validateEntryInput({ ...entry, email: 'xx' }).errors.email), true)
  check('el email es opcional', validation.validateEntryInput({ ...entry, email: '' }).ok, true)
  check('clave de idempotencia muy corta', Boolean(validation.validateEntryInput({ ...entry, idempotency_key: 'abc' }).errors.idempotency_key), true)

  // -------------------------------------------------------------------------
  // Respuestas y revisiones
  // -------------------------------------------------------------------------
  check('respuesta válida', validation.validateAnswerInput({ requirement_id: UUID, payload: { text: 'hola' } }).ok, true)
  check('respuesta sin requisito válido', validation.validateAnswerInput({ requirement_id: 'x' }).ok, false)
  check('aprobar sin motivo', validation.validateReviewInput({ decision: 'approved' }).ok, true)
  check('rechazar sin motivo no pasa', validation.validateReviewInput({ decision: 'rejected' }).errors.reason, 'Escribí el motivo del rechazo')
  check('rechazar con motivo', validation.validateReviewInput({ decision: 'rejected', reason: 'No se ve' }).ok, true)
  check('decisión desconocida', validation.validateReviewInput({ decision: 'quizás' }).ok, false)

  // -------------------------------------------------------------------------
  // Capturas
  // -------------------------------------------------------------------------
  const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0, 0, 0, 0])
  const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
  const HTML = new TextEncoder().encode('<!DOCTYPE html><html>')
  check('detecta PNG y JPEG', [evidence.detectEvidenceType(PNG), evidence.detectEvidenceType(JPEG)], ['image/png', 'image/jpeg'])
  check('rechaza HTML', evidence.detectEvidenceType(HTML), null)
  check('una captura válida', evidence.validateEvidenceFile({ size: 300000, head: PNG }), { ok: true, mime: 'image/png' })
  check('más de 4 MB es 413', evidence.validateEvidenceFile({ size: evidence.MAX_EVIDENCE_BYTES + 1, head: PNG }).status, 413)
  check('vacía es 400', evidence.validateEvidenceFile({ size: 0, head: PNG }).status, 400)
  check('un archivo que no es imagen es 400', evidence.validateEvidenceFile({ size: 100, head: HTML }).status, 400)
  check(
    'la ruta de almacenamiento lleva sorteo, participante y hash',
    evidence.evidenceStoragePath({ giveawayId: 'g', participantId: 'p', sha256: 'abc', mime: 'image/webp' }),
    'g/p/abc.webp'
  )

  // -------------------------------------------------------------------------
  // Token derivado de la clave de idempotencia
  // -------------------------------------------------------------------------
  const secret = 's'.repeat(40)
  const key = 'k'.repeat(32)
  const token = await tokens.deriveAccessToken(secret, UUID, key)
  check('el token derivado es válido', tokens.isValidAccessToken(token), true)
  check('es determinista: el reintento recibe el mismo token', await tokens.deriveAccessToken(secret, UUID, key), token)
  check('otra clave da otro token', (await tokens.deriveAccessToken(secret, UUID, 'j'.repeat(32))) === token, false)
  check('otro sorteo da otro token', (await tokens.deriveAccessToken(secret, '11111111-1111-4111-8111-111111111111', key)) === token, false)
  check('otro secreto da otro token', (await tokens.deriveAccessToken('t'.repeat(40), UUID, key)) === token, false)
  check(
    'coincide con HMAC-SHA256 de node:crypto',
    token,
    nodeCrypto.createHmac('sha256', secret).update(`giveaway-access-token|${UUID}|${key}`).digest('hex')
  )
  let weak = false
  try {
    await tokens.deriveAccessToken('corto', UUID, key)
  } catch {
    weak = true
  }
  check('un secreto corto es rechazado', weak, true)

  // -------------------------------------------------------------------------
  // Estado de los requisitos de un participante
  // -------------------------------------------------------------------------
  {
    const requirements = [
      { id: 'a', position: 1, slot: 1, kind: 'evidence_upload', title: 'Seguir', instructions: null },
      { id: 'b', position: 2, slot: 1, kind: 'declarative', title: 'Compartir' },
      { id: 'c', position: 3, slot: 2, kind: 'evidence_upload', title: 'Historia' },
      { id: 'd', position: 4, slot: 2, kind: 'text_answer', title: 'Respuesta' },
    ]
    const states = (evidenceRows, submissionRows) =>
      requirementStates(requirements, evidenceRows, submissionRows).map(r => r.state)

    check('sin nada hecho, todo falta', states([], []), ['missing', 'missing', 'missing', 'missing'])
    check(
      'una captura sin revisar está pendiente; una respuesta está enviada',
      states([{ requirement_id: 'a', attempt_no: 1, status: 'pending' }], [{ requirement_id: 'b' }]),
      ['pending_review', 'submitted', 'missing', 'missing']
    )
    check(
      'una aprobada figura aprobada',
      states([{ requirement_id: 'a', attempt_no: 1, status: 'approved' }], []).slice(0, 1),
      ['approved']
    )

    // Rechazada y vuelta a enviar: solo cuenta el último intento.
    const retry = [
      { requirement_id: 'a', attempt_no: 1, status: 'rejected', rejection_reason: 'No se ve' },
      { requirement_id: 'a', attempt_no: 2, status: 'pending' },
    ]
    check('solo cuenta el último intento', states(retry, []).slice(0, 1), ['pending_review'])

    const rejected = requirementStates(
      requirements,
      [{ requirement_id: 'a', attempt_no: 1, status: 'rejected', rejection_reason: 'No se ve' }],
      []
    )[0]
    check('un rechazo trae su motivo', [rejected.state, rejected.rejection_reason], ['rejected', 'No se ve'])
    check('la respuesta de otro requisito no se confunde', states([], [{ requirement_id: 'd' }]), ['missing', 'missing', 'missing', 'submitted'])
    check('una lista vacía no rompe', requirementStates(undefined, undefined, undefined), [])
  }

  // -------------------------------------------------------------------------
  // Animaciones: la presentación termina exactamente en el ticket ganador
  // -------------------------------------------------------------------------
  {
    check('pocos tickets: un segmento por ticket', [stage.wheelSegmentCount(1), stage.wheelSegmentCount(7)], [1, 7])
    check('muchos tickets: 36 segmentos como máximo', [stage.wheelSegmentCount(500), stage.wheelSegmentCount(50000)], [36, 36])

    // Para varias combinaciones: cada ticket cae en un segmento, y el rango de
    // ese segmento lo contiene; los rangos cubren todos los tickets sin huecos.
    let outOfRange = 0
    let gaps = 0
    for (const total of [1, 2, 5, 10, 36, 37, 100, 1000, 12345]) {
      const segments = stage.wheelSegmentCount(total)
      let expectedStart = 1
      for (let i = 0; i < segments; i++) {
        const range = stage.segmentRange(i, total, segments)
        if (range.start !== expectedStart || range.end < range.start) gaps++
        expectedStart = range.end + 1
      }
      if (expectedStart !== total + 1) gaps++

      for (let ticket = 1; ticket <= total; ticket += Math.max(1, Math.floor(total / 200))) {
        const index = stage.segmentOfTicket(ticket, total, segments)
        const range = stage.segmentRange(index, total, segments)
        if (index < 0 || index >= segments || ticket < range.start || ticket > range.end) outOfRange++
      }
      // Los extremos siempre caen dentro.
      for (const ticket of [1, total]) {
        const index = stage.segmentOfTicket(ticket, total, segments)
        const range = stage.segmentRange(index, total, segments)
        if (ticket < range.start || ticket > range.end) outOfRange++
      }
    }
    check('los rangos de la ruleta cubren todos los tickets sin huecos', gaps, 0)
    check('cada ticket cae en el segmento cuyo rango lo contiene', outOfRange, 0)

    // La flecha termina dentro del segmento del ganador.
    let missed = 0
    for (const [ticket, total] of [[1, 10], [10, 10], [7, 100], [250, 1000], [12345, 12345], [3, 3]]) {
      const segments = stage.wheelSegmentCount(total)
      const index = stage.segmentOfTicket(ticket, total, segments)
      const arc = 360 / segments
      const angle = stage.angleUnderPointer(stage.wheelTargetRotation(index, segments, ticket))
      if (angle < index * arc || angle > (index + 1) * arc) missed++
    }
    check('la aguja de la ruleta frena sobre el segmento ganador', missed, 0)
    check('la ruleta da vueltas completas antes de frenar', stage.wheelTargetRotation(0, 10, 1, 5) > 360 * 4, true)

    check('bloque de números del ticket 1', stage.numberBlock(1, 5000), { start: 1, end: 100, count: 100, offset: 0 })
    check('bloque del ticket 250', stage.numberBlock(250, 5000), { start: 201, end: 300, count: 100, offset: 49 })
    check('último bloque incompleto', stage.numberBlock(1234, 1234), { start: 1201, end: 1234, count: 34, offset: 33 })
    check('con menos de 100 tickets hay un solo bloque', stage.numberBlock(3, 7), { start: 1, end: 7, count: 7, offset: 2 })

    check('pocos ganadores: 6,5 s cada uno', [stage.spinDurationMs(1), stage.spinDurationMs(3)], [6500, 6500])
    check('muchos ganadores: más corto', stage.spinDurationMs(10), 3500)

    const delays = stage.rollDelays(6500)
    check('las pausas suman la duración pedida', Math.round(delays.reduce((a, b) => a + b, 0)), 6500)
    check('el número frena de a poco (pausas crecientes)', delays.every((d, i) => i === 0 || d >= delays[i - 1]), true)
  }

  if (failures > 0) {
    console.log(`\n${failures} caso(s) fallaron`)
    process.exitCode = 1
  } else {
    console.log('\nTodos los casos pasaron')
  }
}

main()
