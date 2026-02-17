import { isMeterCategory } from './productCategories'

/**
 * Centralized Currency Utilities
 * 
 * All calculations in the app should use these functions to ensure:
 * 1. Consistent currency conversion
 * 2. Proper handling of mixed currencies
 * 3. Accurate analytics and totals
 * 4. Correct display formatting
 */

/**
 * Normalize any amount to base currency (UZS)
 * @param {number} amount - The numeric amount
 * @param {string} currency - The original currency ('USD' or 'UZS')
 * @param {number} usdToUzs - Exchange rate (1 USD = ? UZS)
 * @returns {number} Amount in UZS. If USD amount but no rate available, returns 0 to prevent USD=UZS error
 */
export function normalizeToBaseUzs(amount, currency, usdToUzs) {
  const n = Number(amount || 0);
  const curr = (currency || 'UZS').toUpperCase();
  
  if (curr === 'USD') {
    // CRITICAL: If no exchange rate, must not treat USD as UZS!
    if (!usdToUzs || usdToUzs <= 0) {
      console.warn(`Cannot convert USD: exchange rate not available. USD amount ${n} will be excluded from calculations.`);
      return 0; // Return 0, not the raw amount - this prevents USD=UZS bug
    }
    return Math.round(n * usdToUzs);
  }
  
  // Already in UZS or unknown currency
  return Math.round(n);
}

/**
 * Convert from base currency (UZS) to target currency
 * @param {number} amountInUzs - Amount in UZS
 * @param {string} targetCurrency - Target currency ('USD' or 'UZS')
 * @param {number} usdToUzs - Exchange rate (1 USD = ? UZS)
 * @returns {number} Amount in target currency
 */
export function convertFromBaseUzs(amountInUzs, targetCurrency, usdToUzs) {
  const n = Number(amountInUzs || 0);
  const target = (targetCurrency || 'UZS').toUpperCase();
  
  if (target === 'USD') {
    if (!usdToUzs || usdToUzs <= 0) return n; // fallback
    return Number((n / usdToUzs).toFixed(2));
  }
  
  // Already in UZS or unknown currency
  return Math.round(n);
}

/**
 * Convert amount from one currency to another
 * @param {number} amount - The numeric amount
 * @param {string} fromCurrency - Source currency
 * @param {string} toCurrency - Target currency
 * @param {number} usdToUzs - Exchange rate
 * @returns {number} Converted amount
 */
export function convertCurrency(amount, fromCurrency, toCurrency, usdToUzs) {
  if (!fromCurrency || !toCurrency) return Number(amount || 0);
  
  const from = fromCurrency.toUpperCase();
  const to = toCurrency.toUpperCase();
  
  if (from === to) return Number(amount || 0);
  
  // Normalize to UZS first, then convert to target
  const amountInUzs = normalizeToBaseUzs(amount, from, usdToUzs);
  return convertFromBaseUzs(amountInUzs, to, usdToUzs);
}

/**
 * Calculate total value of a collection of items with mixed currencies
 * Returns both original currency breakdown and total in base currency
 * @param {Array} items - Array of items with properties: {amount, currency}
 * @param {number} usdToUzs - Exchange rate
 * @returns {Object} {totalUzs, totalUsd, breakdown: {uzs, usd}}
 */
export function calculateMixedCurrencyTotal(items, usdToUzs) {
  let totalUzs = 0;
  let usdAmount = 0;
  let uzsAmount = 0;
  
  items.forEach(item => {
    const amount = Number(item.amount || item.price || item.value || 0);
    const currency = (item.currency || 'UZS').toUpperCase();
    
    if (currency === 'USD') {
      usdAmount += amount;
      totalUzs += normalizeToBaseUzs(amount, 'USD', usdToUzs);
    } else {
      uzsAmount += amount;
      totalUzs += amount;
    }
  });
  
  const totalUsd = convertFromBaseUzs(totalUzs, 'USD', usdToUzs);
  
  return {
    totalUzs: Math.round(totalUzs),
    totalUsd: Number(totalUsd.toFixed(2)),
    breakdown: {
      uzs: Math.round(uzsAmount),
      usd: Number(usdAmount.toFixed(2))
    }
  };
}

/**
 * Calculate weighted average or sum in display currency
 * Useful for analytics where we need aggregates in a specific currency
 * @param {Array} items - Items with {amount/price, quantity, currency}
 * @param {string} displayCurrency - Display currency ('USD' or 'UZS')
 * @param {number} usdToUzs - Exchange rate
 * @param {string} operation - 'sum' or 'weighted_avg'
 * @returns {number} Result in display currency
 */
