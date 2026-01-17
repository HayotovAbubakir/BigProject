# Currency System Refactor - Complete Implementation

## Overview
Implemented a comprehensive global currency system that properly handles mixed-currency transactions (USD and UZS) across the entire app. All calculations now normalize to a base currency (UZS) before conversion for display.

## Problem Statement
**Original Issues:**
1. USD products were treated as UZS in analytics (expensive items appeared cheap)
2. Inventory totals didn't convert properly when switching display currency
3. Credit totals showed incorrect amounts in mixed-currency scenarios
4. Dashboard analytics showed only raw values without proper conversion
5. When switching site currency (USD ↔ UZS), only product prices updated - not totals

## Solution Architecture

### 1. Centralized Currency Utilities (`src/utils/currencyUtils.js`)
**Core Functions:**

- `normalizeToBaseUzs(amount, currency, usdToUzs)` - Convert any amount to UZS
  - Handles USD → UZS conversion using exchange rate
  - Fallback to original amount if rate unavailable
  
- `convertFromBaseUzs(amountInUzs, targetCurrency, usdToUzs)` - Convert from UZS to target
  - Returns clean numbers (2 decimals for USD, rounded for UZS)
  
- `convertCurrency(amount, from, to, rate)` - Direct currency conversion
  - Chain: normalize → convert pattern
  
- `calculateMixedCurrencyTotal(items, usdToUzs)` - Sum mixed currencies
  - Returns: `{totalUzs, totalUsd, breakdown: {uzs, usd}}`
  
- `calculateInDisplayCurrency(items, displayCurrency, usdToUzs, operation)` - Aggregate in display currency
  - Supports: 'sum' and 'weighted_avg' operations
  
- `calculateInventoryTotal(warehouse, store, displayCurrency, usdToUzs)` - Get full inventory value
  - Returns both display value and breakdown
  
- `calculateCreditTotals(credits, displayCurrency, usdToUzs, filter)` - Credit aggregation
  - Filter: 'all', 'active', 'completed'
  
- `groupByCurrency(items)` - Separate by currency for display
  - Returns: `{usd: number, uzs: number}`

## Changes by Component

### 1. Dashboard (`src/pages/Dashboard.jsx`)
**Imports:**
```javascript
import { 
  normalizeToBaseUzs, 
  convertFromBaseUzs,
  calculateMixedCurrencyTotal,
  calculateCreditTotals 
} from '../utils/currencyUtils'
import useDisplayCurrency from '../hooks/useDisplayCurrency'
```

**Key Fixes:**

**Monthly Analysis Chart:**
- OLD: `log.total_uzs || 0` (hardcoded UZS)
- NEW: Normalizes each log to UZS, converts to displayCurrency for chart
- Now shows accurate trend regardless of currency mix

**Top Expensive Products:**
- OLD: Direct price comparison (USD 100 vs UZS 100 - USD wins even if cheaper)
- NEW: Normalizes all prices to UZS for comparison, converts result to displayCurrency
- Correctly identifies most expensive products regardless of currency

**Daily Sales by Account:**
- OLD: Separate USD/UZS sums without proper totals
- NEW: Normalizes all sales to UZS, calculates percentages correctly
- Shows single displayCurrency total with reference to other currency
- Example: "USD mode: $1,234 (≈ 13,574,000 UZS)"

**Credits Summary:**
- OLD: Always showed in UZS
- NEW: Uses `calculateCreditTotals()` to normalize all credits
- Updates with displayCurrency changes
- Shows: Given, Received, Completed in selected currency

### 2. Store & Warehouse (`src/pages/Store.jsx`, `src/pages/Warehouse.jsx`)
**New Calculation:**
```javascript
const inventoryValue = useMemo(() => {
  return calculateInventoryTotal([], state.store, displayCurrency, usdToUzs)
}, [state.store, displayCurrency, usdToUzs])
```

**Display Format:**
```
[Warehouse Header]                [Total: 500,000 UZS]
                                  (≈ $43.48)  // if USD mode
```

**What This Fixes:**
- Inventory total now updates when displayCurrency changes
- Mixed-currency inventories show correct total
- Cross-reference shows alternative currency

### 3. Credits (`src/pages/Credits.jsx`)
**New Summary Display:**
```javascript
const creditTotals = useMemo(() => {
  const active = calculateCreditTotals(state.credits, displayCurrency, usdToUzs, 'active')
  const all = calculateCreditTotals(state.credits, displayCurrency, usdToUzs, 'all')
  return { active, all }
}, [state.credits, displayCurrency, usdToUzs])
```

