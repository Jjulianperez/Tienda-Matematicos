// Puente entre lib/*.js (ESM, para Next) y scripts/*.js (CommonJS, para Node).
//
// El proyecto no tiene "type": "module", así que Node trata los .js como
// CommonJS y no puede importar el `export` de lib/*.js directamente.
//
// Este helper lee el archivo real, le resuelve los imports relativos
// (`import { x } from './otro'`) concatenando el módulo del que depende, y
// evalúa todo junto sin los `export`. Resultado: los scripts usan EXACTAMENTE
// la misma lógica que la app, sin copias que se desincronicen.
//
// Limitaciones a propósito: solo resuelve imports relativos dentro de lib/, y
// solo la forma `import { a, b } from './x'`. No hay imports de paquetes ni
// `export default`. Si algún día hace falta más, se cambia por un build real.

const fs = require('fs')
const path = require('path')

const LIB_DIR = path.join(__dirname, '..', 'lib')
const IMPORT_RE = /^import\s+\{[^}]*\}\s+from\s+'(\.[^']+)'\s*$/gm

/**
 * Devuelve el código de un módulo de lib/ y de sus dependencias relativas,
 * con los `import` y `export` ya quitados.
 * @param {string} fileName
 * @param {Set<string>} seen evita ciclos
 * @returns {string}
 */
function collectSource(fileName, seen) {
  if (seen.has(fileName)) return ''
  seen.add(fileName)

  const source = fs.readFileSync(path.join(LIB_DIR, fileName), 'utf-8')

  let dependencies = ''
  for (const match of source.matchAll(IMPORT_RE)) {
    const dep = match[1].replace(/^\.\//, '').replace(/\.js$/, '') + '.js'
    dependencies += collectSource(dep, seen) + '\n'
  }

  const own = source
    .replace(IMPORT_RE, '')      // saca los imports (ya están concatenados)
    .replace(/^export\s+/gm, '') // `export const x` -> `const x`
    .replace(/^export\s*\{[^}]*\}\s*;?\s*$/gm, '')

  return dependencies + own
}

/**
 * Carga un módulo de lib/ y expone los nombres pedidos.
 * @param {string} fileName ej: 'customers.js'
 * @param {string[]} names funciones/constantes a exponer
 * @returns {Record<string, unknown>}
 */
function loadLibModule(fileName, names) {
  const body = collectSource(fileName, new Set())
  return new Function(`${body}\nreturn { ${names.join(', ')} }`)()
}

module.exports = { loadLibModule }
