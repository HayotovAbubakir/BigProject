export function formatMoney(value) {
  if (value === null || value === undefined) return '0'
  const n = Number(value)
  if (Number.isNaN(n)) return String(value)
  
  return new Intl.NumberFormat('de-DE').format(n)
}

export default formatMoney

export function parseNumber(value) {
  if (value === null || value === undefined) return 0
  
  const s = String(value).replace(/\s/g, '').replace(/\./g, '').replace(/,/g, '.')
  const n = Number(s)
  return Number.isNaN(n) ? 0 : n
}
