# Currency System Architecture & Best Practices

## System Design Overview

### Three-Layer Currency System
```
Layer 1: STORAGE (Database)
├── products → currency field (USD | UZS)
├── logs → currency field (USD | UZS), amount field
├── credits → currency field (USD | UZS), amount field
└── exchange_rate → live rate USD→UZS

Layer 2: CONVERSION (currencyUtils.js)
├── normalizeToBaseUzs() → Convert any amount to base currency (UZS)
├── convertFromBaseUzs() → Convert from UZS to display currency
├── calculateCreditTotals() → Mixed-currency summation
└── calculateInventoryTotal() → Mixed-currency inventory value

Layer 3: DISPLAY (React Components)
├── Dashboard → Uses normalized amounts for analytics
├── Store/Warehouse → Shows inventory value in display currency
├── Credits → Shows totals in display currency
└── All use useMemo with displayCurrency in dependencies
```

## Core Principles

### 1. Always Normalize First
**Principle**: Never aggregate mixed currencies directly. Always convert to base currency (UZS) first.

**Wrong ❌**
```javascript
let total = 0;
logs.forEach(log => {
  total += log.amount; // BUG: 1000 USD + 1000 UZS = 2000 ??? 
});
```

**Right ✓**
```javascript
let totalUzs = 0;
logs.forEach(log => {
  const inUzs = normalizeToBaseUzs(log.amount, log.currency, usdToUzs);
  totalUzs += inUzs; // 1000 USD = 11,000,000 UZS + 1000 UZS = 11,000,001 UZS ✓
});
```

### 2. Track Currencies Separately Until Final Conversion
**Principle**: Keep USD and UZS amounts separate. Only merge after both are in the same currency.

**Wrong ❌**
```javascript
// Sum USD and UZS together - LOSES INFORMATION
let total = 1000 + 1000; // 1000 USD + 1000 UZS??? No one knows.
```

**Right ✓**
```javascript
// Track separately
let totalUsd = 1000;  // 1000 USD
let totalUzs = 1000;  // 1000 UZS

// Convert to base when needed
let totalInUzs = (totalUsd * rate) + totalUzs;
```

### 3. Handle Missing Exchange Rates Safely
**Principle**: When exchange rate unavailable, exclude USD (return 0) rather than pass through raw amount.

**Wrong ❌**
```javascript
if (!usdToUzs) return amount; // BUG: Returns raw USD, treated as UZS later
```

**Right ✓**
```javascript
if (currency === 'USD' && (!usdToUzs || usdToUzs <= 0)) {
  console.warn('[normalizeToBaseUzs] USD amount but no valid exchange rate', { amount });
  return 0; // Safe: Excluded from calculation
}
return Math.round(amount * usdToUzs);
```

### 4. All Currency Displays Need Re-render Trigger
**Principle**: Any component displaying currency amounts must include `displayCurrency` in useMemo dependencies.

**Wrong ❌**
```javascript
const total = useMemo(() => {
  // Calculate currency amount
  return logs.reduce((sum, log) => sum + log.amount, 0);
}, [logs]); // BUG: Doesn't update when displayCurrency changes
```

**Right ✓**
```javascript
const total = useMemo(() => {
  const inUzs = logs.reduce((sum, log) => {
    return sum + normalizeToBaseUzs(log.amount, log.currency, usdToUzs);
  }, 0);
  return convertFromBaseUzs(inUzs, displayCurrency, usdToUzs);
}, [logs, displayCurrency, usdToUzs]); // ✓ Updates on currency change
```

## Currency Utility Functions

### normalizeToBaseUzs(amount, currency, usdToUzs)
**Purpose**: Convert any amount to base currency (UZS)
**Returns**: Amount in UZS (always)
**Safety**: Returns 0 for USD without valid rate

