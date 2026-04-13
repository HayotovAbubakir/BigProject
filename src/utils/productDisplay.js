import { isMeterCategory } from './productCategories'

export function formatProductName(product, t) {
  if (!product) return ''
  let base = (product.name || '').toString()
  if (!base) return ''

  // Strip automatic location suffixes like "[store]" or "(warehouse)" used to avoid Supabase name conflicts
  base = base.replace(/\s*\[(store|warehouse)\]$/i, '').replace(/\s*\((store|warehouse)\)$/i, '')

  const parts = []
  const electrodeSize = (product.electrode_size || '').toString().trim()
  if (electrodeSize) parts.push(electrodeSize)

  const stoneThickness = (product.stone_thickness || '').toString().trim()
  if (stoneThickness) parts.push(`${(t && t('stone_thickness')) || 'Qalinlik'}: ${stoneThickness}`)

  const stoneSize = (product.stone_size || '').toString().trim()
  if (stoneSize) parts.push(`${(t && t('stone_size')) || 'Hajm'}: ${stoneSize}`)

  if (isMeterCategory(product)) {
    const meterValue = Number(product.pack_qty || 0)
    if (meterValue > 0) parts.push(`${(t && t('unit_meter')) || 'Metr'}: ${meterValue} m`)
  }

  return parts.length ? `${base} (${parts.join(', ')})` : base
}
