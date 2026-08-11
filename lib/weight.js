export function formatWeight(grams) {
  const g = Number(grams)
  if (!g || g <= 0) return ''
  if (g < 1000) return `${g} g`
  const kg = g / 1000
  return `${Number.isInteger(kg) ? kg : String(kg).replace(/\.(\d)0+$/, '.$1')} kg`
}