```javascript
// Examples:
normalizeToBaseUzs(1000, 'UZS', rate) → 1000 (unchanged)
normalizeToBaseUzs(1000, 'USD', 11000) → 11,000,000
normalizeToBaseUzs(1000, 'USD', null) → 0 (console warning)
```

### convertFromBaseUzs(amountInUzs, targetCurrency, usdToUzs)
**Purpose**: Convert from UZS to target currency
**Returns**: Amount in target currency
**Uses**: For final display after all aggregation done

```javascript
// Examples:
convertFromBaseUzs(11000000, 'UZS', rate) → 11,000,000
convertFromBaseUzs(11000000, 'USD', 11000) → 1000
```

### calculateCreditTotals(credits, displayCurrency, usdToUzs, filter)
**Purpose**: Sum mixed-currency credits correctly
**Returns**: { active: amount, all: amount } in display currency
**Pattern**: Normalizes → aggregates → converts

### calculateInventoryTotal(warehouse, store, displayCurrency, usdToUzs)
**Purpose**: Calculate total inventory value with mixed currencies
**Returns**: Total value in display currency
**Safety**: Handles products with different currencies

## Common Patterns

### Pattern 1: Aggregating Mixed Currencies
```javascript
const calculateTotal = (items) => {
  let totalUzs = 0;
  
  items.forEach(item => {
    const inUzs = normalizeToBaseUzs(item.amount, item.currency, usdToUzs);
    totalUzs += inUzs;
  });
  
  return convertFromBaseUzs(totalUzs, displayCurrency, usdToUzs);
};
```

### Pattern 2: Comparing Products Across Currencies
```javascript
const findExpensive = (products) => {
  // Normalize all prices to UZS for comparison
  const withNormalizedPrice = products.map(p => ({
    ...p,
    priceUzs: normalizeToBaseUzs(p.price, p.currency, usdToUzs)
  }));
  
  // Sort by normalized price
  return withNormalizedPrice.sort((a, b) => b.priceUzs - a.priceUzs);
};
```

### Pattern 3: Tracking Separate Currencies
```javascript
const trackCurrencies = (sales) => {
  let trackByUsd = {};
  let trackByUzs = {};
  
  sales.forEach(sale => {
    if (sale.currency === 'USD') {
      trackByUsd[sale.user] = (trackByUsd[sale.user] || 0) + sale.amount;
    } else {
      trackByUzs[sale.user] = (trackByUzs[sale.user] || 0) + sale.amount;
    }
  });
  
  // Only merge after conversion
  return Object.keys({...trackByUsd, ...trackByUzs}).map(user => ({
    user,
    totalUzs: (trackByUsd[user] || 0) * rate + (trackByUzs[user] || 0),
    totalUsd: (trackByUsd[user] || 0) + ((trackByUzs[user] || 0) / rate)
  }));
};
```

## Anti-Patterns (Never Do These)

### ❌ Anti-Pattern 1: Direct Currency Mixing
```javascript
const bad = (usdAmount, uzsAmount) => {
  return usdAmount + uzsAmount; // WRONG: Different scales!
};
// 1000 + 1000 = 2000 but is it meaningful? 1000 USD? 1000 UZS? BOTH?
```

### ❌ Anti-Pattern 2: Assuming Exchange Rate Always Available
```javascript
const bad = (amount, currency) => {
  if (currency === 'USD') return amount * rate; // CRASHES if rate is undefined
};
```

### ❌ Anti-Pattern 3: Missing Currency in Dependencies
```javascript
const bad = useMemo(() => {
  return calculateTotal(items, displayCurrency);
}, [items]); // BUG: Doesn't update when displayCurrency changes
```

### ❌ Anti-Pattern 4: Passing Through Unknown Currencies
```javascript
const bad = (amount, currency) => {
  if (currency === 'USD') return amount * rate;
  if (currency === 'UZS') return amount;
  return amount; // WRONG: Unknown currency silently treated as ??? 
};
```

