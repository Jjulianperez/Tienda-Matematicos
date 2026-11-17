// Columnas de products que pueden salir por la API pública (H5).
//
// Se listan a mano y NO incluyen `cost`: el costo de cada producto es un dato
// de negocio (margen) y no debe ser visible para cualquiera que abra la tienda.
// Si se agrega una columna nueva a products, decidir acá si es pública.
export const PUBLIC_PRODUCT_COLUMNS = [
  'id',
  'name',
  'description',
  'price',
  'stock',
  'category_id',
  'images',
  'whatsapp_clicks',
  'featured',
  'created_at',
  'updated_at',
  'weight',
].join(', ')
