// Test del alta de cliente al confirmar un pedido (H8).
// Ejecutar: npm run test:customer-upsert
//
// Usa un cliente de Supabase FALSO que imita lo que hace PostgREST con
// ON CONFLICT (phone) DO NOTHING. No toca la base.

const { loadLibModule } = require('./_load-lib')

const { upsertCustomerForOrder, normalizePhone } = loadLibModule('customers.js', [
  'upsertCustomerForOrder',
  'normalizePhone',
])

let failures = 0

function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) failures++
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}${ok ? '' : ` -> esperado ${JSON.stringify(expected)}, obtenido ${JSON.stringify(actual)}`}`)
}

// Cliente falso con dos tablas en memoria.
function fakeSupabase({ customers = [], orders = [] } = {}) {
  let nextId = 1
  const db = { customers, orders }

  // Lectura: .select().eq().is().order().single() / .maybeSingle() / await directo.
  function selectChain(rows) {
    let current = rows
    const chain = {
      eq(col, val) { current = current.filter(r => r[col] === val); return chain },
      is(col, val) { current = current.filter(r => (r[col] ?? null) === val); return chain },
      order() { return chain },
      single() {
        return Promise.resolve(current.length === 1
          ? { data: current[0], error: null }
          : { data: null, error: { message: `esperaba 1 fila, hay ${current.length}` } })
      },
      then(resolve) { resolve({ data: current, error: null }) },
    }
    return chain
  }

  // Escritura: .update(patch).eq().is() — se aplica al hacer await.
  function updateChain(rows, patch) {
    const filters = []
    const chain = {
      eq(col, val) { filters.push(r => r[col] === val); return chain },
      is(col, val) { filters.push(r => (r[col] ?? null) === val); return chain },
      then(resolve) {
        rows.filter(r => filters.every(f => f(r))).forEach(r => Object.assign(r, patch))
        resolve({ error: null })
      },
    }
    return chain
  }

  return {
    db,
    from(table) {
      const rows = db[table]
      return {
        upsert(values, options = {}) {
          // ON CONFLICT (phone) DO NOTHING: síncrono dentro del mismo "turno",
          // como lo haría Postgres con una sola sentencia.
          if (options.onConflict === 'phone' && options.ignoreDuplicates) {
            if (!rows.some(r => r.phone === values.phone)) {
              rows.push({ id: `c${nextId++}`, ...values })
            }
            return Promise.resolve({ error: null })
          }
          return Promise.resolve({ error: { message: 'upsert no soportado en el fake' } })
        },
        select(fields) { return selectChain(rows) },
        update(patch) { return updateChain(rows, patch) },
      }
    },
  }
}

async function main() {
  const phone = '2657-583046'
  const normalized = normalizePhone(phone)

  {
    const supabase = fakeSupabase({
      orders: [{ id: 'o1', order_number: 'MM-AAAAAA', customer_id: null, created_at: '2026-01-01T10:00:00Z' }],
    })
    const id = await upsertCustomerForOrder({
      supabase, orderNumber: 'MM-AAAAAA', phone, name: 'Ana',
    })
    check('alta simple: crea el cliente y lo devuelve', typeof id, 'string')
    check('alta simple: queda un solo cliente con el teléfono normalizado', supabase.db.customers.length, 1)
    check('alta simple: el pedido queda enlazado', supabase.db.orders[0].customer_id, id)
  }

  {
    // Dos pedidos del mismo teléfono llegando a la vez.
    const supabase = fakeSupabase({
      orders: [
        { id: 'o1', order_number: 'MM-BBBBBB', customer_id: null, created_at: '2026-01-02T10:00:00Z' },
        { id: 'o2', order_number: 'MM-CCCCCC', customer_id: null, created_at: '2026-01-03T10:00:00Z' },
      ],
    })
    const results = await Promise.allSettled([
      upsertCustomerForOrder({ supabase, orderNumber: 'MM-BBBBBB', phone, name: 'Ana' }),
      upsertCustomerForOrder({ supabase, orderNumber: 'MM-CCCCCC', phone, name: 'Ana' }),
    ])
    const failed = results.filter(r => r.status === 'rejected').length
    check('pedidos simultáneos del mismo teléfono: ninguno falla', failed, 0)
    check('pedidos simultáneos: queda un solo cliente', supabase.db.customers.length, 1)
    const linked = new Set(supabase.db.orders.map(o => o.customer_id))
    check('pedidos simultáneos: ambos pedidos apuntan al mismo cliente', linked.size === 1 && !linked.has(null), true)
  }

  {
    // Cliente existente con nombre corregido a mano: no se pisa.
    const supabase = fakeSupabase({
      customers: [{ id: 'cX', phone: normalized, name: 'Nombre corregido', phone_display: '2657 58-3046' }],
      orders: [{ id: 'o1', order_number: 'MM-DDDDDD', customer_id: null, created_at: '2026-01-04T10:00:00Z' }],
    })
    await upsertCustomerForOrder({ supabase, orderNumber: 'MM-DDDDDD', phone, name: 'Otro nombre' })
    check('cliente existente con nombre: no se sobreescribe', supabase.db.customers[0].name, 'Nombre corregido')
  }

  {
    // Cliente existente sin nombre: se completa.
    const supabase = fakeSupabase({
      customers: [{ id: 'cY', phone: normalized, name: null, phone_display: '2657 58-3046' }],
      orders: [{ id: 'o1', order_number: 'MM-EEEEEE', customer_id: null, created_at: '2026-01-05T10:00:00Z' }],
    })
    await upsertCustomerForOrder({ supabase, orderNumber: 'MM-EEEEEE', phone, name: 'Luis' })
    check('cliente existente sin nombre: se completa con el del pedido', supabase.db.customers[0].name, 'Luis')
  }

  {
    const supabase = fakeSupabase()
    const id = await upsertCustomerForOrder({ supabase, orderNumber: 'MM-FFFFFF', phone: '', name: 'Sin tel' })
    check('sin teléfono: no escribe nada y devuelve null', [id, supabase.db.customers.length], [null, 0])
  }

  if (failures > 0) {
    console.log(`\n${failures} caso(s) fallaron`)
    process.exitCode = 1
  } else {
    console.log('\nTodos los casos pasaron')
  }
}

main()
