// Crea (una sola vez) el bucket PRIVADO donde se guardan las capturas de los
// participantes de los sorteos.
//
// Ejecutar:  node scripts/setup-giveaway-storage.js
//
// Lee .env.local (igual que seed-customers.js). Es idempotente: si el bucket ya
// existe, solo actualiza sus límites.
//
// El bucket es privado a propósito: no existe una URL pública de las capturas.
// El panel admin las abre con URLs firmadas que duran 60 segundos.

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const BUCKET = 'giveaway-evidence'
const MAX_BYTES = 4 * 1024 * 1024
const MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']

function loadEnv() {
  const content = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf-8')
  const env = {}
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim()
  }
  return env
}

async function main() {
  const env = loadEnv()
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local')
  }
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

  const options = { public: false, fileSizeLimit: MAX_BYTES, allowedMimeTypes: MIME_TYPES }

  const { error: createError } = await supabase.storage.createBucket(BUCKET, options)
  if (!createError) {
    console.log(`Bucket "${BUCKET}" creado (privado, máx. 4 MB, JPG/PNG/WebP).`)
    return
  }

  if (!/already exists|duplicate/i.test(createError.message || '')) throw createError

  const { error: updateError } = await supabase.storage.updateBucket(BUCKET, options)
  if (updateError) throw updateError
  console.log(`El bucket "${BUCKET}" ya existía: se actualizaron sus límites.`)
}

main().catch(error => {
  console.error('No se pudo configurar el bucket:', error.message || error)
  process.exit(1)
})