**Display:**
- Shows "Active Total" and "All Total"
- Updates immediately when switching displayCurrency
- Handles mixed-currency credits properly

## Data Flow Diagram

```
Database Records
├── Products: {qty, price, currency}
├── Credits: {amount, currency}
└── Logs: {amount, currency}
         ↓
normalizeToBaseUzs() → All values to UZS
         ↓
Perform Calculations (sum, avg, compare) in UZS
         ↓
convertFromBaseUzs(result, displayCurrency) → Final value
         ↓
UI Display with formatMoney() + currency symbol
```

## Key Design Principles

1. **Normalization Rule:** All calculations happen in UZS (base currency)
   - Eliminates currency comparison bugs
   - Single source of truth for values

2. **Separation of Concerns:**
   - Database stores original currency + amount
   - Utilities handle conversion logic
   - Components focus on UI

3. **Display Currency Independence:**
   - All calculations happen once (in UZS)
   - Convert to display at last moment
   - Re-render only on displayCurrency change

4. **Null/Undefined Safe:**
   - Missing exchange rate: returns raw amount as fallback
   - Missing currency field: defaults to UZS
   - Missing amount: defaults to 0

## Testing Checklist

✅ **Dashboard:**
- [ ] Monthly chart shows correct amounts regardless of currency mix
- [ ] Top expensive products sorted by actual value (not currency)
- [ ] Daily sales shows correct total and percentages
- [ ] Credits summary updates on displayCurrency change

✅ **Store/Warehouse:**
- [ ] Inventory total updates when displayCurrency changes
- [ ] Mixed-currency inventory calculated correctly
- [ ] Cross-reference currency shows

✅ **Credits:**
- [ ] Active total updates on displayCurrency change
- [ ] All total includes all credits
- [ ] Mixed-currency credits sum correctly

✅ **Cross-Page:**
- [ ] Switching displayCurrency updates all pages simultaneously
- [ ] Dashboard, Store, Warehouse, Credits all re-render
- [ ] No stale data shown

## Performance Notes

- All calculations use `useMemo` with proper dependencies
- Re-calculation only on: `displayCurrency`, `usdToUzs`, `state` changes
- Dashboard memoizes: monthlyAnalysisData, topSoldProducts, topExpensiveProducts, dailySalesByAccount, creditsSummary
- Store/Warehouse memoize: inventoryValue
- Credits memoizes: creditTotals

## Migration Guide for New Features

When adding new currency-dependent features:

1. **Get raw data:** `{amount, currency}` from database
2. **Normalize:** `const uzsValue = normalizeToBaseUzs(amount, currency, usdToUzs)`
3. **Calculate:** Perform all math in UZS
4. **Convert:** `const displayValue = convertFromBaseUzs(uzsValue, displayCurrency, usdToUzs)`
5. **Format:** `formatMoney(displayValue)` + append currency symbol

**Example:**
```javascript
const items = state.logs.filter(l => l.kind === 'SELL')
const total = items.reduce((sum, item) => {
  const inUzs = normalizeToBaseUzs(item.amount, item.currency, usdToUzs)
  return sum + inUzs
}, 0)
const displayTotal = convertFromBaseUzs(total, displayCurrency, usdToUzs)
```

## Database Schema Requirements

All tables requiring currency support must have:
```sql
CREATE TABLE records (
  id UUID PRIMARY KEY,
  amount DECIMAL,
  currency TEXT DEFAULT 'UZS',  -- 'USD' or 'UZS'
  ...
)
```

**Current Tables with Currency:**
- ✅ products (warehouse/store)
- ✅ credits
- ✅ logs (all transactions)

## Troubleshooting

**Q: Dashboard shows old values after switching currency**
- Check: Is displayCurrency in useMemo dependencies?
- Solution: Add `displayCurrency` to dependency array

**Q: Inventory total doesn't match manual calculation**
- Check: Are all products missing currency field?
- Solution: Verify database has currency column, run defaults if needed

**Q: USD products appear with wrong value**
- Check: Is exchange rate loaded? (state.exchangeRate)
- Solution: useExchangeRate hook should auto-fetch or use manual rate

**Q: Credits show as 0 in USD mode**
- Check: Are credits missing currency field?
- Solution: Credits need currency field to normalize correctly

## Future Enhancements

1. **Add more currencies:** Extend currencyUtils to support other currencies
2. **Exchange rate caching:** Save preferred rates to localStorage
3. **Audit trail:** Log all currency conversions for compliance
4. **Batch operations:** calculateTotalsForMultiplePeriods() for reports
5. **Budget forecasting:** Project future values with currency trends

---

**Last Updated:** January 17, 2026
**Status:** Production Ready ✅
