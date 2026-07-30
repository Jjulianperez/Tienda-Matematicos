// Script para crear el admin en Supabase
// Ejecutar: node scripts/create-admin.js
// Requiere tener las variables de entorno configuradas

const { createClient } = require('@supabase/supabase-js')
const bcrypt = require('bcryptjs')

require('dotenv').config({ path: '.env.local' })

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function main() {
  const email = process.argv[2] || 'admin@matematicos.com'
  const password = process.argv[3] || 'admin123'

  const password_hash = await bcrypt.hash(password, 10)

  const { data, error } = await supabaseAdmin
    .from('admins')
    .insert({ email, password_hash })
    .select()
    .single()

  if (error) {
    console.error('Error:', error.message)
    return
  }

  console.log(`Admin creado: ${data.email}`)
}

main()
