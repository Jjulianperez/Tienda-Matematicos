// Script de backfill: crea clientes a partir de los pedidos existentes y
// enlaza orders.customer_id.
//
// Ejecutar UNA vez, después de aplicar supabase/migrations/002_customers.sql:
//   node scripts/seed-customers.js
//
// Es idempotente: podés correrlo varias veces sin duplicar clientes.
// Los pedidos sin teléfono o con teléfono inválido se saltean.

const { createClient } = require('@supabase/supabase-js')
const path = require('path')
const { loadLibModule } = require('./_load-lib')

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local')
  const content = require('fs').readFileSync(envPath, 'utf-8')
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

// El normalizador de teléfonos NO va duplicado acá: se carga del mismo
// lib/customers.js que usa la app, así no pueden desincronizarse.
const { normalizePhone, formatPhoneDisplay } = loadLibModule('customers.js', [
  'normalizePhone',
  'formatPhoneDisplay',
])

async function main() {
  const env = loadEnv()
  const supabaseAdmin = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY
  )

  const { data: orders, error: ordersError } = await supabaseAdmin
    .from('orders')
    .select('id, order_number, customer_phone, customer_name, created_at, status')

  if (ordersError) {
    console.error('Error leyendo pedidos:', ordersError.message)
    return
  }

  console.log(`Pedidos encontrados: ${orders.length}`)

  // Agrupar por teléfono normalizado
  const byPhone = new Map()
  let skipped = 0

  for (const order of orders || []) {
    const phone = normalizePhone(order.customer_phone)
    if (!phone) {
      skipped++
      continue
    }
    if (!byPhone.has(phone)) {
      byPhone.set(phone, { phone, name: null, phoneDisplay: null, orders: [] })
    }
    const entry = byPhone.get(phone)
    // Guardar el primer nombre no vacío que aparezca
    if (!entry.name && order.customer_name?.trim()) {
      entry.name = order.customer_name.trim()
    }
    if (!entry.phoneDisplay && order.customer_phone) {
      entry.phoneDisplay = formatPhoneDisplay(order.customer_phone)
    }
    entry.orders.push(order)
  }

  console.log(`Clientes a crear/actualizar: ${byPhone.size}`)
  console.log(`Pedidos salteados (sin teléfono): ${skipped}`)
  console.log('')

  let created = 0
  let updated = 0
  let linked = 0

  for (const entry of byPhone.values()) {
    let customerId = null

    const { data: existing } = await supabaseAdmin
      .from('customers')
      .select('id')
      .eq('phone', entry.phone)
      .maybeSingle()

    if (existing) {
      customerId = existing.id
      updated++
    } else {
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from('customers')
        .insert({
          name: entry.name,
          phone: entry.phone,
          phone_display: entry.phoneDisplay,
        })
        .select('id')
        .single()

      if (insertError) {
        console.error(`  ERROR creando ${entry.phone}:`, insertError.message)
        continue
      }
      customerId = inserted.id
      created++
    }

    // Enlazar todos los pedidos de este teléfono
    const ids = entry.orders.map(o => o.id)
    const { error: linkError } = await supabaseAdmin
      .from('orders')
      .update({ customer_id: customerId })
      .in('id', ids)

    if (linkError) {
      console.error(`  ERROR enlazando ${entry.phone}:`, linkError.message)
      continue
    }
    linked += ids.length

    // Fechas cacheadas
    const dates = entry.orders
      .map(o => o.created_at)
      .filter(Boolean)
      .sort()

    if (dates.length) {
      await supabaseAdmin
        .from('customers')
        .update({
          first_order_at: dates[0],
          last_order_at: dates[dates.length - 1],
        })
        .eq('id', customerId)
    }
  }

  console.log('')
  console.log('--- Resultado ---')
  console.log(`Clientes creados: ${created}`)
  console.log(`Clientes ya existentes (actualizados): ${updated}`)
  console.log(`Pedidos enlazados: ${linked}`)
  console.log('')
  console.log('Listo. Ya podés usar /admin/clientes')
}

main().catch(err => {
  console.error('Error fatal:', err)
  process.exit(1)
})
