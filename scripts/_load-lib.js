// Puente entre lib/*.js (ESM, para Next) y scripts/*.js (CommonJS, para Node).
//
// El proyecto no tiene "type": "module", así que Node trata los .js como
// CommonJS y no puede importar el `export` de lib/customers.js directamente.
// Este helper lee el archivo real y lo evalúa sin los `export`, de modo que los
// scripts usan EXACTAMENTE la misma lógica que la app.
//
// Existe para evitar lo que antes pasaba: una copia del normalizador de
// teléfonos en cada script, que se desincronizaba del original en silencio.

const fs = require('fs')
const path = require('path')

/**
 * Carga un módulo de lib/ exportando los nombres pedidos.
 * @param {string} fileName ej: 'customers.js'
 * @param {string[]} names funciones/constantes a exponer
 * @returns {Record<string, unknown>}
 */
function loadLibModule(fileName, names) {
  const filePath = path.join(__dirname, '..', 'lib', fileName)
  const source = fs.readFileSync(filePath, 'utf-8')

  // `export function foo` -> `function foo`. Ojo con el espacio: un regex
  // tipo /^export\s+(...)\s/ se lo come y produce `functionfoo`.
  const body = source.replace(/^export\s+/gm, '')

  return new Function(`${body}\nreturn { ${names.join(', ')} }`)()
}

module.exports = { loadLibModule }