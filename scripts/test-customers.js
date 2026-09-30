// Test del normalizador de clientes.
// Ejecutar: npm run test:customers
//
// Usa el mismo puente que los scripts de backfill, así que prueba el
// lib/customers.js real y no una copia.

const { loadLibModule } = require('./_load-lib')

const {
  normalizePhone,
  formatPhoneDisplay,
  sanitizeSearchTerm,
  normalizeTags,
  PURCHASE_STATUSES,
} = loadLibModule('customers.js', [
  'normalizePhone',
  'formatPhoneDisplay',
  'sanitizeSearchTerm',
  'normalizeTags',
  'PURCHASE_STATUSES',
])

let fails = 0
// JSON.stringify(undefined) devuelve undefined (no un string), por eso el
// String() explícito: acá hay casos con undefined y null.
const show = value => String(JSON.stringify(value))
const pad = (value, size) => String(value).padEnd(size)

const check = (ok, label, got, expected) => {
  if (!ok) fails++
  const suffix = ok ? '' : `  (esperado ${show(expected)})`
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${pad(label, 24)} -> ${show(got)}${suffix}`)
}

console.log('--- Mismo numero, distintos formatos (deben coincidir) ---')
const SAME = '541155554444'
for (const input of [
  '+54 9 11 5555-4444',
  '+54 11 5555-4444',
  '5491155554444',
  '541155554444',
  '0054 9 11 5555 4444',
  '011 15 5555-4444',
  '011 5555-4444',
  '(011) 15 5555-4444',
  '11 5555-4444',
  '11 55554444',
]) {
  const got = normalizePhone(input)
  check(got === SAME, input, got, SAME)
}

console.log('\n--- Numeros que deben quedar distintos ---')
for (const [input, expected] of [
  ['+54 9 11 5555-4444', '541155554444'],
  ['+54 9 11 5555-5555', '541155555555'],
  ['351 123-4567', '543511234567'],
  ['+54 351 123-4567', '543511234567'],
  ['+54 9 351 123-4567', '543511234567'],
]) {
  const got = normalizePhone(input)
  check(got === expected, input, got, expected)
}

console.log('\n--- Bordes: cadena vacia ---')
for (const bad of ['', null, undefined, 'abc', 'sin numeros', '   ']) {
  const got = normalizePhone(bad)
  check(got === '', JSON.stringify(bad), got, '')
}

console.log('\n--- No debe romperse con inputs raros ---')
for (const weird of ['123', '+1 202 555 0143', '9', '0000000000000', '5491155554444555']) {
  console.log(`      ${JSON.stringify(weird).padEnd(22)} -> ${JSON.stringify(normalizePhone(weird))}`)
}

console.log('\n--- formatPhoneDisplay ---')
for (const [input, expected] of [
  // Área de 2 dígitos (CABA / Buenos Aires): el caso mayoritario
  ['+54 9 11 5555-4444', '+54 11 5555-4444'],
  ['011 15 5555-4444', '+54 11 5555-4444'],
  ['(011) 5555-4444', '+54 11 5555-4444'],
  ['11 5555-4444', '+54 11 5555-4444'],
  // Áreas de 3 dígitos
  ['0351 123-4567', '+54 351 123-4567'],
  ['+54 9 351 123-4567', '+54 351 123-4567'],
  ['0054 9 351 1234567', '+54 351 123-4567'],
  ['+54 299 123-4567', '+54 299 123-4567'],
  ['0223 123-4567', '+54 223 123-4567'],
  ['+54 9 223 123-4567', '+54 223 123-4567'],
  ['351 555-4444', '+54 351 555-4444'],
  ['0341 123-4567', '+54 341 123-4567'],
]) {
  const got = formatPhoneDisplay(input)
  check(got === expected, input, got, expected)
}

// Si formatear no fuera idempotente, el fallback de phone_display en la API
// mostraría cosas distintas cada vez que se guarda y se relee.
console.log('\n--- formatPhoneDisplay es idempotente ---')
for (const input of [
  '+54 9 11 5555-4444', '011 15 5555-4444',
  '351 123-4567', '0223 123-4567', '299 123-4567',
]) {
  const once = formatPhoneDisplay(input)
  const twice = formatPhoneDisplay(once)
  check(once === twice, input, twice, once)
}

// El ciclo completo tiene que volver a la misma clave: mostrar, y volver a
// leer lo mostrado, no puede generar un cliente duplicado.
console.log('\n--- ida y vuelta: formatear y renormalizar ---')
for (const input of [
  '+54 9 11 5555-4444', '011 15 5555-4444',
  '351 123-4567', '0223 123-4567', '299 123-4567',
]) {
  const key = normalizePhone(input)
  const roundTrip = normalizePhone(formatPhoneDisplay(input))
  check(roundTrip === key, input, roundTrip, key)
}

console.log('\n--- sanitizeSearchTerm (wildcards de Postgres) ---')
for (const [input, expected] of [
  ['100%', '100\\%'],
  ['a_b', 'a\\_b'],
  ['back\\slash', 'back\\\\slash'],
]) {
  const got = sanitizeSearchTerm(input)
  check(got === expected, JSON.stringify(input), got, expected)
}

console.log('\n--- normalizeTags ---')
for (const [input, expected] of [
  [['Mayorista', ' mayOrista ', 'VIP', '', 123, null], ['mayorista', 'vip']],
  [['   '], []],
  [['a', 'a', 'a'], ['a']],
  ['no es un array', []],
]) {
  const got = normalizeTags(input)
  check(JSON.stringify(got) === JSON.stringify(expected), JSON.stringify(input), got, expected)
}

console.log('\n--- PURCHASE_STATUSES ---')
console.log('      ' + JSON.stringify(PURCHASE_STATUSES))
check(!PURCHASE_STATUSES.includes('pending'), 'pending NO cuenta como compra', PURCHASE_STATUSES.includes('pending'), false)
check(!PURCHASE_STATUSES.includes('cancelled'), 'cancelled NO cuenta como compra', PURCHASE_STATUSES.includes('cancelled'), false)
check(PURCHASE_STATUSES.includes('confirmed'), 'confirmed cuenta como compra', PURCHASE_STATUSES.includes('confirmed'), true)

console.log('\n' + '='.repeat(50))
console.log(fails === 0 ? 'TODOS LOS CASOS OK' : `${fails} FALLA(S)`)
process.exit(fails === 0 ? 0 : 1)
