# Currency Bug Fix Summary

## Problem Reported
User reported that sales by account were showing incorrect amounts:
- **Expected**: "1.000 USD" or "1.000 USD = 1,000,000 UZS" (1000 USD * exchange rate)
- **Actual**: "1.000 UZS (20%)" — USD amounts treated as UZS without conversion

Translation of user report: "акаунтлар бўйича сотувда баривiір усз*усд қилинмайабди усд = усз хатоси қилиньябди"
"Sales by account are not converting USD*exchange_rate to UZS correctly - USD = UZS error"

## Root Cause
The `normalizeToBaseUzs()` function in `currencyUtils.js` was returning the raw USD amount when no exchange rate was available, causing USD values to be treated identically to UZS values (100x difference in actual value!).

Example:
- 1000 USD sale logged without exchange rate available
- Old behavior: `normalizeToBaseUzs(1000, 'USD', undefined)` → returns `1000` (raw amount)
- This `1000` was then treated as UZS in calculations = ERROR
- New behavior: `normalizeToBaseUzs(1000, 'USD', undefined)` → returns `0` (prevents mixing currencies)

## Fixes Applied

### 1. Fixed `normalizeToBaseUzs()` in `src/utils/currencyUtils.js` (Line 20-30)
```javascript
// BEFORE: Returned raw USD amount when rate unavailable
return n; // ❌ BUG: Returns raw 1000, which is treated as UZS

// AFTER: Returns 0 to prevent USD from being treated as UZS
if (currency === 'USD' && (!usdToUzs || usdToUzs <= 0)) {
  console.warn('[normalizeToBaseUzs] USD amount but no valid exchange rate', { amount: n, usdToUzs });
  return 0; // ✓ SAFE: Excludes from calculation rather than mixing currencies
}
return Math.round(n * usdToUzs);
```

**Why this fix works:**
- When exchange rate is unavailable for USD sales, exclude them from totals (return 0)
- This prevents USD from being treated as UZS
- The `dailySalesByAccount` calculation then properly tracks them separately

### 2. Updated `dailySalesByAccount` Calculation in `src/pages/Dashboard.jsx` (Lines 119-203)

Changed from summing all currencies together to tracking USD and UZS separately:

**Key Changes:**
```javascript
// Track currencies separately instead of merging
accountSales[user] = {
  usd: 0,          // Original USD amounts
  uzs: 0,          // Original UZS amounts  
  totalUzs: 0,     // Total in UZS (only USD added if rate available)
  displayValue: 0  // Value in display currency
}

// When adding a sale:
if (saleCurrency === 'USD') {
  accountSales[user].usd += Amount;
  // Only add to totalUzs if exchange rate available
  if (usdToUzs && usdToUzs > 0) {
    accountSales[user].totalUzs += Math.round(Amount * usdToUzs);
  }
} else {
  accountSales[user].uzs += Amount;
  accountSales[user].totalUzs += Amount;
}

// Display the correct value based on displayCurrency
if (displayCurrency === 'USD') {
  accountDisplayValue = account.usd + (account.uzs > 0 && usdToUzs > 0 ? account.uzs / usdToUzs : 0);
} else {
  accountDisplayValue = account.uzs + (account.usd > 0 && usdToUzs > 0 ? account.usd * usdToUzs : 0);
}
```

**What this achieves:**
- USD sales displayed as USD (not UZS)
- Percentages calculated correctly based on converted values
- Chart shows correct amounts in selected display currency
- Cross-reference shows equivalent in other currency

### 3. Removed Unused Import from Dashboard.jsx
Removed `calculateMixedCurrencyTotal` and `calculateInventoryTotal` imports since they weren't used in the Dashboard page.

## Testing the Fix

### Scenario 1: USD-Only Sales
- Create 3 sales for user "Hamdamjon" with 1000 USD each (no UZS)
- Exchange rate is 11,000 UZS per USD (or unavailable)
- Expected chart display:
  - USD mode: "3,000 USD (100%)"
  - UZS mode: "33,000,000 UZS (100%)" if rate available, or "0 UZS" if rate unavailable with warning

### Scenario 2: Mixed Currency Sales  
- Create 2 sales for "Hamdamjon": 1000 USD + 5,000,000 UZS
- Exchange rate: 11,000 UZS per USD
- Expected in UZS display: "16,000,000 UZS" (1000*11,000 + 5,000,000)
- Expected in USD display: "1,454.55 USD" (11,000,000/11,000 + 1000)

### Scenario 3: Missing Exchange Rate
- Create USD sales when exchange rate is not loaded/unavailable
- Old behavior: USD treated as UZS (expensive products appear cheap)
- New behavior: USD amounts excluded from totals with console warning

## Files Modified
1. **src/utils/currencyUtils.js** — Fixed `normalizeToBaseUzs()` function
2. **src/pages/Dashboard.jsx** — Rewrote `dailySalesByAccount` calculation to track currencies separately
3. **src/pages/Dashboard.jsx** — Cleaned up imports

## Build Status
✓ Build succeeded (14.97s)
✓ No new lint errors introduced
✓ All chunks compile correctly

## Verification Commands
```bash
# Lint check
npm run lint

# Build
npm run build

# Run locally
npm run dev
```

## Notes for Future Development
- **Always track USD and UZS separately** until final conversion
- **Never assume USD can be treated as UZS** — they differ by ~100x
- **When exchange rate unavailable**, exclude USD from calculations (return 0) rather than pass through raw amount
- **All currency aggregations** should use `normalizeToBaseUzs()` to ensure consistent conversion
- **All components displaying currency** should include `displayCurrency` in useMemo dependencies for re-render on currency switch
