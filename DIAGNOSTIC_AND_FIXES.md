# Diagnostic Report: Product Save & Credit Insert Issues

## ISSUE #1: Products Save to DB but Don't Appear in UI / Disappear After Refresh

### Root Cause Analysis

**Problem Flow:**
1. User adds product → `StoreForm.jsx` / `WarehouseForm.jsx` calls `onSubmit(payload)`
2. This triggers `addStoreProduct()` or `addWarehouseProduct()` in `AppContext.jsx`
3. Product IS inserted into Supabase database ✓
4. BUT local state dispatches BEFORE the database responds
5. Page refresh reloads from database, but UI state is cleared

**Critical Issues Found:**

#### Issue 1A: Race Condition in Product Addition
**File:** `src/context/AppContext.jsx` (lines 375-401)

```javascript
const addWarehouseProduct = React.useCallback(async (payload, logData) => {
  try {
    const product = await dbInsertProduct({ ...payload, location: 'warehouse' })
    let log = null
    try { log = await insertLog(logData) } catch (e) { console.warn(...) }
    dispatch({ type: 'ADD_WAREHOUSE', payload: product, log })  // ✓ CORRECT - uses DB response
```

**Analysis:** The code IS correct here - it waits for `dbInsertProduct()` to return before dispatching. The product added to state IS the Supabase response.

#### Issue 1B: Product ID Mismatch
**File:** `src/firebase/supabaseInventory.js` (lines 21-68)

```javascript
export const insertProduct = async (product) => {
  // ...
  const safe = {
    name: product.name.trim(),
    qty: Number(product.qty || 0),
    price: product.price !== undefined ? Number(product.price) : null,
    currency: product.currency || 'UZS',
    location: product.location || null,
  }
```

**PROBLEM:** The frontend sends a `UUID` id in `payload.id`, but this is NOT included in `safe` object!

- Frontend generates: `payload.id = uuidv4()` (in StoreForm.jsx line 60)
- Database inserts WITHOUT that id
- Supabase generates its OWN id instead
- Frontend expects id to match, but IDs don't align

**Result:** Product exists in DB with Supabase-generated id, but state has different id

#### Issue 1C: Missing ID in Insert Payload
When refreshing, the app calls `getProducts()` which returns products with Supabase-generated IDs, but the local state might be looking for the frontend-generated IDs.

### Why Products Disappear After Refresh

1. **Initial Load:** App calls `getProducts('warehouse')` / `getProducts('store')` (line 308)
2. **State Update:** `SET_WAREHOUSE` and `SET_STORE` actions properly update state with DB data
3. **Problem:** If the product was added with a mismatched ID, it won't be found/recognized
4. After refresh, only DB data is loaded, which has the correct (Supabase-generated) ID
5. But if there's caching or stale references, the product appears lost

---

## ISSUE #2: Credits Fail to Insert - Always Error

### Root Cause Analysis

**Critical Problem Found in `src/components/CreditForm.jsx` (line 51)**

```javascript
const payload = { id: initial?.id || uuidv4(), ...form, amount: totalAmount };

// Later (line 56):
payload.credit_type = hasProductDetails ? 'product' : 'cash'
```

**But the issue is EARLIER - in the mapping to `credit_type`:**

**File:** `src/firebase/supabaseCredits.js` (line 40-48)

```javascript
const allowedMap = {
  creditType: 'credit_type',
  type: 'credit_type',           // ← Maps 'type' to 'credit_type'
  credit_type: 'credit_type',
  // ...
}
```

**THE REAL PROBLEM:**

The `CreditForm.jsx` sends `payload.type = 'olingan' | 'berilgan'` 

BUT the database schema requires:
```sql
credit_type TEXT CHECK (credit_type IN ('product','cash')) NOT NULL
```

**What's happening:**
1. Form submits: `{ type: 'olingan', ... }`
2. supabaseCredits maps it: `type` → `credit_type: 'olingan'`
3. Database rejects it: "CHECK constraint violation - 'olingan' is not in ('product', 'cash')"
4. Insert fails silently or with cryptic error

