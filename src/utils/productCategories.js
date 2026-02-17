export const METER_CATEGORY = 'metrlab sotiladigan mahsulotlar'
export const DEFAULT_PRODUCT_CATEGORIES = ['gaz balon', 'elektrod', 'tosh', METER_CATEGORY]
export const PRODUCT_CATEGORIES_STORAGE_KEY = 'productCategories'

export const normalizeCategory = (value) => {
  if (!value) return ''
  // Allow passing objects such as full product records or option objects
  if (typeof value === 'object') {
    const candidate = value.category ?? value.label ?? value.name ?? value.value
    if (!candidate) return ''
    value = candidate
  }
  return value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

// Also accepts a full product object and infers meter items from pack_qty / meter_qty
export const isMeterCategory = (value) => {
  if (!value) return false

  if (typeof value === 'object') {
    const packQty = Number(value.pack_qty ?? 0)
    const meterQty = Number(value.meter_qty ?? 0)
    if (packQty > 0 || meterQty > 0) return true
    return isMeterCategory(value.category ?? value.label ?? value.name ?? value.value)
  }

  const normalized = normalizeCategory(value)
  const normalizedMeter = normalizeCategory(METER_CATEGORY)
  return normalized === normalizedMeter || normalized.includes('metr')
}

export const mergeCategories = (...lists) => {
  const merged = new Set()
  lists.flat().forEach((item) => {
    if (!item) return
    if (Array.isArray(item)) {
      item.forEach((cat) => {
        const normalized = normalizeCategory(cat)
        if (normalized) merged.add(normalized)
      })
      return
    }
    const normalized = normalizeCategory(item)
    if (normalized) merged.add(normalized)
  })
  return Array.from(merged)
}

export const loadStoredProductCategories = () => {
  if (typeof window === 'undefined') return DEFAULT_PRODUCT_CATEGORIES
  try {
    const raw = localStorage.getItem(PRODUCT_CATEGORIES_STORAGE_KEY)
    if (!raw) return DEFAULT_PRODUCT_CATEGORIES
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.length > 0) {
      return mergeCategories(parsed, DEFAULT_PRODUCT_CATEGORIES)
    }
  } catch (_err) {
    void _err
  }
  return DEFAULT_PRODUCT_CATEGORIES
}
