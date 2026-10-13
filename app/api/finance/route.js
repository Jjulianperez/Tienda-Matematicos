import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/auth'
import { buildFinanceReport } from '@/lib/finance'

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min
  return Math.min(Math.max(Math.trunc(value), min), max)
}

export async function GET(request) {
  const payload = requireAdmin(request)
  if (payload instanceof NextResponse) return payload

  const { searchParams } = new URL(request.url)
  // Cuántos meses hacia atrás mostrar como mínimo. El rango se estira solo si
  // hay datos más viejos, así que el tope es solo para no traer una serie
  // eterna si alguien pasa un número absurdo.
  const monthsBack = clamp(Number(searchParams.get('monthsBack')) || 12, 1, 36)

  const { data: orders, error } = await supabaseAdmin
    .from('orders')
    .select(
      'id, order_number, status, price_at_order, quantity, created_at, confirmed_at, product_id, product_name, combo_items'
    )
    .order('created_at', { ascending: false })

  if (error) {
    // Si todavía no corrió la migración 003, la columna confirmed_at no existe
    // y el error crudo de Postgres no dice nada útil.
    const missingColumn = /confirmed_at/.test(error.message)
    return NextResponse.json(
      {
        error: missingColumn
          ? 'Falta aplicar una migración: corré supabase/migrations/003_finance.sql en el SQL Editor de Supabase.'
          : error.message,
        detail: error.message,
      },
      { status: 500 }
    )
  }

  const report = buildFinanceReport(orders || [], { monthsBack })

  // Estado de los costos: sin products.cost no se puede calcular ganancia.
  // Si la migración 003 todavía no corrió, `cost` no existe y estas consultas
  // fallan; se devuelve null y la UI simplemente no muestra el aviso.
  const [withoutCost, totalProducts] = await Promise.all([
    supabaseAdmin.from('products').select('id', { count: 'exact', head: true }).is('cost', null),
    supabaseAdmin.from('products').select('id', { count: 'exact', head: true }),
  ])

  return NextResponse.json({
    ...report,
    data_quality: {
      ...report.data_quality,
      products_without_cost: withoutCost.error ? null : (withoutCost.count ?? 0),
      total_products: totalProducts.error ? null : (totalProducts.count ?? 0),
      cost_tracking_ready: !withoutCost.error,
    },
  })
}