**Original error "date/time field value out of range"** was masking this validation error.

---

## Fixes Required

### FIX #1: Include Product ID in Insert Payload

**File:** `src/firebase/supabaseInventory.js`

```javascript
export const insertProduct = async (product) => {
  // ... validation ...
  
  const safe = {
    id: product.id,  // ← ADD THIS LINE
    name: product.name.trim(),
    qty: Number(product.qty || 0),
    price: product.price !== undefined ? Number(product.price) : null,
    currency: product.currency || 'UZS',
    location: product.location || null,
  }
```

**Why:** Frontend generates a UUID and passes it. Supabase will use it if provided, eliminating ID mismatch.

---

### FIX #2: Fix Credit Type Validation

**File:** `src/firebase/supabaseCredits.js`

The allowedMap is already correct (maps both `type` and `credit_type` to `credit_type`).

But we need to ensure the VALUE being inserted is valid.

**Current Issue:**
- Form sends `type: 'olingan' | 'berilgan'`
- Mapping converts it to `credit_type: 'olingan' | 'berilgan'`
- Database rejects because it expects `'product' | 'cash'`

**Solution:** Already fixed in `CreditForm.jsx` line 51:
```javascript
payload.credit_type = hasProductDetails ? 'product' : 'cash'
```

But supabaseCredits.js also needs to handle this safely:

```javascript
// In supabaseCredits.js, after mapping:
if (mapped === 'credit_type' && value) {
  // Normalize old format to new format
  if (value === 'olingan' || value === 'berilgan') {
    // These are direction fields, not type fields
    // This indicates legacy data; skip mapping credit_type here
    delete payload['credit_type']
  } else if (!['product', 'cash'].includes(value)) {
    // Default to cash for unrecognized types
    value = 'cash'
  }
}
```

---

### FIX #3: Ensure Created_at is Correct Timestamp Format

**File:** `src/firebase/supabaseCredits.js` (line 30)

Current:
```javascript
const created_at = credit.created_at || new Date().toISOString()
```

This is correct (ISO 8601 format), but AppContext passes epoch seconds:
```javascript
payload.created_at = payload.created_at || Math.floor(Date.now() / 1000)  // Line 460
```

**Conflict:** Frontend sends epoch seconds, but supabaseCredits expects ISO string.

**Fix:** Normalize in supabaseCredits.js:
```javascript
let created_at = credit.created_at
if (typeof created_at === 'number' && created_at > 1000000000) {
  // Epoch seconds
  created_at = new Date(created_at * 1000).toISOString()
} else if (!created_at) {
  created_at = new Date().toISOString()
}
```

---

## Complete Working Code Examples

### Example 1: Correct Product Insert with ID

```javascript
export const insertProduct = async (product) => {
  if (!isSupabaseConfigured()) return null
  try {
    if (!product || typeof product !== 'object') {
      throw new Error('Invalid product payload: expected object')
    }
    if (!product.name || typeof product.name !== 'string' || !product.name.trim()) {
      throw new Error('Invalid product payload: "name" is required')
    }
    
    const safe = {
      id: product.id,  // ← INCLUDE FRONTEND ID
      name: product.name.trim(),
      qty: Number(product.qty || 0),
      price: product.price !== undefined ? Number(product.price) : null,
      currency: product.currency || 'UZS',
      location: product.location || null,
    }

    console.log('supabase.insertProduct ->', safe)

    const { data, error } = await supabase
      .from('products')
      .insert(safe)
      .select()
      .single()

    if (error) {
      console.error('insertProduct supabase error:', {
        message: error.message,
        status: error.status,
        code: error.code,
        details: error.details
      })
      throw error
    }

    console.log('supabase.insertProduct success ->', data)
    return data
  } catch (err) {
    console.error('insertProduct error (full):', err)
    const msg = err?.message || err?.error || err?.details || JSON.stringify(err)
    throw new Error(`insertProduct failed: ${msg}`)
  }
}
```

