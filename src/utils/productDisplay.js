export function formatProductName(product) {
  if (!product) return ''
  const base = (product.name || '').toString()
  if (!base) return ''

  const parts = []
  const electrodeSize = (product.electrode_size || '').toString().trim()
  if (electrodeSize) parts.push(electrodeSize)

  const stoneThickness = (product.stone_thickness || '').toString().trim()
  if (stoneThickness) parts.push(`Qalinlik: ${stoneThickness}`)

  const stoneSize = (product.stone_size || '').toString().trim()
  if (stoneSize) parts.push(`Hajm: ${stoneSize}`)

  return parts.length ? `${base} (${parts.join(', ')})` : base
}
