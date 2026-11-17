// Secreto para firmar y verificar los JWT del admin (H11).
//
// Si JWT_SECRET falta o es corto, cualquiera podría forjar un token de admin
// con un secreto adivinable. Por eso el servidor se niega a firmar o verificar
// en vez de usar un valor por defecto o uno débil.
export const MIN_JWT_SECRET_LENGTH = 32

export function readJwtSecret(value) {
  if (typeof value !== 'string' || value.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET falta o tiene menos de ${MIN_JWT_SECRET_LENGTH} caracteres. ` +
        'Configuralo en las variables de entorno del servidor.'
    )
  }
  return value
}
