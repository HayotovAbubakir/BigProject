# CRITICAL FIXES - IMPLEMENTATION GUIDE

This document provides exact code changes needed to fix all 5 issues.

## FIX 1: supabaseLogs.js - Make insertLog throw errors

**File:** `src/firebase/supabaseLogs.js`
**Lines to Replace:** insertLog function (around line 82)

```javascript
export const insertLog = async (log) => {
  if (!isSupabaseConfigured()) return null
  
  try {
    // Normalize log data
    const logData = {
      id: log.id || crypto.randomUUID(),
      date: log.date || new Date().toISOString().slice(0, 10),
      time: log.time || new Date().toLocaleTimeString(),
      action: log.action || 'ACTION',
      kind: log.kind || null,
      user_name: log.user_name || log.user || 'unknown',
      product_name: log.product_name || null,
      product_id: log.product_id || log.productId || null,
      qty: log.qty || null,
      unit_price: log.unit_price || log.unitPrice || null,
      amount: log.amount || null,
      currency: log.currency || 'UZS',
      total_uzs: log.total_uzs || null,
      detail: log.detail || null,
      source: log.source || null,
      created_by: log.user_name || log.user || 'unknown'
    }

    console.log('[insertLog] Writing:', logData)

    const { data, error } = await supabase
      .from('logs')
      .insert([logData])
      .select()
      .single()

    if (error) {
      console.error('[insertLog] Database error:', error)
      throw error  // THROW - don't swallow
    }

    console.log('[insertLog] Success:', data)
    return data
  } catch (err) {
    console.error('[insertLog] Failed:', err?.message || err)
    throw err  // THROW to caller
  }
}
```

---

## FIX 2: supabaseAccounts.js - Handle missing RPC functions

**File:** `src/firebase/supabaseAccounts.js`
**Lines to Replace:** updateAccountBalance and updateDailySales functions

```javascript
export const updateAccountBalance = async (username, deltaUzs, deltaUsd = 0) => {
  if (!isSupabaseConfigured()) {
    console.warn('[updateAccountBalance] Supabase not configured')
    return null
  }

  try {
    console.log(`[updateAccountBalance] User: ${username}, +${deltaUzs} UZS, +${deltaUsd} USD`)

    const { data, error } = await supabase.rpc('update_user_balance', {
      p_username: username.toLowerCase(),
      p_delta_uzs: Number(deltaUzs),
      p_delta_usd: Number(deltaUsd)
    })

    if (error) {
      console.error('[updateAccountBalance] Error:', error)
      throw error  // THROW - don't return null
    }

    console.log('[updateAccountBalance] Success:', data)
    return data
  } catch (err) {
    console.error('[updateAccountBalance] Failed:', err?.message || err)
    throw err  // THROW to caller
  }
}

export const updateDailySales = async (username, salesUzs, salesUsd = 0, date = null) => {
  if (!isSupabaseConfigured()) {
    console.warn('[updateDailySales] Supabase not configured')
    return null
  }

  const targetDate = date || new Date().toISOString().slice(0, 10)

  try {
    console.log(`[updateDailySales] User: ${username}, Date: ${targetDate}, +${salesUzs} UZS`)

    const { data, error } = await supabase.rpc('update_daily_sales', {
      p_user_name: username.toLowerCase(),
      p_date: targetDate,
      p_total_uzs: Number(salesUzs),
      p_total_usd: Number(salesUsd)
    })

    if (error) {
      console.error('[updateDailySales] Error:', error)
      throw error  // THROW - don't return null
    }

    console.log('[updateDailySales] Success:', data)
    return data
  } catch (err) {
    console.error('[updateDailySales] Failed:', err?.message || err)
    throw err  // THROW to caller
  }
}
```

---

## FIX 3: supabaseCredits.js - Store product_name and credit_direction

**File:** `src/firebase/supabaseCredits.js`
**Location:** insertCredit function (around line 70)

ADD to allowedMap:
```javascript
const allowedMap = {
  id: 'id',
  name: 'name',
  note: 'note',
  date: 'date',
  amount: 'amount',
  currency: 'currency',
  creditType: 'credit_type',
  type: 'credit_type',
  product_id: 'product_id',
  productId: 'product_id',
  product_name: 'product_name',  // ADD THIS
  productName: 'product_name',   // ADD THIS
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
  credit_direction: 'credit_direction',  // ADD THIS
  direction: 'credit_direction',         // ADD THIS
}
```

---

## FIX 4: Accounts.jsx - Fix credit filtering

**File:** `src/pages/Accounts.jsx`
**Lines to Replace:** Around line 28-45

