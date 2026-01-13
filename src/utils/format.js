export function formatMoney(value) {
  if (value === null || value === undefined) return '0'
  const n = Number(value)
  if (Number.isNaN(n)) return String(value)
  
  return new Intl.NumberFormat('de-DE').format(n)
}

export function formatWithSpaces(value) {
  if (value === null || value === undefined) return ''
  const n = Number(value)
  if (Number.isNaN(n)) return String(value)
  const s = Math.round(n).toString()
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

export default formatMoney

export function parseNumber(value) {
  if (value === null || value === undefined) return 0
  
  const s = String(value).replace(/\s/g, '').replace(/\./g, '').replace(/,/g, '.')
  const n = Number(s)
  return Number.isNaN(n) ? 0 : n
}
