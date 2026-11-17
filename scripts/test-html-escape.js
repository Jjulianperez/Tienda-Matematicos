// Test del escape de HTML para emails (H13).
// Ejecutar: npm run test:html-escape

const { loadLibModule } = require('./_load-lib')

const { escapeHtml } = loadLibModule('html.js', ['escapeHtml'])

let failures = 0

function check(label, actual, expected) {
  const ok = actual === expected
  if (!ok) failures++
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}${ok ? '' : ` -> esperado ${JSON.stringify(expected)}, obtenido ${JSON.stringify(actual)}`}`)
}

check('escapa etiquetas', escapeHtml('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;')
check('escapa comillas dobles y simples', escapeHtml(`"hola" 'chau'`), '&quot;hola&quot; &#39;chau&#39;')
check('escapa el ampersand primero (sin doble escape)', escapeHtml('a & b &amp;'), 'a &amp; b &amp;amp;')
check('texto normal no cambia', escapeHtml('Ana María 2657-583046'), 'Ana María 2657-583046')
check('null y undefined dan cadena vacía', `${escapeHtml(null)}|${escapeHtml(undefined)}`, '|')
check('números se convierten a texto', escapeHtml(1500), '1500')

if (failures > 0) {
  console.log(`\n${failures} caso(s) fallaron`)
  process.exitCode = 1
} else {
  console.log('\nTodos los casos pasaron')
}
