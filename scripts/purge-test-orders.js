// Borra ordenes de prueba de la base.
//
// Contexto: agosto tiene 14 ordenes canceladas por $391.000 que son pruebas
// (todas entre el 5 y el 12 de agosto). Son mas del triple de la facturacion
// real, asi que ensucian el resumen de Finanzas.
//
// Ademas hay filas "vacias": sin numero de pedido, sin producto y sin combo,
// con precio nulo. Son restos de pruebas viejas que no aportan plata pero si
// inflan el conteo de pedidos del cliente.
//
// ---------------------------------------------------------------------------
// POR DEFECTO NO BORRA NADA: muestra que borraria y termina.
// Para borrar de verdad hay que pasar --apply.
//
//   node scripts/purge-test-orders.js                    (canceladas de agosto)
//   node scripts/purge-test-orders.js --apply
//   node scripts/purge-test-orders.js --junk             (solo filas vacias)
//   node scripts/purge-test-orders.js --junk --apply
//
// Opciones:
//   --from=YYYY-MM-DD   inicio del rango (default: 2026-08-01)
//   --to=YYYY-MM-DD     fin del rango (default: 2026-08-31)
//   --status=cancelled  estado a borrar (default: cancelled)
//   --junk              en vez de rango+estado, borra las filas vacias
//   --apply             ejecuta el borrado
//
// OJO: no usar rango+estado por fecha para las filas vacias. Hay ventas
// reales de agosto con product_id nulo (el producto se borro del catalogo,
// pero la linea conserva nombre y precio). El modo --junk las excluye porque
// exige tambien order_number nulo.
//
// ---------------------------------------------------------------------------
// Sobre el stock: NO se toca. El stock baja al confirmar una orden y se
// devuelve al cancelarla confirmada. Una orden cancelada nunca dejo stock
// descontado, asi que borrarla no descuadra nada. (Ver app/api/orders/[id]/route.js)
//
// Sobre el cliente: al borrar se refrescan first_order_at y last_order_at, que
// son columnas cacheadas y NO se recalculan al leer. Misma logica que
// upsertCustomerForOrder en lib/customers.js.
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
    junk: false,
    apply: false,
  }
  for (const arg of argv.slice(2)) {
    if (arg === '--apply') options.apply = true
    else if (arg === '--junk') options.junk = true
    else if (arg.startsWith('--from=')) options.from = arg.slice('--from='.length)
    else if (arg.startsWith('--to=')) options.to = arg.slice('--to='.length)
    else if (arg.startsWith('--status=')) options.status = arg.slice('--status='.length)
    else {
      console.error(`Opcion desconocida: ${arg}`)
      console.error('Usar: --from= --to= --status= --junk --apply')
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

const SELECT = 'id, order_number, status, price_at_order, quantity, created_at, product_name, customer_id'

async function fetchRows(db, options) {
  let query = db.from('orders').select(SELECT)

  if (options.junk) {
    query = query.is('order_number', null).is('product_id', null).is('combo_items', null)
  } else {
    const { start, end } = rangeBounds(options.from, options.to)
    query = query.eq('status', options.status).gte('created_at', start).lt('created_at', end)
  }

  const { data, error } = await query.order('created_at', { ascending: true })
  if (error) {
    console.error('Error leyendo ordenes:', error.message)
    process.exit(1)
  }
  return data || []
}

// Refresca las fechas cacheadas de los clientes afectados. Si un cliente se
// queda sin pedidos, sus fechas vuelven a null (que es la verdad).
async function refreshCustomers(db, customerIds) {
  for (const id of customerIds) {
    const { data: dated, error: readError } = await db
      .from('orders')
      .select('created_at')
      .eq('customer_id', id)
      .order('created_at', { ascending: true })

    if (readError) {
      console.error(`Error leyendo pedidos del cliente ${id}:`, readError.message)
      process.exit(1)
    }

    const patch = dated?.length
      ? { first_order_at: dated[0].created_at, last_order_at: dated[dated.length - 1].created_at }
      : { first_order_at: null, last_order_at: null }

    const { error: updateError } = await db.from('customers').update(patch).eq('id', id)
    if (updateError) {
      console.error(`Error refrescando el cliente ${id}:`, updateError.message)
      process.exit(1)
    }
  }
}

async function main() {
  const options = parseArgs(process.argv)

  if (!options.junk && !['pending', 'confirmed', 'cancelled'].includes(options.status)) {
    console.error(`Estado invalido: ${options.status}`)
    process.exit(1)
  }

  const env = loadEnv()
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

  console.log('=== Purga de ordenes de prueba ===')
  console.log(`Base:      ${env.NEXT_PUBLIC_SUPABASE_URL}`)
  if (options.junk) {
    console.log('Criterio:  filas vacias (sin numero de pedido, sin producto, sin combo)')
  } else {
    console.log(`Rango:     ${options.from} 00:00  a  ${options.to} 24:00  (hora argentina)`)
    console.log(`Estado:    ${options.status}`)
  }
  console.log(`Modo:      ${options.apply ? 'BORRAR DE VERDAD' : 'simulacion (no borra nada)'}`)
  console.log('')

  const rows = await fetchRows(db, options)

  if (rows.length === 0) {
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
        (row.status || '?').padEnd(10) +
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

  const customerIds = [...new Set(rows.map(r => r.customer_id).filter(Boolean))]
  if (customerIds.length) {
    await refreshCustomers(db, customerIds)
    console.log(`Se refrescaron las fechas de ${customerIds.length} cliente(s).`)
  }

  console.log('El resumen de Finanzas ya no las va a contar.')
}

main().catch(err => {
  console.error('Error fatal:', err)
  process.exit(1)
})