export function calculateInDisplayCurrency(items, displayCurrency, usdToUzs, operation = 'sum') {
  if (!items || items.length === 0) return 0;
  
  // First normalize everything to base UZS
  let totalInUzs = 0;
  let weightedQty = 0;
  
  items.forEach(item => {
    const amount = Number(item.amount || item.price || 0);
    const quantity = Number(item.quantity || item.qty || 1);
    const currency = (item.currency || 'UZS').toUpperCase();
    
    const amountInUzs = normalizeToBaseUzs(amount, currency, usdToUzs);
    
    if (operation === 'weighted_avg') {
      totalInUzs += amountInUzs * quantity;
      weightedQty += quantity;
    } else {
      totalInUzs += amountInUzs;
    }
  });
  
  if (operation === 'weighted_avg' && weightedQty > 0) {
    totalInUzs = totalInUzs / weightedQty;
  }
  
  // Convert to display currency
  return convertFromBaseUzs(totalInUzs, displayCurrency, usdToUzs);
}

/**
 * Get all inventory (warehouse + store) total value
 * @param {Array} warehouse - Warehouse products
 * @param {Array} store - Store products
 * @param {string} displayCurrency - Display currency
 * @param {number} usdToUzs - Exchange rate
 * @returns {Object} {totalInDisplay, breakdown: {usd, uzs, totalUzs}}
 */
export function calculateInventoryTotal(warehouse, store, displayCurrency, usdToUzs) {
  const allProducts = [...(warehouse || []), ...(store || [])];
  
  const items = allProducts.map(p => {
    const qty = Number(p.qty || 0)
    const price = Number(p.price || 0)

    if (isMeterCategory(p)) {
      // Value meter-category inventory in `dona` (piece) price when available.
      // Prefer `price_piece` (price per piece). If missing, fall back to per-meter valuation
      const packQty = Number(p.pack_qty || 0)
      const meterQty = Number(p.meter_qty ?? (packQty * qty))
      const pieceCount = packQty > 0 ? Math.ceil(meterQty / packQty) : qty
      const piecePrice = p.price_piece !== undefined && p.price_piece !== null ? Number(p.price_piece) : null

      if (piecePrice && piecePrice > 0) {
        return { amount: pieceCount * piecePrice, currency: p.currency || 'UZS' }
      }

      // fallback: value by meters using `price` (existing behavior)
      return { amount: meterQty * price, currency: p.currency || 'UZS' }
    }

    return {
      amount: qty * price,
      currency: p.currency || 'UZS'
    }
  });
  
  const totals = calculateMixedCurrencyTotal(items, usdToUzs);
  const totalInDisplay = convertFromBaseUzs(totals.totalUzs, displayCurrency, usdToUzs);
  
  return {
    totalInDisplay: Number(totalInDisplay.toFixed(2)),
    breakdown: totals.breakdown,
    totalUzs: totals.totalUzs,
    totalUsd: totals.totalUsd
  };
}

/**
 * Calculate credit totals with proper currency handling
 * @param {Array} credits - Credit records with {amount, currency, completed}
 * @param {string} displayCurrency - Display currency
 * @param {number} usdToUzs - Exchange rate
 * @param {string} filter - 'all', 'active', 'completed'
 * @returns {Object} {total, active, completed, breakdown}
 */
export function calculateCreditTotals(credits, displayCurrency, usdToUzs, filter = 'all') {
  const filtered = (credits || []).filter(c => {
    if (filter === 'active') return !c.completed;
    if (filter === 'completed') return c.completed;
    return true;
  });
  
  const totals = calculateMixedCurrencyTotal(
    filtered.map(c => ({ amount: c.amount, currency: c.currency })),
    usdToUzs
  );
  
  const totalInDisplay = convertFromBaseUzs(totals.totalUzs, displayCurrency, usdToUzs);
  
  return {
    total: Number(totalInDisplay.toFixed(2)),
    totalUzs: totals.totalUzs,
    totalUsd: totals.totalUsd,
    breakdown: totals.breakdown,
    count: filtered.length
  };
}

/**
 * Group items by currency and sum values
 * Useful for analytics
 * @param {Array} items - Items with {amount/price, currency}
 * @returns {Object} {usd: number, uzs: number}
 */
export function groupByCurrency(items) {
  const grouped = { usd: 0, uzs: 0 };
  
  (items || []).forEach(item => {
    const amount = Number(item.amount || item.price || 0);
    const currency = (item.currency || 'UZS').toUpperCase();
    
    if (currency === 'USD') {
      grouped.usd += amount;
    } else {
      grouped.uzs += amount;
    }
  });
  
  return grouped;
}

/**
 * Ensure a value has the correct currency field
 * @param {Object} item - Item to normalize
 * @param {string} defaultCurrency - Default currency if not present
 * @returns {Object} Item with guaranteed currency field
 */
export function ensureCurrency(item, defaultCurrency = 'UZS') {
  return {
    ...item,
    currency: item.currency || defaultCurrency
  };
}

/**
 * Format currency display with symbol
 * @param {number} amount - The amount to format
 * @param {string} currency - The currency code
 * @returns {string} Formatted string like "1,234.50 USD" or "1.234,50 UZS"
 */
export function formatCurrencyDisplay(amount, currency = 'UZS') {
  const { formatMoney } = require('./format');
  const curr = (currency || 'UZS').toUpperCase();
  const formatted = formatMoney(amount);
  
  if (curr === 'USD') {
    return `${formatted} $`;
  }
  return `${formatted} ${curr}`;
}
