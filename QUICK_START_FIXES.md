# QUICK START - FIXES IMPLEMENTATION

## 📋 TWO FILES TO READ

1. **[ROOT_CAUSE_ANALYSIS.md](ROOT_CAUSE_ANALYSIS.md)** - Understand WHY each issue happens
2. **[CRITICAL_FIXES.md](CRITICAL_FIXES.md)** - Get exact code to copy-paste

---

## 🚨 CRITICAL PRIORITY (Do FIRST)

### Step 1: Run Supabase Migration
```
1. Go to Supabase SQL Editor
2. Copy ENTIRE content of: supabase/schema_fixed.sql
3. Paste and Run
4. ✅ This adds: product_name, credit_direction to credits table
```

### Step 2: Fix supabaseLogs.js
- **File:** `src/firebase/supabaseLogs.js`
- **Change:** insertLog function (CRITICAL_FIXES.md FIX 1)
- **Why:** Currently swallows errors - now throws them
- **Impact:** Logs will actually write to Supabase

### Step 3: Fix supabaseAccounts.js  
- **File:** `src/firebase/supabaseAccounts.js`
- **Change:** updateAccountBalance & updateDailySales functions (CRITICAL_FIXES.md FIX 2)
- **Why:** Currently returns null on error - now throws
- **Impact:** Sale handlers will know when account/daily updates fail

### Step 4: Fix supabaseCredits.js
- **File:** `src/firebase/supabaseCredits.js`
- **Change:** Add product_name, credit_direction to allowedMap (CRITICAL_FIXES.md FIX 3)
- **Why:** These fields aren't being stored
- **Impact:** Product names will show in credits, directions will be saved

---

## 🟡 HIGH PRIORITY (Do NEXT)

### Step 5: Fix Accounts.jsx
- **File:** `src/pages/Accounts.jsx`
- **Change:** Use credit_direction instead of credit_subtype (CRITICAL_FIXES.md FIX 4)
- **Impact:** Account totals will calculate correctly

### Step 6: Fix Credits.jsx  
- **File:** `src/pages/Credits.jsx`
- **Changes:** 3 fixes needed
  - handleAdd: Pass credit_direction (FIX 5)
  - CreditCard: Use product_name field (FIX 6)
  - handleEdit: Same as handleAdd
- **Impact:** Product names display, directions are stored

### Step 7: Fix CreditForm.jsx
- **File:** `src/components/CreditForm.jsx`
- **Change:** Submit with credit_direction (CRITICAL_FIXES.md FIX 7)
- **Impact:** Direction (olingan/berilgan) is captured in form

---

## 🟢 MEDIUM PRIORITY (Do AFTER)

### Step 8: Fix AppContext.jsx
- **File:** `src/context/AppContext.jsx`
- **Change:** Load daily_sales on init (CRITICAL_FIXES.md FIX 8)
- **Impact:** Daily totals persist after refresh

### Step 9: Add i18n Keys
- **Files:** `src/i18n/uz.json` & `src/i18n/en.json`
- **Change:** Add missing translation keys (CRITICAL_FIXES.md FIX 9)
- **Impact:** Language switching works for all strings

### Step 10: (Optional) Remove Price Markup
- **File:** `src/components/MoveToStoreForm.jsx`
- **Change:** Remove `* 1.2` if not needed (CRITICAL_FIXES.md FIX 10)
- **Impact:** Store prices won't auto-markup by 20%

---

## ✅ VERIFICATION

After each fix, check:

1. **No TypeScript errors:** `npm run lint`
2. **App still runs:** `npm run dev`
3. **Specific issue is fixed** (see testing checklist in CRITICAL_FIXES.md)

---

## 🔗 DETAILED REFERENCES

- **Issue 1 (Credits):** ROOT_CAUSE_ANALYSIS.md page 1-2 + CRITICAL_FIXES.md FIX 1-7
- **Issue 2 (Sales):** ROOT_CAUSE_ANALYSIS.md page 2-3 + CRITICAL_FIXES.md FIX 2-3, 8
- **Issue 3 (Logs):** ROOT_CAUSE_ANALYSIS.md page 3 + CRITICAL_FIXES.md FIX 1
- **Issue 4 (Markup):** ROOT_CAUSE_ANALYSIS.md page 4 + CRITICAL_FIXES.md FIX 10
- **Issue 5 (i18n):** ROOT_CAUSE_ANALYSIS.md page 4-5 + CRITICAL_FIXES.md FIX 9

---

## ❓ IF YOU GET STUCK

1. Check exact line numbers in CRITICAL_FIXES.md
2. Read ROOT_CAUSE_ANALYSIS.md for why
3. Compare your file with the "CHANGE TO" code in CRITICAL_FIXES.md
4. Make sure schema_fixed.sql was actually run in Supabase

---

**Time to fix ALL issues:** ~30 minutes
**Most important fix first:** Run schema_fixed.sql in Supabase
