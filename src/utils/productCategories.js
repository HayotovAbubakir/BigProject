export const METER_CATEGORY = 'metrlab sotiladigan mahsulotlar'
export const DEFAULT_PRODUCT_CATEGORIES = ['gaz balon', 'elektrod', 'tosh', METER_CATEGORY]
export const PRODUCT_CATEGORIES_STORAGE_KEY = 'productCategories'

export const normalizeCategory = (value) => {
  if (!value) return ''
  return value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

export const isMeterCategory = (value) => normalizeCategory(value) === METER_CATEGORY

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
