// Lectura completa de una consulta de Supabase (H6).
//
// PostgREST devuelve como máximo 1000 filas por petición (límite por defecto
// del proyecto). Una consulta sin paginar se corta en silencio: finanzas y
// clientes salían incompletos sin ningún aviso al pasar esa cantidad de filas.
//
// `buildQuery` tiene que devolver una consulta NUEVA en cada llamada, con un
// `order` estable (por ejemplo por id), para que las páginas no se repitan ni
// se salteen filas entre sí.
export const SUPABASE_PAGE_SIZE = 1000

export async function fetchAll(buildQuery, pageSize = SUPABASE_PAGE_SIZE) {
  const rows = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await buildQuery().range(from, from + pageSize - 1)
    if (error) throw error
    const page = data || []
    rows.push(...page)
    if (page.length < pageSize) break
  }
  return rows
}
