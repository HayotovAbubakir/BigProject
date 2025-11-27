export function formatMoney(value) {
  if (value === null || value === undefined) return '0'
  const n = Number(value)
  if (Number.isNaN(n)) return String(value)
  // Use de-DE locale to get dot as thousands separator (e.g. 1.234.567)
  return new Intl.NumberFormat('de-DE').format(n)
}

export default formatMoney

export function parseNumber(value) {
  if (value === null || value === undefined) return 0
  // remove common thousands separators and non-numeric chars except minus and dot/comma
  const s = String(value).replace(/\s/g, '').replace(/\./g, '').replace(/,/g, '.')
  const n = Number(s)
  return Number.isNaN(n) ? 0 : n
}