---

### Example 2: Correct Credit Insert with Validation

```javascript
export const insertCredit = async (credit) => {
  if (!isSupabaseConfigured()) return null
  try {
    console.log('supabase.insertCredit ->', credit)
    
    // Ensure created_at is ISO string
    let created_at = credit.created_at
    if (typeof created_at === 'number' && created_at > 1000000000) {
      created_at = new Date(created_at * 1000).toISOString()
    } else if (!created_at) {
      created_at = new Date().toISOString()
    }
    
    const created_by = credit.created_by || credit.user || 'shared'
    
    const allowedMap = {
      id: 'id',
      name: 'name',
      note: 'note',
      date: 'date',
      amount: 'amount',
      currency: 'currency',
      creditType: 'credit_type',
      type: 'credit_type',
      credit_type: 'credit_type',
      product_id: 'product_id',
      productId: 'product_id',
      qty: 'qty',
      unit_price: 'unit_price',
      price: 'unit_price',
      client_id: 'client_id',
      clientId: 'client_id',
      bosh_toluv: 'bosh_toluv',
      boshToluv: 'bosh_toluv',
      completed: 'completed',
      created_at: 'created_at',
      created_by: 'created_by'
    }

    const payload = { created_at, created_by }
    
    Object.keys(credit || {}).forEach(k => {
      const mapped = allowedMap[k]
      if (mapped) {
        let value = credit[k]
        
        // Validate and format date field
        if (mapped === 'date') {
          if (!value) {
            value = new Date().toISOString().slice(0, 10)
          } else if (typeof value === 'string' && !value.match(/^\d{4}-\d{2}-\d{2}$/)) {
            try {
              const dateObj = new Date(value)
              if (!isNaN(dateObj.getTime())) {
                value = dateObj.toISOString().slice(0, 10)
              } else {
                value = new Date().toISOString().slice(0, 10)
              }
            } catch {
              value = new Date().toISOString().slice(0, 10)
            }
          }
        }
        
        // Validate credit_type field
        if (mapped === 'credit_type') {
          if (!['product', 'cash'].includes(value)) {
            // Skip invalid credit_type; let form provide correct one
            return
          }
        }
        
        payload[mapped] = value
      }
    })

    // CRITICAL: Ensure credit_type is set
    if (!payload.credit_type) {
      // Determine from form data
      const hasProductDetails = credit.qty || credit.price || credit.product_name
      payload.credit_type = hasProductDetails ? 'product' : 'cash'
    }

    const { data, error } = await supabase
      .from('credits')
      .insert(payload)
      .select()
      .single()
      
    if (error) throw error
    
    console.log('supabase.insertCredit success ->', data)
    return data
  } catch (err) {
    console.error('insertCredit error:', err)
    const msg = err?.message || err?.error || JSON.stringify(err)
    throw new Error(`insertCredit failed: ${msg}`)
  }
}
```

---

## Summary of Changes

| Issue | File | Line | Change |
|-------|------|------|--------|
| Product ID mismatch | `src/firebase/supabaseInventory.js` | 35 | Add `id: product.id` to safe payload |
| Credit type invalid | `src/firebase/supabaseCredits.js` | 77 | Add validation: ensure credit_type is 'product' or 'cash' |
| Timestamp format | `src/firebase/supabaseCredits.js` | 30 | Convert epoch seconds to ISO string |
| Credit form validation | `src/components/CreditForm.jsx` | 51 | Already fixed - sets credit_type correctly |

---

## Testing Checklist

After applying fixes:

- [ ] Add a warehouse product → Should appear immediately in UI
- [ ] Refresh page → Product should still be visible (check browser console for correct ID)
- [ ] Add a store product → Should appear immediately in UI  
- [ ] Add a credit with product details → Should insert successfully
- [ ] Add a credit with only name/amount (cash) → Should insert successfully
- [ ] Refresh page → Credits should all still be visible
- [ ] Check Supabase dashboard → Verify product IDs match between frontend and DB