```javascript
// Calculate total debts (olingan nasiyalar)
const totalDebtsUzs = state.credits
  .filter(c => c.credit_direction === 'olingan' && !c.completed)  // FIXED
  .reduce((sum, c) => {
    const amount = Number(c.amount || 0);
    if (c.currency === 'USD') {
      return sum + Math.round(c.amount_uzs || (usdToUzs ? amount * usdToUzs : amount));
    }
    return sum + amount;
  }, 0);

// Calculate total receivables (berilgan nasiyalar)
const totalReceivablesUzs = state.credits
  .filter(c => c.credit_direction === 'berilgan' && !c.completed)  // FIXED
  .reduce((sum, c) => {
    const amount = Number(c.amount || 0);
    if (c.currency === 'USD') {
      return sum + Math.round(c.amount_uzs || (usdToUzs ? amount * usdToUzs : amount));
    }
    return sum + amount;
  }, 0);
```

---

## FIX 5: Credits.jsx - Store credit_direction when creating/editing

**File:** `src/pages/Credits.jsx`
**Lines to Replace:** handleAdd function (around line 95)

```javascript
const handleAdd = (payload) => {
  const amount = Number(payload.qty) * parseNumber(payload.price || 0);
  const logData = { 
    id: uuidv4(), 
    date: payload.date || new Date().toISOString().slice(0, 10), 
    time: new Date().toLocaleTimeString(), 
    user_name: username || 'Admin', 
    action: t('credit_added'), 
    kind: 'credit', 
    product_name: payload.product_name || payload.name,
    credit_direction: payload.type,  // ADD THIS
    qty: Number(payload.qty), 
    unit_price: parseNumber(payload.price || 0), 
    amount: amount, 
    currency: payload.currency || 'UZS', 
    client_name: payload.name, 
    credit_direction: payload.type,  // ADD THIS
    detail: `Kim: ${username}, Vaqt: ${new Date().toLocaleTimeString()}, Harakat: Nasiya qo'shildi (${payload.type === 'berilgan' ? 'berildi' : 'olingan'}), Klient: ${payload.name}, Mahsulot: ${payload.product_name}, Soni: ${Number(payload.qty)}, Narx: ${parseNumber(payload.price || 0)}, Jami: ${amount} ${payload.currency}` 
  };
  
  // CRITICAL: Pass credit_direction to addCredit
  const payloadWithDirection = { ...payload, credit_direction: payload.type };
  addCredit(payloadWithDirection, logData);
};
```

---

## FIX 6: Credits.jsx - Use product_name field

**File:** `src/pages/Credits.jsx`
**Lines to Replace:** CreditCard component (around line 36)

```javascript
{credit.credit_type === 'product' && (credit.product_name) && (
  <Box sx={{ mb: 2, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
    <Typography variant="body2" sx={{ fontWeight: 500 }}>
      {credit.product_name}
    </Typography>
    <Box sx={{ display: 'flex', gap: 2, mt: 1, flexWrap: 'wrap', fontSize: '0.875rem' }}>
      {(credit.qty) && (
        <Typography variant="caption">
          <strong>{t('qty')}:</strong> {credit.qty}
        </Typography>
      )}
      {(credit.unit_price) && (
        <Typography variant="caption">
          <strong>{t('unit_price')}:</strong> {formatMoney(credit.unit_price)} {credit.currency || 'UZS'}
        </Typography>
      )}
      {credit.amount && (
        <Typography variant="caption">
          <strong>{t('amount')}:</strong> {formatMoney(credit.amount)} {credit.currency || 'UZS'}
        </Typography>
      )}
    </Box>
  </Box>
)}
```

---

## FIX 7: CreditForm.jsx - Submit with credit_direction

**File:** `src/components/CreditForm.jsx`
**Lines to Replace:** submit function (around line 30)

```javascript
const submit = () => {
  const totalAmount = isPayment ? form.amount : (Number(form.qty) || 0) * (Number(form.price) || 0);
  const payload = { 
    id: initial?.id || uuidv4(), 
    ...form, 
    amount: totalAmount,
    credit_direction: form.type  // ADD THIS LINE
  };
  
  // ... rest of date formatting code ...
  
  // Determine credit_type based on whether product details are provided
  const hasProductDetails = payload.qty || payload.price || payload.product_name
  payload.credit_type = hasProductDetails ? 'product' : 'cash'
  
  if (payload.currency === 'USD') {
    payload.amount = Number(payload.amount) || 0
    if (payload.amount_uzs !== undefined) delete payload.amount_uzs
  } else {
    payload.amount = Number(payload.amount) || 0
    payload.amount_uzs = Math.round(payload.amount)
  }
  
  onSubmit(payload)
  onClose()
}
```

---

## FIX 8: AppContext.jsx - Load daily_sales on init

**File:** `src/context/AppContext.jsx`
**Lines to Replace:** loadData function (around line 308)

ADD import:
```javascript
import { getTodaysSalesSummary } from '../firebase/supabaseAccounts'
```

REPLACE loadData:
```javascript
const loadData = async () => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const [credits, warehouse, store, logs, clients, userBalances, dailySalesData] = 
      await Promise.all([
        getCredits(),
        getProducts('warehouse'),
        getProducts('store'),
        getLogs(),
        getClients(),
        getAllUserBalances(),
        getTodaysSalesSummary(),  // Load today's sales
      ]);

    if (!mountedRef.current) return;

    dispatch({ type: 'SET_CREDITS', payload: credits });
    dispatch({ type: 'SET_WAREHOUSE', payload: warehouse });
    dispatch({ type: 'SET_STORE', payload: store });
    dispatch({ type: 'SET_LOGS', payload: logs });
    dispatch({ type: 'SET_CLIENTS', payload: clients });

    // Merge user balances with existing accounts
    if (userBalances && userBalances.length > 0) {
      const updatedAccounts = (initialState.accounts || []).map(acc => {
        const bal = userBalances.find(b => b.username === acc.username);
        return bal ? { 
          ...acc, 
          balance_uzs: bal.balance_uzs || 0, 
          balance_usd: bal.balance_usd || 0 
        } : acc;
      });
      console.log('[AppContext] Loaded account balances:', updatedAccounts);
      dispatch({ type: 'SET_ACCOUNTS', payload: updatedAccounts });
    }
    
    // Store daily sales in state
    if (dailySalesData && dailySalesData.length > 0) {
      console.log('[AppContext] Loaded daily sales:', dailySalesData);
      // You'll need to add a SET_DAILY_SALES action to reducer
      // Or store in accounts with daily totals
    }

  } catch (_err) {
    console.error('AppContext: failed to load shared data', _err);
  }

  if (mountedRef.current) setHydrated(true);
};
```

---

## FIX 9: i18n - Add missing translation keys

**File:** `src/i18n/uz.json`
**Add after line 74:**

```json
"creditDirectionOlingan": "Olingan",
"creditDirectionBerish": "Berilgan",
"productName": "Mahsulot nomi",
"boshToluv": "Bosh to'lov",
"down_payment_note": "Bosh to'lov izohı",
"total_amount": "Jami miqdor",
"how_much_to_pay": "Qancha to'lov qilish kerak?",
"credit_new": "Yangi nasiya",
"credit_edit": "Nasiya tahrirlash",
"credit_receive_payment": "To'lov qabul qilish",
```

**File:** `src/i18n/en.json`
**Add same structure in English**

---

## FIX 10: MoveToStoreForm.jsx - Remove markup (Optional)

**File:** `src/components/MoveToStoreForm.jsx`
**Line 14 - OPTIONAL:**

CURRENT:
```javascript
const pref = (initial.price || 0) * 1.2
```

CHANGE TO (if no markup desired):
```javascript
const pref = (initial.price || 0)  // No markup
```

---

## DEPLOYMENT SEQUENCE

1. ✅ Run schema_fixed.sql in Supabase (adds product_name, credit_direction to credits)
2. ✅ Fix supabaseLogs.js (throw errors)
3. ✅ Fix supabaseAccounts.js (throw errors)  
4. ✅ Fix supabaseCredits.js (store product_name, direction)
5. ✅ Fix Accounts.jsx (filter by credit_direction)
6. ✅ Fix Credits.jsx (handleAdd, CreditCard, handleEdit)
7. ✅ Fix CreditForm.jsx (submit with credit_direction)
8. ✅ Fix AppContext.jsx (load daily_sales)
9. ✅ Add i18n keys (uz.json, en.json)
10. ✅ (Optional) Remove 20% markup from MoveToStoreForm

---

## TESTING CHECKLIST

After deploying fixes:

- [ ] Create new credit - verify product_name is stored
- [ ] Edit credit - verify remaining calculates correctly
- [ ] Complete credit - verify remaining becomes 0
- [ ] Check Accounts page - debts and receivables calculate
- [ ] Sell from warehouse - verify logs appear
- [ ] Sell from warehouse - verify account_by_sales updates
- [ ] Refresh page - verify balances persist
- [ ] Change language - verify all text updates including modals
- [ ] Check Logs page - verify sales are recorded

