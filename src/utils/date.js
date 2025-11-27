export function toISODate(input) {
  if (!input) return new Date().toISOString().slice(0,10)
  
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input
  const d = new Date(input)
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0,10)
  return d.toISOString().slice(0,10)
}

export function monthShortFromISO(isoDate) {
  try {
    const parts = isoDate.split('-')
    if (parts.length !== 3) return ''
    const d = new Date(Date.UTC(parts[0], Number(parts[1]) - 1, parts[2]))
    return d.toLocaleString('default', { month: 'short' })
  } catch (err) {
    void err
    return ''
  }
}

export default toISODate
