// Test de la validación de imágenes subidas (H10).
// Ejecutar: npm run test:upload-validation
//
// Solo usa bytes armados a mano: no sube nada a Cloudinary.

const { loadLibModule } = require('./_load-lib')

const { detectImageType, validateImageUpload, MAX_IMAGE_BYTES } = loadLibModule(
  'upload-validation.js',
  ['detectImageType', 'validateImageUpload', 'MAX_IMAGE_BYTES']
)

let failures = 0

function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) failures++
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}${ok ? '' : ` -> esperado ${JSON.stringify(expected)}, obtenido ${JSON.stringify(actual)}`}`)
}

const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 0x01, 0, 0, 0, 0]
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52]
const WEBP = [...Buffer.from('RIFF'), 0x24, 0, 0, 0, ...Buffer.from('WEBP'), ...Buffer.from('VP8 ')]
const HTML = [...Buffer.from('<!DOCTYPE html><html>', 'utf8')]
const SVG = [...Buffer.from('<svg xmlns="http://www.w3.org/2000/svg">', 'utf8')]
const EXE = [0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0xff, 0xff]

check('reconoce JPEG por su firma', detectImageType(new Uint8Array(JPEG)), 'image/jpeg')
check('reconoce PNG por su firma', detectImageType(new Uint8Array(PNG)), 'image/png')
check('reconoce WebP por su firma', detectImageType(new Uint8Array(WEBP)), 'image/webp')
check('rechaza HTML aunque el nombre diga .jpg', detectImageType(new Uint8Array(HTML)), null)
check('rechaza SVG (puede llevar script)', detectImageType(new Uint8Array(SVG)), null)
check('rechaza ejecutables (MZ)', detectImageType(new Uint8Array(EXE)), null)
check('rechaza bytes insuficientes', detectImageType(new Uint8Array([0xff, 0xd8])), null)

check(
  'acepta imagen válida de tamaño normal',
  validateImageUpload({ size: 200_000, head: new Uint8Array(PNG) }),
  { ok: true, type: 'image/png' }
)

const tooBig = validateImageUpload({ size: MAX_IMAGE_BYTES + 1, head: new Uint8Array(PNG) })
check('rechaza más de 5 MB con 413', [tooBig.ok, tooBig.status], [false, 413])

const empty = validateImageUpload({ size: 0, head: new Uint8Array(PNG) })
check('rechaza archivo vacío', [empty.ok, empty.status], [false, 400])

const notImage = validateImageUpload({ size: 1000, head: new Uint8Array(HTML) })
check('rechaza contenido que no es imagen', [notImage.ok, notImage.status], [false, 400])

check('el límite es exactamente 5 MB', MAX_IMAGE_BYTES, 5 * 1024 * 1024)

if (failures > 0) {
  console.log(`\n${failures} caso(s) fallaron`)
  process.exitCode = 1
} else {
  console.log('\nTodos los casos pasaron')
}
