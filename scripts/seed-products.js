// Script para cargar productos de ejemplo en el catálogo
// Ejecutar: node scripts/seed-products.js

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

const PRODUCTS = [
  {
    name: 'Mate Torpedo de Alpaca',
    description: 'Mate torpedo forrado en cuero vacuno con virola de alpaca pulida. Diseño ergonómico ideal para la mano argentina, con precisión de ingeniería en cada curva.',
    price: 24500,
    stock: 5,
    category: 'mates',
    featured: true,
  },
  {
    name: 'Mate Calabaza Premium',
    description: 'Calabaza seleccionada a mano, forrada en cuero con costura artesanal y virola de alpaca grabada. La base perfecta para un cebado equilibrado.',
    price: 18900,
    stock: 8,
    category: 'mates',
    featured: false,
  },
  {
    name: 'Mate Camionero Imperial',
    description: 'El clásico camionero con boca ancha y forro de cuero reforzado. Capacidad generosa y pared gruesa que conserva la temperatura del agua.',
    price: 32000,
    stock: 3,
    category: 'mates',
    featured: true,
  },
  {
    name: 'Bombilla Pico Loro Acero',
    description: 'Bombilla de acero inoxidable quirúrgico con pico loro clásico. Paleta filtradora que evita el polvillo y asegura un flujo constante.',
    price: 6800,
    stock: 15,
    category: 'bombillas',
    featured: false,
  },
  {
    name: 'Bombilla Bombón Alpaca',
    description: 'Bombilla bombón de alpaca con detalle torneado a mano. La combinación ideal de estética tradicional y durabilidad.',
    price: 9200,
    stock: 10,
    category: 'bombillas',
    featured: true,
  },
  {
    name: 'Termo Lumilagro 1.2L',
    description: 'Termo de acero inoxidable con doble pared al vacío. Mantiene el agua a 80°C por más de 12 horas. Válvula rosca de precisión.',
    price: 42000,
    stock: 4,
    category: 'termos',
    featured: true,
  },
  {
    name: 'Termo Stanley Clásico 1.1L',
    description: 'El clásico de toda la vida, ahora con tecnología de vacío moderna. Cuerpo de acero martillado con tapón de precisión.',
    price: 68000,
    stock: 2,
    category: 'termos',
    featured: false,
  },
  {
    name: 'Yerba Canarias Tradicional 1kg',
    description: 'Yerba mate uruguaya de sabor intenso y amargo equilibrado. Molido con la granulometría perfecta para un cebado estable.',
    price: 8500,
    stock: 20,
    category: 'yerbas',
    featured: false,
  },
  {
    name: 'Yerba Playadito 500g',
    description: 'Yerba suave y dulce, ideal para iniciarse en el mundo del mate. Selección de hojas de primer uso con corte tradicional.',
    price: 4500,
    stock: 25,
    category: 'yerbas',
    featured: false,
  },
  {
    name: 'Set Cebador con Matera',
    description: 'Kit completo: matera de cuero, yerbera y azucarera de acero. Todo lo necesario para un cebado profesional, organizado con precisión.',
    price: 15000,
    stock: 6,
    category: 'accesorios',
    featured: false,
  },
  {
    name: 'Porta Termo y Funda de Cuero',
    description: 'Porta termo con cierre reforzado y funda de cuero para tu termo. Diseño funcional para llevar la ronda donde vayas.',
    price: 21000,
    stock: 5,
    category: 'accesorios',
    featured: false,
  },
]

async function main() {
  const env = loadEnv()
  const supabaseAdmin = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY
  )

  const { data: categories } = await supabaseAdmin.from('categories').select('id, slug')
  const catMap = {}
  for (const c of categories || []) catMap[c.slug] = c.id

  let created = 0
  let skipped = 0

  for (const p of PRODUCTS) {
    const { data: existing } = await supabaseAdmin
      .from('products')
      .select('id')
      .eq('name', p.name)
      .maybeSingle()

    if (existing) {
      skipped++
      continue
    }

    const { error } = await supabaseAdmin.from('products').insert({
      name: p.name,
      description: p.description,
      price: p.price,
      stock: p.stock,
      category_id: catMap[p.category] || null,
      images: [],
      whatsapp_clicks: 0,
      featured: p.featured,
    })

    if (error) {
      console.error(`Error en "${p.name}":`, error.message)
      continue
    }
    created++
    console.log(`Creado: ${p.name} (${p.category})`)
  }

  console.log(`\nResumen: ${created} creados, ${skipped} ya existían.`)
}

main()
