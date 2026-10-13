// Borra ordenes de prueba de la base.
//
// Contexto: agosto tiene 14 ordenes canceladas por $391.000 que son pruebas
// (todas entre el 5 y el 12 de agosto). Son mas del triple de la facturacion
// real, asi que ensucian el resumen de Finanzas.
//
// ---------------------------------------------------------------------------
// POR DEFECTO NO BORRA NADA: muestra que borraria y termina.
// Para borrar de verdad hay que pasar --apply.
//
//   node scripts/purge-test-orders.js
//   node scripts/purge-test-orders.js --apply
//
// Opciones:
//   --from=YYYY-MM-DD   inicio del rango (default: 2026-08-01)
//   --to=YYYY-MM-DD     fin del rango (default: 2026-08-31)
//   --status=cancelled  estado a borrar (default: cancelled)
//   --apply             ejecuta el borrado
//
// ---------------------------------------------------------------------------
// Sobre el stock: NO se toca. El stock baja al confirmar una orden y se
// devuelve al cancelarla confirmada. Una orden cancelada nunca dejo stock
// descontado, asi que borrarla no descuadra nada. (Ver app/api/orders/[id]/route.js)
// ---------------------------------------------------------------------------

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local')
  const content = fs.readFileSync(envPath, 'utf-8')
  const env = {}
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim()
  }
  return env
}

function parseArgs(argv) {
  const options = {
    from: '2026-08-01',
    to: '2026-08-31',
    status: 'cancelled',
    apply: false,
  }
  for (const arg of argv.slice(2)) {
    if (arg === '--apply') options.apply = true
    else if (arg.startsWith('--from=')) options.from = arg.slice('--from='.length)
    else if (arg.startsWith('--to=')) options.to = arg.slice('--to='.length)
    else if (arg.startsWith('--status=')) options.status = arg.slice('--status='.length)
    else {
      console.error(`Opcion desconocida: ${arg}`)
      console.error('Usar: --from= --to= --status= --apply')
      process.exit(1)
    }
  }
  return options
}

// Las fechas del rango son en hora argentina (UTC-3). El limite inferior es
// 00:00 AR y el superior 00:00 AR del dia siguiente, para que "hasta el 12"
// incluya todo el 12.
function rangeBounds(from, to) {
  const start = new Date(`${from}T00:00:00-03:00`)
  const toDate = new Date(`${to}T00:00:00-03:00`)
  const end = new Date(toDate.getTime() + 24 * 60 * 60 * 1000)
  return { start: start.toISOString(), end: end.toISOString() }
}

async function main() {
  const options = parseArgs(process.argv)

  if (!['pending', 'confirmed', 'cancelled'].includes(options.status)) {
    console.error(`Estado invalido: ${options.status}`)
    process.exit(1)
  }

  const env = loadEnv()
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
  const { start, end } = rangeBounds(options.from, options.to)

  console.log('=== Purga de ordenes de prueba ===')
  console.log(`Base:      ${env.NEXT_PUBLIC_SUPABASE_URL}`)
  console.log(`Rango:     ${options.from} 00:00  a  ${options.to} 24:00  (hora argentina)`)
  console.log(`Estado:    ${options.status}`)
  console.log(`Modo:      ${options.apply ? 'BORRAR DE VERDAD' : 'simulacion (no borra nada)'}`)
  console.log('')

  const { data: rows, error } = await db
    .from('orders')
    .select('id, order_number, status, price_at_order, quantity, created_at, product_name')
    .eq('status', options.status)
    .gte('created_at', start)
    .lt('created_at', end)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error leyendo ordenes:', error.message)
    process.exit(1)
  }

  if (!rows || rows.length === 0) {
    console.log('No hay ordenes que coincidan. No se toca nada.')
    return
  }

  let total = 0
  console.log('Ordenes encontradas:')
  console.log('')
  for (const row of rows) {
    const amount = Number(row.price_at_order || 0) * (Number(row.quantity) || 1)
    total += amount
    console.log(
      '  ' +
        (row.created_at || '').slice(0, 10) +
        '  ' +
        (row.order_number || '(sin numero)').padEnd(12) +
        ('$' + amount.toFixed(2)).padEnd(12) +
        (row.product_name || '(sin nombre)')
    )
  }

  console.log('')
  console.log(`Filas:  ${rows.length}`)
  console.log(`Monto:  $${total.toFixed(2)}`)
  console.log('')

  if (!options.apply) {
    console.log('No se borro nada (simulacion).')
    console.log('Para borrar de verdad, volve a correr con --apply')
    return
  }

  const ids = rows.map(r => r.id)
  const { error: deleteError, count } = await db
    .from('orders')
    .delete({ count: 'exact' })
    .in('id', ids)

  if (deleteError) {
    console.error('Error borrando:', deleteError.message)
    process.exit(1)
  }

  console.log(`Listo. Se borraron ${count ?? ids.length} ordenes.`)
  console.log('El resumen de Finanzas ya no las va a contar.')
}

main().catch(err => {
  console.error('Error fatal:', err)
  process.exit(1)
})
