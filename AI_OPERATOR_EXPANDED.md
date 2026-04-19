# AI Operator - Full Site Management

## Overview

The AI Operator is now a **comprehensive site management tool** that handles not just sales, but all core inventory operations:
- 💰 **Sales & Receiving** - Process sales and accept new inventory
- 📊 **Inventory Management** - Adjust stock levels
- 👥 **Client Management** - Add, update, delete clients  
- 📦 **Product Management** - Create, edit, delete products
- 💳 **Credit Management** - Create and manage customer credits

---

## Usage Examples

### 1. SALES (Sotilsin)

**Uzbek:**
```
"Ombordan 1 ta elektrod chaqmoq 3 razmer sotilsin narxi 50000 so'm dan"
"Do'kondan 5 dona tosh satilsin 45000 UZS"
```

**Effects:**
- Reduces product quantity in warehouse/store
- Records sale in logs
- Updates account balance

---

### 2. RECEIVING GOODS (Qabul Qilish)

**Uzbek:**
```
"Omborga 100 dona elektrod qabul qilinsin narxi 30000 so'm"
"Do'konaga 50 metr gaz balon qabul qilindi narxi 25000 UZS"
```

**Effects:**
- Adds new product to inventory
- Creates new inventory record
- Logs receiving transaction

---

### 3. INVENTORY ADJUSTMENTS (Sozlash)

**Uzbek:**
```
"Ombordagi elektrod 5 dona olib tashlansin" (Remove from warehouse)
"Do'konda tosh 10 dona qo'shilsin" (Add to store)
```

**Effects:**
- Adjusts product quantity
- Logs reason for adjustment
- Useful for write-offs, corrections, shrinkage

---

### 4. CLIENT MANAGEMENT (Mijozlar)

**Add Client:**
```
"Yangi mijoz qo'shish: Mirjalol Abdullayev, +998901234567"
"Add client: Hamid, +99891234567"
```

**Update Client:**
```
"Mirjalol telefon o'zgarish: +998901234568"
"Hamid ismini o'zgarish: Hamidjon"
```

**Delete Client:**
```
"Mirjalol mijozni o'chirish"
"Delete client Hamid"
```

**Effects:**
- Creates/modifies/removes client records
- Associated credits deleted when client removed

---

### 5. PRODUCT MANAGEMENT (Mahsulotlar)

**Add Product:**
```
"Yangi mahsulot: Elektrod 3mm, kategoriya elektrod, narxi 50000 so'm, 100 dona omborga"
"Add product: Stone 100x100, category tosh, price 40000 UZS, quantity 200 to warehouse"
```

**Update Product:**
```
"Elektrod 3mm narx o'zgarish: 55000 so'm"
"Stone 100x100 quantity update: 300"
```

**Delete Product:**
```
"Elektrod 3mm mahsulotni o'chirish"
"Delete product Stone 100x100"
```

**Effects:**
- Creates/modifies/removes product records
- Updates inventory database
- All changes logged

---

### 6. CREDIT MANAGEMENT (Qarzlar)

**Add Cash Credit:**
```
"Mirjalol mijozga 500000 so'm qarz berish"
"Give Hamid 1000000 UZS credit"
```

**Add Product Credit:**
```
"Mirjalol mijozga 10 dona elektrod qarz berish"
"Give Hamid 5 meters stone on credit"
```

**Delete Credit:**
```
"Mirjalol qarzni o'chirish"
"Delete credit for Hamid"
```

**Effects:**
- Creates loan record
- Associates with client
- Tracks amount/product/quantity
- Marked completed when settled

---

## How to Access

1. Click **"AI Operator"** button (SmartToy icon) in app toolbar
2. Speak or type command in Uzbek, Russian, or English
3. Review the preview to confirm what AI understood
4. Click **"Tasdiqlash va saqlash"** to execute

## Language Support

- 🇺🇿 **Uzbek** - Primary language, all commands supported
- 🇷🇺 **Russian** - All commands supported (similar keywords work)
- 🇬🇧 **English** - All commands supported

## Fallback Behavior

- If OpenAI API fails, the **Local Parser** automatically takes over
- Local parser understands all operation types
- Yellow chip shows "Local fallback parser" status
- Same result, just slightly less flexible with phrasing

## Tips for Best Results

✅ **DO:**
- Use clear, specific commands
- Include relevant details (quantity, price, location)
- Use familiar product/client names
- Mention source (warehouse/store) for sales

❌ **DON'T:**
- Use slang or abbreviations
- Mix multiple operations in one command
- Omit key information (price, quantity)
- Use confusing product names

## Supported Keywords

### Operations:
- **Sales:** "sotilsin", "sot", "sell", "продай"
- **Receiving:** "qabul", "receive", "приход"
- **Adjustments:** "sozla", "adjust", "корректир", "olib tash" (remove)
- **Clients:** "mijoz", "client", "customer", "клиент"
- **Products:** "mahsulot", "product", "товар"

### Locations:
- **Warehouse:** "ombor", "warehouse", "склад"
- **Store:** "do'kon", "store", "магазин"

### Units:
- **Pieces:** "ta", "dona", "piece", "шт"
- **Meters:** "metr", "meter", "m", "метр"

### Currencies:
- **UZS:** "uzs", "so'm", "sum", "сум"
- **USD:** "usd", "$", "dollar", "доллар"

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Product not found | Use exact product name or part of it |
| Ambiguous product | Be more specific (size, category) |
| Client not found | Use correct client name spelling |
| Quantity too high | Check available stock in preview |
| Price negative/invalid | Use positive numbers only |

---

## System Architecture

```
User Command
    ↓
[Speech Recognition] OR [Text Input]
    ↓
AI Parser (OpenAI or Local Fallback)
    ↓
JSON Schema Validation
    ↓
Resolution Layer (fuzzy matching, validation)
    ↓
Preview Dialog (confirm before execution)
    ↓
Execution Layer (database updates + logging)
    ↓
Success/Failure Response
```

All operations are **logged in audit trail** with timestamp, user, action type, and details.

---

## Version Info

- **Release:** Full Site Management v1.0
- **Status:** Active and tested
- **Operations:** 11 action types supported
- **Languages:** 3 (Uzbek, Russian, English)
- **Fallback:** Local parser for all operation types
