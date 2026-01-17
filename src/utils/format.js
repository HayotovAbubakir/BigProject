/**
 * Format a number with thousands separator using German locale (dot/comma)
 * @param {number|string} value - The numeric value to format
 * @returns {string} Formatted number string (e.g., "1.234,50")
 */
export function formatMoney(value) {
  if (value === null || value === undefined) return '0'
  const n = Number(value)
  if (Number.isNaN(n)) return String(value)
  
  // Use de-DE locale for German format: 1.234,50
  return new Intl.NumberFormat('de-DE').format(n)
}

/**
 * Format a number with space as thousands separator
 * @param {number|string} value - The numeric value to format
 * @returns {string} Formatted number string (e.g., "1 234 567")
 */
export function formatWithSpaces(value) {
  if (value === null || value === undefined) return ''
  const n = Number(value)
  if (Number.isNaN(n)) return String(value)
  const s = Math.round(n).toString()
  // Insert space every 3 digits from right to left
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

export default formatMoney

/**
 * Parse a formatted number string back to numeric value
 * Handles German format (1.234,50) and other formats
 * @param {string|number} value - The formatted number string
 * @returns {number} The parsed numeric value
 * 
 * Examples:
 * "1.234,50" → 1234.50
 * "1,000" → 1000
 * "1.000" → 1000
 * "1 234 567" → 1234567
 */
export function parseNumber(value) {
  if (value === null || value === undefined) return 0
  
  // Convert to string and remove spaces
  const s = String(value).replace(/\s/g, '')
  
  // Detect format by looking for comma and dot positions
  const lastCommaIndex = s.lastIndexOf(',')
  const lastDotIndex = s.lastIndexOf('.')
  
  let normalized = s
  
  // If both comma and dot exist
  if (lastCommaIndex > -1 && lastDotIndex > -1) {
    if (lastCommaIndex > lastDotIndex) {
      // German format: 1.234,50 → 1234.50
      normalized = s.replace(/\./g, '').replace(',', '.')
    } else {
      // US format: 1,234.50 → 1234.50
      normalized = s.replace(/,/g, '')
    }
  }
  // Only comma exists (could be decimal or thousands)
  else if (lastCommaIndex > -1) {
    // If comma is far from end (more than 3 chars), it's thousands separator
    if (s.length - lastCommaIndex > 3) {
      normalized = s.replace(/,/g, '')
    } else {
      // Otherwise it's decimal separator (allow comma as decimal)
      normalized = s.replace(',', '.')
    }
  }
  // Only dot exists (could be decimal or thousands)
  else if (lastDotIndex > -1) {
    // If dot is far from end (more than 3 chars), it's thousands separator
    if (s.length - lastDotIndex > 3) {
      normalized = s.replace(/\./g, '')
    } else {
      // Otherwise it's decimal separator - keep as is
    }
  }
  
  const n = Number(normalized)
  return Number.isNaN(n) ? 0 : n
}

/**
 * Format a number as an integer with thousands separator
 * @param {number|string} value - The numeric value to format
 * @returns {string} Formatted integer string
 */
export function formatInteger(value) {
  if (value === null || value === undefined) return '0'
  const n = Math.round(Number(value) || 0)
  return new Intl.NumberFormat('de-DE').format(n)
}

/**
 * Format a number as currency with symbol
 * @param {number|string} value - The numeric value to format
 * @param {string} currency - Currency code (default: 'UZS')
 * @returns {string} Formatted currency string
 */
export function formatCurrency(value, currency = 'UZS') {
  if (value === null || value === undefined) return '0 ' + currency
  const n = Number(value)
  if (Number.isNaN(n)) return String(value)
  
  const formatted = new Intl.NumberFormat('de-DE').format(n)
  return `${formatted} ${currency}`
}

