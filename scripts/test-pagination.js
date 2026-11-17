// Test de la lectura paginada de Supabase (H6).
// Ejecutar: npm run test:pagination
//
// Simula un constructor de consultas con .range(), sin tocar la base.

const { loadLibModule } = require('./_load-lib')

const { fetchAll } = loadLibModule('supabase-pagination.js', ['fetchAll'])

let failures = 0

async function check(label, run) {
  try {
    const { actual, expected } = await run()
    const ok = JSON.stringify(actual) === JSON.stringify(expected)
    if (!ok) failures++
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}${ok ? '' : ` -> esperado ${JSON.stringify(expected)}, obtenido ${JSON.stringify(actual)}`}`)
  } catch (error) {
    failures++
    console.log(`FAIL ${label} -> excepción: ${error.message}`)
  }
}

// Base falsa de `total` filas, que responde a .range(from, to) como PostgREST.
function fakeTable(total, { failAt = null } = {}) {
  const rows = Array.from({ length: total }, (_, i) => ({ id: i + 1 }))
  const calls = []
  const builder = () => ({
    range(from, to) {
      calls.push([from, to])
      if (failAt !== null && from === failAt) {
        return Promise.resolve({ data: null, error: new Error('boom') })
      }
      return Promise.resolve({ data: rows.slice(from, to + 1), error: null })
    },
  })
  return { builder, calls }
}

async function main() {
  await check('tabla vacía devuelve lista vacía en una sola llamada', async () => {
    const { builder, calls } = fakeTable(0)
    const rows = await fetchAll(builder, 1000)
    return { actual: { n: rows.length, calls }, expected: { n: 0, calls: [[0, 999]] } }
  })

  await check('menos de una página: una sola llamada', async () => {
    const { builder, calls } = fakeTable(250)
    const rows = await fetchAll(builder, 1000)
    return { actual: { n: rows.length, calls: calls.length }, expected: { n: 250, calls: 1 } }
  })

  await check('2250 filas: trae todas, sin repetir ni saltear', async () => {
    const { builder } = fakeTable(2250)
    const rows = await fetchAll(builder, 1000)
    const ids = rows.map(r => r.id)
    const unique = new Set(ids).size
    return { actual: { n: rows.length, unique, first: ids[0], last: ids[ids.length - 1] }, expected: { n: 2250, unique: 2250, first: 1, last: 2250 } }
  })

  await check('exactamente 2000 filas: termina con una página vacía', async () => {
    const { builder, calls } = fakeTable(2000)
    const rows = await fetchAll(builder, 1000)
    return { actual: { n: rows.length, calls: calls.length }, expected: { n: 2000, calls: 3 } }
  })

  await check('un error de una página se propaga (no devuelve datos parciales)', async () => {
    const { builder } = fakeTable(2500, { failAt: 1000 })
    let message = null
    try {
      await fetchAll(builder, 1000)
    } catch (error) {
      message = error.message
    }
    return { actual: message, expected: 'boom' }
  })

  if (failures > 0) {
    console.log(`\n${failures} caso(s) fallaron`)
    process.exitCode = 1
  } else {
    console.log('\nTodos los casos pasaron')
  }
}

main()
