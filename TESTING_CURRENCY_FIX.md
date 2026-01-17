# Testing Guide: USD/UZS Currency Fix

## What Was Fixed
Fixed a critical bug where USD sales were treated as UZS in the "Daily Sales by Account" chart on the Dashboard. 

**Example of the bug:**
- User sells 1,000 USD worth of products (worth ~11,000,000 UZS)
- Chart shows: "Hamdamjon: 1.000 UZS (20%)" ❌ WRONG
- Should show: "Hamdamjon: 1.000 USD" or "11.000.000 UZS (20%)" ✓ CORRECT

## How the Fix Works

### 1. Currency Tracking is Now Separate
The system now tracks:
- **Original USD amounts** — kept as-is
- **Original UZS amounts** — kept as-is
- **Total in UZS** — only USD added if exchange rate available
- **Display value** — converted to selected display currency

### 2. Safe Exchange Rate Handling
- When USD is sold BUT exchange rate unavailable:
  - **Old behavior**: Used raw USD amount → treated as UZS (BUG)
  - **New behavior**: Excludes from total, shows warning in console (SAFE)
- When exchange rate IS available:
  - USD converted to UZS using: `USD * exchange_rate`
  - All totals include the converted USD properly

## Test Scenarios

### Scenario 1: Pure USD Sales (With Exchange Rate)
**Setup:**
1. Exchange rate loaded: 1 USD = 11,000 UZS
2. Create 3 transactions for user "Hamdamjon":
   - Sale 1: 1,000 USD
   - Sale 2: 1,500 USD  
   - Sale 3: 500 USD
   - Total: 3,000 USD = 33,000,000 UZS

**Expected Results in Chart:**
- **USD Display Mode**: 
  - Card header shows: "Total: $3,000"
  - Chart shows: "Hamdamjon" card with "$3,000 (100%)"
- **UZS Display Mode**:
  - Card header shows: "Total: 33.000.000 UZS"
  - Chart shows: "Hamdamjon" card with "33.000.000 UZS (100%)"
  - Cross-reference shows: "(≈ $3,000 USD)"

### Scenario 2: Mixed Currency Sales
**Setup:**
1. Exchange rate: 1 USD = 11,000 UZS
2. Create transactions:
   - Hamdamjon: 1,000 USD + 5,500,000 UZS = 16,500,000 UZS total
   - Karim: 500 USD = 5,500,000 UZS total
   - Total: 1,500 USD + 5,500,000 UZS = 22,000,000 UZS

**Expected Results in Chart:**
- **UZS Display Mode**:
  - Hamdamjon: "16.500.000 UZS (75%)" 
  - Karim: "5.500.000 UZS (25%)"
  - Total: "22.000.000 UZS"
  - Cross-reference: "(≈ $2,000 USD)"
  
- **USD Display Mode**:
  - Hamdamjon: "$1,500 USD (75%)"  
  - Karim: "$500 USD (25%)"
  - Total: "$2,000"
  - Cross-reference: "(≈ 22.000.000 UZS)"

### Scenario 3: Missing Exchange Rate
**Setup:**
1. Exchange rate unavailable/not loaded
2. Create USD sales:
   - Hamdamjon: 1,000 USD

**Expected Results:**
- Chart shows: "Hamdamjon: 0 UZS" (excluded because rate unavailable)
- Console shows warning: `[normalizeToBaseUzs] USD amount but no valid exchange rate`
- When exchange rate loads, chart updates immediately

## Verification Steps

### 1. Test in Dashboard
1. Open Dashboard page
2. Verify "Daily Sales by Account" chart displays correctly
3. Create test sales data (see scenarios above)
4. Verify amounts show in correct currency
5. Toggle display currency (USD ↔ UZS) and verify totals update

### 2. Check Console
1. Open browser Developer Tools (F12)
2. Go to Console tab
3. Create a USD sale without exchange rate
4. Verify warning appears: `[normalizeToBaseUzs] USD amount but no valid exchange rate`

### 3. Cross-Reference Verification
In UZS display mode:
- "Total: 33.000.000 UZS (≈ $3,000 USD)"
- Math check: 33,000,000 ÷ 11,000 = 3,000 ✓

In USD display mode:
- "Total: $3,000 (≈ 33.000.000 UZS)"
- Math check: 3,000 × 11,000 = 33,000,000 ✓

## Key Changes Made

### File: `src/utils/currencyUtils.js`
```javascript
// Line 20-30: normalizeToBaseUzs() function
// Changed: return n → return 0 when USD has no exchange rate
```

### File: `src/pages/Dashboard.jsx`
```javascript
// Line 119-203: dailySalesByAccount calculation
// Changed: Merged all amounts → Track USD/UZS separately
// Result: USD shows as USD, not as UZS
```

## Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| "Chart shows 0 UZS for USD sales" | Exchange rate not loaded | Wait for exchange rate API response or set manually |
| "Totals don't update on currency switch" | Missing displayCurrency in useMemo deps | Already fixed in all components |
| "Percentages don't sum to 100%" | Mixed currency with missing rate | Check console for warnings, verify exchange rate loaded |
| "Chart shows 1000 USD as 1000 UZS" | Old bug still present | Clear browser cache and rebuild: `npm run build` |

## Testing Checklist
- [ ] Pure USD sales display correctly in both currency modes
- [ ] Mixed USD + UZS sales calculate total correctly
- [ ] Percentages sum to 100% with mixed currencies
- [ ] Cross-reference currency shows equivalent value
- [ ] Chart updates when switching display currency
- [ ] Console shows warning when exchange rate unavailable
- [ ] No new lint or build errors

## Related Components Updated
- Dashboard.jsx — Daily sales by account chart
- currencyUtils.js — Central currency conversion logic
- Store.jsx — Inventory total with currency support
- Warehouse.jsx — Inventory total with currency support  
- Credits.jsx — Credit totals with currency support

## Next Steps
1. Run the app: `npm run dev`
2. Test with the scenarios above
3. Verify console warnings appear correctly
4. Check that toggling currency updates all displays
5. Confirm percentages and totals are accurate
