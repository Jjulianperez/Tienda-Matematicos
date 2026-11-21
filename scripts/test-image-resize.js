// Test de la reducción de fotos antes de subirlas.
// Ejecutar: npm run test:image-resize
//
// El tamaño final se calcula con una función pura (fitWithin). La parte que
// usa el canvas se prueba con un navegador falso que cuenta lo que se dibuja.

const { loadLibModule } = require('./_load-lib')

const resize = loadLibModule('image-resize.js', ['MAX_SIDE', 'fitWithin', 'prepareImageForUpload'])

let failures = 0

function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) failures++
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}${ok ? '' : ` -> esperado ${JSON.stringify(expected)}, obtenido ${JSON.stringify(actual)}`}`)
}

// ---------------------------------------------------------------------------
// Cálculo del tamaño
// ---------------------------------------------------------------------------

check('el lado mayor por defecto es 1600', resize.MAX_SIDE, 1600)
check('una foto horizontal de cámara se reduce a 1600 de ancho', resize.fitWithin(4032, 3024), { width: 1600, height: 1200, scaled: true })
check('una foto vertical se reduce a 1600 de alto', resize.fitWithin(3024, 4032), { width: 1200, height: 1600, scaled: true })
check('una imagen cuadrada grande', resize.fitWithin(5000, 5000), { width: 1600, height: 1600, scaled: true })
check('una imagen que ya entra no se toca', resize.fitWithin(1200, 800), { width: 1200, height: 800, scaled: false })
check('justo en el límite no se reduce', resize.fitWithin(1600, 900), { width: 1600, height: 900, scaled: false })
check('nunca se agranda una imagen chica', resize.fitWithin(100, 50), { width: 100, height: 50, scaled: false })
check('se puede pedir otro límite', resize.fitWithin(4000, 2000, 1000), { width: 1000, height: 500, scaled: true })
check('una imagen muy alargada no queda en cero', resize.fitWithin(20000, 10), { width: 1600, height: 1, scaled: true })
check('sin dimensiones no se rompe', resize.fitWithin(0, 0), { width: 0, height: 0, scaled: false })

const ratios = []
for (const [w, h] of [[4032, 3024], [3000, 2000], [5472, 3648], [1920, 1080], [6000, 4000]]) {
  const r = resize.fitWithin(w, h)
  ratios.push(Math.abs(r.width / r.height - w / h) < 0.01)
}
check('la proporción se mantiene (hasta el redondeo)', ratios.every(Boolean), true)

// ---------------------------------------------------------------------------
// prepareImageForUpload, con un navegador falso
// ---------------------------------------------------------------------------

class FakeFile {
  constructor(parts, name, options = {}) {
    this.parts = parts
    this.name = name
    this.type = options.type || ''
    this.size = parts.reduce((total, part) => total + (part.size ?? part.length ?? 0), 0)
  }
}

function install({ width, height, outputBytes, failDecode = false, noContext = false }) {
  const log = { drawn: null, fills: 0, closed: 0, encoded: null }
  globalThis.File = FakeFile
  globalThis.createImageBitmap = async () => {
    if (failDecode) throw new Error('no se puede decodificar')
    return { width, height, close() { log.closed++ } }
  }
  globalThis.document = {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => (noContext ? null : {
        fillRect() { log.fills++ },
        drawImage(source, x, y, w, h) { log.drawn = [w, h] },
        set fillStyle(value) {},
      }),
      toBlob(callback, type, quality) {
        log.encoded = { type, quality }
        callback({ size: outputBytes, type })
      },
    }),
  }
  return log
}

function cleanup() {
  delete globalThis.File
  delete globalThis.createImageBitmap
  delete globalThis.document
}

async function main() {
  {
    // Foto de cámara: 4032x3024 y 5 MB.
    const log = install({ width: 4032, height: 3024, outputBytes: 420_000 })
    const photo = new FakeFile([{ size: 5_000_000 }], 'IMG_2041.HEIC.jpeg', { type: 'image/jpeg' })
    const out = await resize.prepareImageForUpload(photo)
    check('una foto de 5 MB se reduce a 1600x1200', log.drawn, [1600, 1200])
    check('sale como JPEG con calidad 0.85', log.encoded, { type: 'image/jpeg', quality: 0.85 })
    check('el resultado pesa menos que el original', out.size < photo.size, true)
    check('el nombre queda con .jpg', out.name, 'IMG_2041.HEIC.jpg')
    check('se pinta fondo blanco antes (el JPEG no tiene transparencia)', log.fills, 1)
    check('se libera la imagen decodificada', log.closed, 1)
    cleanup()
  }

  {
    // Imagen chica y liviana: se sube tal cual.
    const log = install({ width: 800, height: 600, outputBytes: 100_000 })
    const small = new FakeFile([{ size: 200_000 }], 'producto.png', { type: 'image/png' })
    const out = await resize.prepareImageForUpload(small)
    check('una imagen chica y liviana no se toca', [out === small, log.drawn], [true, null])
    cleanup()
  }

  {
    // Entra en 1600 px pero pesa mucho: se vuelve a comprimir.
    const log = install({ width: 1500, height: 1000, outputBytes: 300_000 })
    const heavy = new FakeFile([{ size: 3_000_000 }], 'captura.png', { type: 'image/png' })
    const out = await resize.prepareImageForUpload(heavy)
    check('una imagen pesada que ya entra se comprime sin cambiar su tamaño', [log.drawn, out.type], [[1500, 1000], 'image/jpeg'])
    cleanup()
  }

  {
    // Si comprimir no ayuda, se queda con el original.
    install({ width: 3000, height: 2000, outputBytes: 900_000 })
    const light = new FakeFile([{ size: 800_000 }], 'foto.jpg', { type: 'image/jpeg' })
    const out = await resize.prepareImageForUpload(light)
    check('nunca devuelve algo más pesado que el original', out === light, true)
    cleanup()
  }

  {
    install({ width: 4000, height: 3000, outputBytes: 400_000 })
    const gif = new FakeFile([{ size: 6_000_000 }], 'animado.gif', { type: 'image/gif' })
    const svg = new FakeFile([{ size: 6_000_000 }], 'logo.svg', { type: 'image/svg+xml' })
    const pdf = new FakeFile([{ size: 6_000_000 }], 'archivo.pdf', { type: 'application/pdf' })
    const outs = await Promise.all([gif, svg, pdf].map(file => resize.prepareImageForUpload(file)))
    check('GIF, SVG y archivos que no son fotos se suben sin tocar', outs.map((out, i) => out === [gif, svg, pdf][i]), [true, true, true])
    cleanup()
  }

  {
    install({ width: 4000, height: 3000, outputBytes: 400_000, failDecode: true })
    // Sin createImageBitmap y sin Image, la lectura falla: devuelve el original.
    globalThis.URL = { createObjectURL: () => 'blob:x', revokeObjectURL() {} }
    globalThis.Image = class { set src(value) { setTimeout(() => this.onerror?.(), 0) } }
    const photo = new FakeFile([{ size: 5_000_000 }], 'rota.jpg', { type: 'image/jpeg' })
    const out = await resize.prepareImageForUpload(photo)
    check('si no se puede leer la imagen, se devuelve el original', out === photo, true)
    delete globalThis.Image
    cleanup()
  }

  {
    install({ width: 4000, height: 3000, outputBytes: 400_000, noContext: true })
    const photo = new FakeFile([{ size: 5_000_000 }], 'foto.jpg', { type: 'image/jpeg' })
    const out = await resize.prepareImageForUpload(photo)
    check('sin canvas disponible, se devuelve el original', out === photo, true)
    cleanup()
  }

  if (failures > 0) {
    console.log(`\n${failures} caso(s) fallaron`)
    process.exitCode = 1
  } else {
    console.log('\nTodos los casos pasaron')
  }
}

main().catch(error => {
  console.error('ERROR en el test:', error)
  process.exit(1)
})
