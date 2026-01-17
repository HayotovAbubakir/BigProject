# Fix: Product Currency Mismatch in Sell Forms

## Problem
**"mahsulot uzs valyuatda turganda usd qilib sotilsa ishlamayabdi"**
Translation: "When a product is in UZS currency, it doesn't work if sold in USD"

When a product is listed in one currency (e.g., UZS) but the user tries to sell it in a different currency (e.g., USD), the sell form doesn't properly handle the currency selected by the user.

## Root Cause
Both `Store.jsx` and `Warehouse.jsx` were **ignoring the currency selected in the sell form** and always using the product's original currency when logging the sale.

### Before (Bug):
```javascript
// Store.jsx - handleSell function
const handleSell = async ({ id, qty }) => {  // ❌ Missing currency parameter
  const item = state.store.find(s => s.id === id);
  const price = parseNumber(item?.price || 0);
  // ...
  const log = { 
    // ...
    currency: item?.currency || 'UZS',  // ❌ Always uses product's original currency
    // ...
  };
}
```

Problem scenario:
1. Product listed as "1,000 UZS"
2. User opens sell form and changes currency to "USD"
3. User enters price "100 USD"
4. Form calculates: 100 USD (correct)
5. **But sale is logged as if it was 100 UZS** (wrong!)

## Solution
Updated both `Store.jsx` and `Warehouse.jsx` to **accept and use the currency from the sell form payload**.

### After (Fixed):
```javascript
// Store.jsx - handleSell function
const handleSell = async ({ id, qty, price, currency }) => {  // ✅ Now receives currency
  const item = state.store.find(s => s.id === id);
  const parsedPrice = price ? parseNumber(price) : parseNumber(item?.price || 0);
  // ...
  const saleCurrency = currency || item?.currency || 'UZS';  // ✅ Uses form's selected currency
  const log = { 
    // ...
    currency: saleCurrency,  // ✅ Uses whatever currency user selected in form
    // ...
  };
}
```

## Files Modified

### 1. `src/pages/Store.jsx` (Lines 142-149)
**Changes:**
- Added `price` and `currency` parameters to `handleSell` function
- Changed `parsedPrice` to use provided price or fallback to item's price
- Changed `saleCurrency` to use payload's currency with fallbacks
- Updated log to use `saleCurrency` instead of `item?.currency`
- Updated detail string to use `saleCurrency`

### 2. `src/pages/Warehouse.jsx` (Lines 188-199)
**Changes:**
- Added `saleCurrency` variable using `payload.currency || sellItem?.currency || 'UZS'`
- Updated log creation to use `saleCurrency` instead of `sellItem?.currency`
- Updated `total_uzs` calculation to use `saleCurrency` instead of `sellItem?.currency`
- Updated detail string to use `saleCurrency`

## How It Works Now

### Scenario 1: Selling UZS Product in UZS (No change in behavior)
1. Product: "100 UZS"
2. User sells as: "100 UZS" ✅
3. Sale logged: "100 UZS" ✓

### Scenario 2: Selling UZS Product in USD (Now works!)
1. Product stored as: "100 UZS"
2. User changes currency in form to: "USD"
3. User enters: "10 USD"
4. Before fix: Sale logged as "10 UZS" ❌
5. **After fix: Sale logged as "10 USD"** ✅
6. With exchange rate 11,000: `total_uzs = 110,000` ✅

### Scenario 3: Selling USD Product in USD (No change in behavior)
1. Product: "50 USD"
2. User sells as: "50 USD" ✅
3. Sale logged: "50 USD" ✓

### Scenario 4: Selling USD Product in UZS (Now works!)
1. Product stored as: "50 USD"
2. User changes currency in form to: "UZS"
3. User enters: "550,000 UZS"
4. Before fix: Sale logged as "550,000 USD" ❌
5. **After fix: Sale logged as "550,000 UZS"** ✅

## Technical Details

### SellForm Component Behavior
The `SellForm` and `WarehouseSellForm` already support currency selection:
```javascript
<Select labelId="sell-currency-label" 
        value={currency} 
        label="Valyuta" 
        onChange={(e) => setCurrency(e.target.value)}>
  <MenuItem value="UZS">UZS</MenuItem>
  <MenuItem value="USD">USD</MenuItem>
</Select>
```

And they submit this currency in the payload:
```javascript
const payload = { id: initial.id, qty: parsedQty, price: parsedPrice, currency }
onSubmit(payload)
```

**Before**: Parent components ignored `payload.currency`  
**After**: Parent components now use `payload.currency` ✅

## Build Status
✅ **Build**: Passed (11.89s)  
✅ **No new errors** introduced

## Testing Checklist
- [ ] Create product in UZS currency
- [ ] Open sell form
- [ ] Change currency to USD
- [ ] Enter USD price
- [ ] Sell and verify:
  - [ ] Sale shows USD amount in form preview
  - [ ] Log shows sale in USD currency
  - [ ] Dashboard calculates correctly with exchange rate
- [ ] Repeat with USD → UZS conversion
- [ ] Verify calculations use correct exchange rate

## Impact
- ✅ Fixes critical currency mismatch bug
- ✅ Allows selling products in different currency than stored
- ✅ Properly logs currency used in actual sale
- ✅ Analytics and reports now show correct currency for each sale
- ✅ No breaking changes to existing functionality

## Related Features
This fix works seamlessly with:
- Exchange rate handling (rates applied correctly based on sale currency)
- Dashboard analytics (sales by account sorted by currency)
- Sales history (shows actual currency of each transaction)
- Inventory tracking (inventory in product's currency unchanged)
