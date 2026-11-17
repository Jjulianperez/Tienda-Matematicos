// Test de la validación de JWT_SECRET (H11).
// Ejecutar: npm run test:jwt-secret

const { loadLibModule } = require('./_load-lib')

const { readJwtSecret, MIN_JWT_SECRET_LENGTH } = loadLibModule('jwt-secret.js', [
  'readJwtSecret',
  'MIN_JWT_SECRET_LENGTH',
])

let failures = 0

function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) failures++
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}${ok ? '' : ` -> esperado ${JSON.stringify(expected)}, obtenido ${JSON.stringify(actual)}`}`)
}

function throws(fn) {
  try {
    fn()
    return false
  } catch {
    return true
  }
}

const strong = 'x'.repeat(MIN_JWT_SECRET_LENGTH)

check('acepta un secreto de al menos 32 caracteres', readJwtSecret(strong), strong)
check('rechaza secreto ausente (undefined)', throws(() => readJwtSecret(undefined)), true)
check('rechaza secreto vacío', throws(() => readJwtSecret('')), true)
check('rechaza secreto corto', throws(() => readJwtSecret('secreto')), true)
check(
  'rechaza secreto de 31 caracteres (el límite es 32)',
  throws(() => readJwtSecret('x'.repeat(MIN_JWT_SECRET_LENGTH - 1))),
  true
)
check('rechaza valor que no es texto', throws(() => readJwtSecret(12345678901234567890123456789012)), true)

if (failures > 0) {
  console.log(`\n${failures} caso(s) fallaron`)
  process.exitCode = 1
} else {
  console.log('\nTodos los casos pasaron')
}
