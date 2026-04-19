export function formatWholesaleNumber(value) {
  if (value == null) return '0'
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.round(Number(value) || 0))
}

export function formatWholesaleIntl(value, digits = 0) {
  const num = Number(value || 0)
  return num.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

export function roundWholesaleUsd(value) {
  if (value == null) return '0.00'
  return (Math.round(Number(value) * 100) / 100).toFixed(2)
}

export function parseWholesaleDetail(detail) {
  if (!detail || typeof detail !== 'string') return null
  const prefix = 'WHOLESALE_JSON:'
  if (!detail.startsWith(prefix)) return null
  try {
    return JSON.parse(detail.slice(prefix.length))
  } catch (_err) {
    return null
  }
}

export function buildWholesaleGroups(wholesaleLogs = [], usdToUzs = 0) {
  const groups = {}

  wholesaleLogs.forEach((log) => {
    const meta = parseWholesaleDetail(log.detail)
    if (!meta) return

    const key = meta.ts || log.ts || `${log.date}-${log.time}-${log.id}`
    if (!groups[key]) {
      groups[key] = {
        id: key,
        date: log.date,
        time: log.time,
        user: log.user_display || log.user_name || "Noma'lum",
        rate: meta.rate || usdToUzs || null,
        items: [],
        totalUsd: 0,
        totalUzs: 0,
      }
    }

    const rate = meta.rate || usdToUzs || 0
    const sessionItems = Array.isArray(meta.items) && meta.items.length > 0 ? meta.items : [meta]

    sessionItems.forEach((item) => {
      const currency = item.currency || log.currency || 'UZS'
      const lineTotal = Number(item.line_total || item.amount || 0)
      const lineUsd = currency === 'USD' ? lineTotal : (rate ? lineTotal / rate : 0)
      const lineUzs = currency === 'USD' ? Math.round(lineTotal * (rate || 0)) : lineTotal

      groups[key].items.push({
        ...item,
        currency,
        line_total: lineTotal,
      })
      groups[key].totalUsd += lineUsd || 0
      groups[key].totalUzs += lineUzs || 0
    })
  })

  return Object.values(groups).sort((a, b) => String(b.id).localeCompare(String(a.id)))
}