### ❌ Anti-Pattern 5: Storing Converted Amounts in Database
```javascript
// WRONG: Storing already-converted amounts loses original currency info
{
  original_amount: 1000,
  converted_amount: 11000000, // ❌ What if exchange rate changes?
  currency: 'USD'
}

// RIGHT: Store original only, convert on read
{
  amount: 1000,
  currency: 'USD'
  // Convert on read: normalizeToBaseUzs(1000, 'USD', currentRate)
}
```

## Testing Guidelines

### Test Case 1: Exchange Rate Unavailable
```javascript
test('handles USD without exchange rate', () => {
  const result = normalizeToBaseUzs(1000, 'USD', null);
  expect(result).toBe(0); // Should exclude, not pass through
});
```

### Test Case 2: Mixed Currency Totals
```javascript
test('calculates mixed currency total', () => {
  const items = [
    { amount: 1000, currency: 'USD' },
    { amount: 5500000, currency: 'UZS' }
  ];
  // With rate 11000: (1000 * 11000) + 5500000 = 16500000
  const total = normalizeToBaseUzs(items[0].amount, items[0].currency, 11000)
              + normalizeToBaseUzs(items[1].amount, items[1].currency, 11000);
  expect(total).toBe(16500000);
});
```

### Test Case 3: Display Currency Toggle
```javascript
test('updates on display currency change', () => {
  const { rerender } = render(<Dashboard displayCurrency="UZS" />);
  expect(screen.getByText(/UZS/)).toBeInTheDocument();
  
  rerender(<Dashboard displayCurrency="USD" />);
  expect(screen.getByText(/USD/)).toBeInTheDocument();
});
```

## Performance Considerations

### Use useMemo for Expensive Calculations
```javascript
// BAD: Recalculates on every render
const expensive = logs.reduce((sum, log) => sum + normalizeToBaseUzs(...), 0);

// GOOD: Memoizes and only recalculates when dependencies change
const expensive = useMemo(() => {
  return logs.reduce((sum, log) => sum + normalizeToBaseUzs(...), 0);
}, [logs, displayCurrency, usdToUzs]);
```

### Cache Exchange Rate
```javascript
// useExchangeRate hook already caches rate
const { rate: usdToUzs } = useExchangeRate(); // ✓ Only fetches once, caches after

// Don't fetch rate in every component
const rate = useExchangeRate().rate; // ✓ Good
const rate = fetch('/api/rate').then(...); // ❌ Bad: Fetches every render
```

## Debugging Tips

### 1. Log Normalized Amounts
```javascript
console.log('Original:', 1000, 'USD');
console.log('Normalized:', normalizeToBaseUzs(1000, 'USD', 11000), 'UZS');
// Should see: 1000 USD → 11000000 UZS
```

### 2. Check Console Warnings
```javascript
// When this appears: "[normalizeToBaseUzs] USD amount but no valid exchange rate"
// → Exchange rate not loaded yet, USD amounts excluded
// → Chart will update once rate loads
```

### 3. Verify Dependency Arrays
```javascript
// In React DevTools, check useMemo dependencies
// Should include: [logs, displayCurrency, usdToUzs]
// Not just: [logs]
```

### 4. Test Extreme Values
```javascript
// Edge case: 0.01 USD
normalizeToBaseUzs(0.01, 'USD', 11000) → 110 (should round correctly)

// Edge case: Very large number
normalizeToBaseUzs(999999999, 'USD', 11000) → 10,999,999,989,000 (check for overflow)
```

## Migration Checklist for New Features

When adding new currency features:
- [ ] Use `normalizeToBaseUzs()` for all aggregations
- [ ] Include `displayCurrency` in useMemo dependencies
- [ ] Test with mixed USD/UZS data
- [ ] Test with missing exchange rate
- [ ] Add console warning if needed
- [ ] Document currency handling in component comments
- [ ] Add test cases for currency logic
- [ ] Run full build: `npm run build`
- [ ] Verify lint: `npm run lint`
