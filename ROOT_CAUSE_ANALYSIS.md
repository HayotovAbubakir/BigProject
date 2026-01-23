# ROOT CAUSE ANALYSIS & FIXES
## React + Supabase Inventory System
### Date: January 21, 2026

---

## ISSUE 1: CREDIT (NASIYA) SYSTEM BROKEN

### ROOT CAUSES:

#### 1a. Product name NOT displayed
**Location:** [src/pages/Credits.jsx](src/pages/Credits.jsx#L36)
**Root Cause:** Code checks `credit.product_name || credit.productName` but:
- CreditForm uses `product_name` field
- Supabase table column is `product_name`
- But Credits.jsx in Accounts.jsx FILTERS using `credit.credit_subtype` which doesn't exist
- **Database schema has NO `product_name` field in credits table!**

**Check:**
```sql
-- supabase/schema_fixed.sql line 82
-- credits table has: product_id (UUID), qty, unit_price
-- But NO product_name field!
```

**Fix:** Add `product_name TEXT` to credits table

---

#### 1b. Remaining credit amount does NOT become 0 when fully paid
**Location:** [src/pages/Credits.jsx](src/pages/Credits.jsx#L120)
**Root Cause:** When completing credit:
```javascript
const updates = { 
  completed: true, 
  completed_at: new Date().toISOString(), 
  completed_by: username, 
  bosh_toluv: amountVal  // Sets full payment
};
```

Problem: `remaining` is GENERATED ALWAYS column:
```sql
remaining NUMERIC GENERATED ALWAYS AS (amount - bosh_toluv) STORED
```

**But when you update bosh_toluv to equal amount, the generated column should auto-calculate to 0.**

The issue: Frontend shows `remaining = amount - bosh_toluv` but after page refresh, the Supabase-generated column is used. The logic should work, but...

**ACTUAL PROBLEM:** Accounts.jsx filters by `credit_subtype`:
```javascript
.filter(c => c.credit_subtype === 'olingan' && !c.completed)
```

But database has `credit_type`, NOT `credit_subtype`!

---

#### 1c. Account totals don't calculate
**Location:** [src/pages/Accounts.jsx](src/pages/Accounts.jsx#L28)
**Root Cause:**
```javascript
.filter(c => c.credit_subtype === 'olingan' && !c.completed)
```

**`credit_subtype` field DOES NOT EXIST in schema or data!**

Should be `credit_type`. And `credit_type` values are `'product'` or `'cash'`, NOT `'olingan'` or `'berilgan'`.

**The type distinction (olingan vs berilgan) is stored in `type` field in CreditForm but NOT persisted to database!**

---

### FIXES FOR ISSUE 1:

**1. Update schema to include product_name and store type**
```sql
ALTER TABLE credits
ADD COLUMN IF NOT EXISTS product_name TEXT,
ADD COLUMN IF NOT EXISTS credit_direction TEXT CHECK (credit_direction IN ('olingan', 'berilgan'));
```

**2. Update CreditForm submission to save type**
In Credits.jsx handleAdd:
```javascript
const handleAdd = (payload) => {
  const logData = { /* ... */ };
  // Ensure direction is saved
  payload.credit_direction = payload.type; // 'olingan' or 'berilgan'
  addCredit(payload, logData);
};
```

**3. Update Accounts.jsx filter**
```javascript
const totalDebtsUzs = state.credits
  .filter(c => c.credit_direction === 'olingan' && !c.completed)  // FIXED
  .reduce((sum, c) => { /* ... */ }, 0);

const totalReceivablesUzs = state.credits
  .filter(c => c.credit_direction === 'berilgan' && !c.completed)  // FIXED
  .reduce((sum, c) => { /* ... */ }, 0);
```

**4. Ensure product_name is stored**
In supabaseCredits.js insertCredit, ensure:
```javascript
const payload = {
  product_name: credit.product_name,  // Add this
  credit_direction: credit.type,      // Add this
  // ...rest
}
```

---

## ISSUE 2: SALES & PERSISTENCE BROKEN

### ROOT CAUSES:

#### 2a. Warehouse sales show 0 in account_by_sales
**Location:** [src/pages/Warehouse.jsx](src/pages/Warehouse.jsx) sell handler
**Root Cause:** The code calls `updateAccountBalance` and `updateDailySales` but:

1. RPC functions might not exist (migration not run)
2. If they fail silently, state is never persisted
3. Frontend calculates in reducer but Supabase isn't updated

**Current code catches errors but returns null:**
```javascript
export const updateAccountBalance = async (username, deltaUzs, deltaUsd = 0) => {
  try {
    const { data, error } = await supabase.rpc('update_user_balance', {...})
    if (error && error.message && error.message.includes('Could not find the function')) {
      console.warn('[updateAccountBalance] RPC function not found')
      return null  // <-- SILENTLY FAILS
    }
    return data
  } catch (err) {
    return null
  }
}
```

#### 2b. Data lost on refresh
**Root Cause:**
- `daily_sales` table exists in schema but:
  - No data ever written to it (RPC function missing or failing)
  - AppContext doesn't load daily_sales on init
  - Frontend state is lost after refresh

- `user_credentials.balance_uzs` exists but:
  - Not updated when sales happen
  - AppContext loads balances but they're always 0 (never updated)

**Current AppContext.jsx init:**
```javascript
const loadData = async () => {
  const [credits, warehouse, store, logs, clients, userBalances] = await Promise.all([...])
  // userBalances are loaded but they're always 0
  // No daily_sales data is loaded
}
```

---

### FIXES FOR ISSUE 2:

**1. Create PROPER Supabase tables (already in migration)**
Schema is correct - just needs to be run in Supabase

**2. Update supabaseAccounts.js to throw instead of silently fail**
```javascript
export const updateAccountBalance = async (username, deltaUzs, deltaUsd = 0) => {
  try {
    const { data, error } = await supabase.rpc('update_user_balance', {
      p_username: username.toLowerCase(),
      p_delta_uzs: Number(deltaUzs),
      p_delta_usd: Number(deltaUsd)
    })
    if (error) throw error
    return data
  } catch (err) {
    console.error('[updateAccountBalance] Failed:', err)
    throw err  // <-- THROW to parent handler
  }
}
```

**3. Add error handling in Warehouse.jsx**
```javascript
try {
  await insertLog(log);
  const { error: qtyErr } = await supabase
    .from('products')
    .update({ qty: newQty })
    .eq('id', payload.id);
  if (qtyErr) throw qtyErr;
  
  await updateAccountBalance(username, totalUzs, totalUsd);
  await updateDailySales(username, totalUzs, totalUsd);
  
  dispatch({ type: 'SELL_WAREHOUSE', payload: { id: payload.id, qty: payload.qty }, log });
  setSellItem(null);
} catch (err) {
  console.error('Sale failed:', err);
  notify('Error', err.message, 'error');
  // Don't dispatch if database operations failed
}
```

**4. Load daily_sales on app init**
In AppContext.jsx:
```javascript
const loadData = async () => {
  const [credits, warehouse, store, logs, clients, userBalances, dailySalesData] = 
    await Promise.all([
      getCredits(),
      getProducts('warehouse'),
      getProducts('store'),
      getLogs(),
      getClients(),
      getAllUserBalances(),
      supabase.from('daily_sales').select('*').eq('date', new Date().toISOString().slice(0, 10))  // TODAY
    ]);
  
  // Store daily_sales in state
  // Add to reducer: case 'SET_DAILY_SALES': return {...state, daily_sales: action.payload}
}
```

---

## ISSUE 3: LOGS SYSTEM BROKEN

### ROOT CAUSES:

**Location:** [src/firebase/supabaseLogs.js](src/firebase/supabaseLogs.js)
**Root Cause:** insertLog fails but doesn't throw:

```javascript
export const insertLog = async (log) => {
  try {
    const { data, error } = await supabase.from('logs').insert([logData]).select().single()
    if (error) throw error
    return data
  } catch (err) {
    console.error('[insertLog] Failed:', err)
    // Current: returns null silently
    // Should: throw so parent knows it failed
  }
}
```

Then in Warehouse.jsx:
```javascript
try { await insertLog(log) } catch (e) { console.warn('insertLog failed...', e) }
// ^^ CATCHES but doesn't stop sale - sale completes without log
```

### FIXES FOR ISSUE 3:

**1. Make insertLog throw**
```javascript
export const insertLog = async (log) => {
  if (!isSupabaseConfigured()) return null
  
  try {
    const logData = {
      id: log.id || crypto.randomUUID(),
      date: log.date || new Date().toISOString().slice(0, 10),
      time: log.time || new Date().toLocaleTimeString(),
      action: log.action,
      kind: log.kind,
      user_name: log.user_name,
      product_name: log.product_name,
      product_id: log.product_id,
      qty: log.qty,
      unit_price: log.unit_price,
      amount: log.amount,
      currency: log.currency,
      total_uzs: log.total_uzs,
      detail: log.detail,
      source: log.source,
      created_by: log.user_name
    }

    const { data, error } = await supabase
      .from('logs')
      .insert([logData])
      .select()
      .single()

    if (error) throw error
    console.log('[insertLog] Success:', data)
    return data
  } catch (err) {
    console.error('[insertLog] Error:', err)
    throw err  // <-- THROW, don't swallow
  }
}
```

**2. Handle log errors in Warehouse.jsx**
```javascript
try {
  // Log first
  await insertLog(log);
  
  // Then update DB
  await updateAccountBalance(username, totalUzs, totalUsd);
  await updateDailySales(username, totalUzs, totalUsd);
  
  // Then update state
  dispatch({ type: 'SELL_WAREHOUSE', ... });
} catch (err) {
  notify('Error', `Sale failed: ${err.message}`, 'error');
  // Sale is NOT recorded if anything fails
}
```

---

## ISSUE 4: PRICE MARKUP BUG

### ROOT CAUSES:

**Location:** [src/components/MoveToStoreForm.jsx](src/components/MoveToStoreForm.jsx#L14)
```javascript
const pref = (initial.price || 0) * 1.2  // <-- 20% MARKUP!
```

This is for **"Move to Store" dialog**, NOT "Sell" dialog.

When transferring from warehouse to store, the price is automatically marked up 20% for store pricing.

**WarehouseSellForm:** NO MARKUP (correct)
```javascript
setPrice(initial.price ? Number(initial.price) : 0)  // Direct price
```

**SellForm (Store):** NO MARKUP (correct)
```javascript
setPrice(initial?.price || '')  // Direct price
```

**MoveToStoreForm:** 20% MARKUP (intentional but confusing)
```javascript
const pref = (initial.price || 0) * 1.2  // For display in store
```

### ROOT CAUSE ANALYSIS:

User said "estimated price automatically adds 5-10%" but:
- Code shows 1.2x (20% markup) in MoveToStoreForm
- WarehouseSellForm shows NO markup
- SellForm shows NO markup

**Possible User Confusion:**
User might be:
1. Clicking "Move to Store" instead of "Sell" (this adds 20%)
2. Seeing a different form that has markup logic elsewhere

**SEARCH CONFIRMS:** Only MoveToStoreForm has `* 1.2` markup

### FIX:

If user doesn't want 20% markup on store transfer, remove it:
```javascript
// In MoveToStoreForm.jsx
const pref = (initial.price || 0)  // Remove * 1.2
setPrice(pref ? String(pref) : '')
```

OR add toggle:
```javascript
<TextField select label="Store price strategy" fullWidth>
  <MenuItem value="same">Keep same price</MenuItem>
  <MenuItem value="markup">Add 20% markup</MenuItem>
</TextField>
```

---

## ISSUE 5: LANGUAGE/I18N SYSTEM BROKEN

### ROOT CAUSES:

**Location:** [src/context/LocaleContext.jsx](src/context/LocaleContext.jsx)

LocaleContext is correctly implemented:
```javascript
const t = useCallback((key, vars) => {
  let val = dict[key]
  if (typeof val === 'undefined') return ''  // Returns empty string
  if (vars && typeof val === 'string') {
    Object.keys(vars).forEach(k => { val = val.replace(`{${k}}`, vars[k]) })
  }
  return val
}, [dict])
```

**But the problem is HOW components use `t()`:**

#### 5a. Missing translations keys
In [src/i18n/uz.json](src/i18n/uz.json):
- Line 74: `"credit_added": "Nasiya qo'shildi"`
- Line 75: `"credit_updated": "Nasiya yangilandi"`
- But NO KEYS for: `creditDirectionOlingan`, `creditDirectionBerish`
- No keys for product name in credits

#### 5b. Input placeholders don't change
In CreditForm:
```javascript
<TextField label={t('who')} fullWidth margin="dense" ... />
```

**But TextField doesn't re-render when `t()` changes if the component doesn't re-render.**

The issue: useLocale() gives current `t()` but component must re-render to see it.

**CURRENT:** Component uses `const { t } = useLocale()` which IS reactive.
**ACTUAL PROBLEM:** Missing translation keys causing empty strings to display.

#### 5c. Nested modals don't update language
When Dialog opens with nested form component, the nested component doesn't have useLocale hook.

**Example:**
```javascript
// Credits.jsx
const { t } = useLocale()  // <-- OK

// Inside: <CreditForm />
// CreditForm also has: const { t } = useLocale()  // <-- OK

// But if CreditForm is lazy or doesn't re-render...
```

#### 5d. Hard-coded strings
In Credits.jsx:
```javascript
<Typography variant="body2" color="textSecondary">
  {t('total_received')}: {formatMoney(initial.amount)} {initial.currency}
</Typography>
```

Many hard-coded Uzbek strings like "Soni", "Narx", "Jami" instead of using `t()`.

### FIXES FOR ISSUE 5:

**1. Add missing translation keys**

In [src/i18n/uz.json](src/i18n/uz.json):
```json
{
  "creditDirectionOlingan": "Olingan",
  "creditDirectionBerish": "Berilgan",
  "productName": "Mahsulot nomi",
  "total_received": "Jami olingan",
  "boshToluv": "Bosh to'lov",
  "paid": "To'langan",
  "remaining": "Qolgan",
  "how_much_to_pay": "Qancha to'lov qilish kerak?",
  "credit_new": "Yangi nasiya",
  "credit_edit": "Nasiya tahrirlash",
  "credit_receive_payment": "To'lov qabul qilish",
  "total_amount": "Jami miqdor",
  "down_payment_note": "Bosh to'lov izohı",
  "make_payment": "To'lov qilish",
  "type": "Turi",
  "location": "Joylashuvi",
  "selectProduct": "Mahsulot tanlang",
  "cancel": "Bekor",
  "save": "Saqlash",
  "complete": "Yakunlash",
  "edit": "Tahrirlash",
  "delete": "O'chirish",
  "completed": "Yakunlandi"
}
```

In [src/i18n/en.json](src/i18n/en.json):
```json
{
  "creditDirectionOlingan": "Received",
  "creditDirectionBerish": "Given",
  "productName": "Product name",
  "total_received": "Total received",
  "boshToluv": "Down payment",
  "paid": "Paid",
  "remaining": "Remaining",
  "how_much_to_pay": "How much to pay?",
  "credit_new": "New credit",
  "credit_edit": "Edit credit",
  "credit_receive_payment": "Receive payment",
  "total_amount": "Total amount",
  "down_payment_note": "Down payment note",
  "make_payment": "Make payment",
  "type": "Type",
  "location": "Location",
  "selectProduct": "Select product",
  "cancel": "Cancel",
  "save": "Save",
  "complete": "Complete",
  "edit": "Edit",
  "delete": "Delete",
  "completed": "Completed"
}
```

**2. Replace hard-coded strings in Credits.jsx**

```javascript
<Box sx={{ mb: 2, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
  <Typography variant="body2" sx={{ fontWeight: 500 }}>
    {credit.product_name || credit.productName}
  </Typography>
  <Box sx={{ display: 'flex', gap: 2, mt: 1, flexWrap: 'wrap', fontSize: '0.875rem' }}>
    {(credit.qty || credit.quantity) && (
      <Typography variant="caption">
        <strong>{t('qty')}:</strong> {credit.qty || credit.quantity}
      </Typography>
    )}
    {(credit.unit_price || credit.price) && (
      <Typography variant="caption">
        <strong>{t('unit_price')}:</strong> {(credit.unit_price || credit.price).toLocaleString()} {credit.currency || 'UZS'}
      </Typography>
    )}
    {credit.amount && (
      <Typography variant="caption">
        <strong>{t('amount')}:</strong> {credit.amount.toLocaleString()} {credit.currency || 'UZS'}
      </Typography>
    )}
  </Box>
</Box>
```

**3. Ensure all input labels use `t()`**

Already correct in CreditForm, but verify all components.

**4. Force re-render on locale change**

In LocaleContext.jsx (already correct - using useCallback ensures new `t` reference):
```javascript
const t = useCallback((key, vars) => { ... }, [dict])  // dict changes = new t
```

**5. Ensure CreditForm re-renders when locale changes**

Component already has `const { t } = useLocale()` which subscribes to locale changes, so this should work.

---

## SUMMARY TABLE

| Issue | Root Cause | Fix Location | Priority |
|-------|-----------|--------------|----------|
| 1a. Product name missing | `product_name` column missing from schema | schema_fixed.sql + supabaseCredits.js | CRITICAL |
| 1b. Remaining not 0 | `credit_subtype` field doesn't exist | Accounts.jsx + CreditForm + supabaseCredits.js | CRITICAL |
| 1c. Account totals broken | Filtering by wrong field name | Accounts.jsx + schema | CRITICAL |
| 2a. Warehouse sales = 0 | RPC functions failing silently | supabaseAccounts.js (throw) + Warehouse.jsx (error handling) | CRITICAL |
| 2b. Data lost on refresh | daily_sales not loaded + balances not persisted | AppContext init + migration | CRITICAL |
| 3. Logs empty | insertLog swallows errors | supabaseLogs.js + sale handlers | CRITICAL |
| 4. Price markup | User confusion with MoveToStore 20% markup | Remove * 1.2 or add toggle | LOW |
| 5a. Missing translations | Translation keys incomplete | i18n/uz.json + i18n/en.json | MEDIUM |
| 5b. Hard-coded strings | Using literal text instead of `t()` | Credits.jsx + CreditForm.jsx | MEDIUM |
| 5c. Nested modals | Components should use useLocale() | Verify all components have hook | LOW |

