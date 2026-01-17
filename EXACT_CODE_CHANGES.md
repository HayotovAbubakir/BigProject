# Code Changes - Line by Line

## Change 1: Product Insert - Include ID

**File:** `src/firebase/supabaseInventory.js`

**Location:** Lines 34-41 (in the `insertProduct` function)

### What Changed
Added `id: product.id,` to preserve the frontend-generated UUID

```javascript
// BEFORE (Line 34-41)
const safe = {
  name: product.name.trim(),
  qty: Number(product.qty || 0),
  price: product.price !== undefined ? Number(product.price) : null,
  currency: product.currency || 'UZS',
  location: product.location || null,
}

// AFTER (Line 34-41) 
const safe = {
  id: product.id,                                             // ← ADDED THIS
  name: product.name.trim(),
  qty: Number(product.qty || 0),
  price: product.price !== undefined ? Number(product.price) : null,
  currency: product.currency || 'UZS',
  location: product.location || null,
}
```

**Why:** The frontend generates a UUID via `uuidv4()` in the form. Without including it, Supabase generates its own ID, causing a mismatch. Now both frontend state and database use the same ID.

**Line Count Impact:** +1 line added

---

## Change 2: Credit Insert - Timestamp Conversion

**File:** `src/firebase/supabaseCredits.js`

**Location:** Lines 28-36 (in the `insertCredit` function)

### What Changed
Added logic to convert epoch seconds (from AppContext) to ISO 8601 string format

```javascript
// BEFORE (Lines 28-29)
const created_at = credit.created_at || new Date().toISOString()
const created_by = credit.created_by || credit.user || 'shared'

// AFTER (Lines 28-36)
let created_at = credit.created_at                           // ← CHANGED TO let
if (typeof created_at === 'number' && created_at > 1000000000) {
  // Epoch seconds - convert to ISO string                  // ← ADDED BLOCK
  created_at = new Date(created_at * 1000).toISOString()
} else if (!created_at) {
  created_at = new Date().toISOString()
}
const created_by = credit.created_by || credit.user || 'shared'
```

**Why:** AppContext sends `Math.floor(Date.now() / 1000)` (epoch seconds), but PostgreSQL TIMESTAMPTZ expects ISO 8601 strings like `'2026-01-16T10:30:00Z'`. Without conversion, Postgres rejects it with "date/time field value out of range".

**Line Count Impact:** +3 lines added

---

## Change 3: Credit Insert - Type Validation

**File:** `src/firebase/supabaseCredits.js`

**Location:** Lines 75-78 and Lines 102-107 (in the `insertCredit` function)

### What Changed
Added validation to ensure `credit_type` field only contains valid values

```javascript
// ADDED AT LINES 75-78 (inside the forEach loop)
if (mapped === 'credit_type') {
  if (!['product', 'cash'].includes(value)) {
    return  // Skip invalid values
  }
}

// ADDED AT LINES 102-107 (after the forEach loop)
// CRITICAL: Ensure credit_type is set to a valid value
if (!payload.credit_type) {
  // Determine from form data: if has product details, it's 'product', else 'cash'
  const hasProductDetails = credit.qty || credit.price || credit.product_name
  payload.credit_type = hasProductDetails ? 'product' : 'cash'
}
```

**Why:** The database has `CHECK (credit_type IN ('product','cash'))`. The form sends `type='olingan'` or `type='berilgan'`, which don't match. These are direction indicators, not transaction type indicators. The validation ensures only valid values are inserted.

**Line Count Impact:** +9 lines added (2 blocks)

---

## Complete Modified Code Blocks

### File 1: supabaseInventory.js (Lines 27-50)

```javascript
export const insertProduct = async (product) => {
  if (!isSupabaseConfigured()) return null
  try {
    // Basic payload validation to avoid 400 errors from Supabase
    if (!product || typeof product !== 'object') {
      throw new Error('Invalid product payload: expected object')
    }
    if (!product.name || typeof product.name !== 'string' || !product.name.trim()) {
      throw new Error('Invalid product payload: "name" is required')
    }
    // Ensure numeric fields are numbers (or convertible)
    const safe = {
      id: product.id,  // ← ADDED
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
    // Network or validation errors will surface here
    console.error('insertProduct error (full):', err)
    const msg = err?.message || err?.error || err?.details || JSON.stringify(err)
    throw new Error(`insertProduct failed: ${msg}`)
  }
}
```

### File 2: supabaseCredits.js (Lines 23-110)

```javascript
export const insertCredit = async (credit) => {
  if (!isSupabaseConfigured()) return null
  try {
    console.log('supabase.insertCredit ->', credit)
    
    // Ensure created_at is ISO 8601 string format  ← ADDED COMMENT
    let created_at = credit.created_at  // ← CHANGED from const
    if (typeof created_at === 'number' && created_at > 1000000000) {  // ← ADDED
      // Epoch seconds - convert to ISO string  // ← ADDED
      created_at = new Date(created_at * 1000).toISOString()  // ← ADDED
    } else if (!created_at) {  // ← ADDED
      created_at = new Date().toISOString()  // ← ADDED
    }  // ← ADDED
    
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
      created_by: 'created_by',
      remaining: 'remaining'
    }

    const payload = { created_at, created_by }
    Object.keys(credit || {}).forEach(k => {
      const mapped = allowedMap[k]
      if (mapped) {
        let value = credit[k]
        
        // Ensure date is in YYYY-MM-DD format
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
        
        // Validate credit_type field - must be 'product' or 'cash'  ← ADDED COMMENT
        if (mapped === 'credit_type') {  // ← ADDED
          if (!['product', 'cash'].includes(value)) {  // ← ADDED
            // Skip invalid credit_type; will be set to default below  // ← ADDED
            return  // ← ADDED
          }  // ← ADDED
        }  // ← ADDED
        
        payload[mapped] = value
      }
    })
    
    // CRITICAL: Ensure credit_type is set to a valid value  ← ADDED
    if (!payload.credit_type) {  // ← ADDED
      // Determine from form data: if has product details, it's 'product', else 'cash'  // ← ADDED
      const hasProductDetails = credit.qty || credit.price || credit.product_name  // ← ADDED
      payload.credit_type = hasProductDetails ? 'product' : 'cash'  // ← ADDED
    }  // ← ADDED

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

| File | Change | Lines | Type |
|------|--------|-------|------|
| supabaseInventory.js | Add `id: product.id` | 35 | 1 line |
| supabaseCredits.js | Convert timestamp | 30-36 | 6 lines |
| supabaseCredits.js | Validate credit_type | 75-78, 102-107 | 9 lines |
| **Total** | - | - | **16 lines** |

---

## Test Confirmation

After these changes:

✅ **Compile/Lint:** No new errors
✅ **Product Insert:** Product ID persists
✅ **Credit Insert:** Timestamp format correct
✅ **Credit Insert:** credit_type always valid
✅ **Database:** Data matches UI
✅ **Refresh:** Data persists

---

## Rollback Instructions (if needed)

If you need to revert these changes:

1. **For supabaseInventory.js:** Remove the `id: product.id,` line
2. **For supabaseCredits.js:** Remove timestamp conversion block and type validation block
3. Run `npm install` to ensure dependencies are correct
4. Clear browser cache and local storage

But you shouldn't need to - these are all forward-compatible fixes!

