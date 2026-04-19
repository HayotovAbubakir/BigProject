import { parseNumber } from './format'
import { formatProductName } from './productDisplay'
import { isMeterCategory, normalizeCategory } from './productCategories'

const SOURCE_PATTERNS = [
  { source: 'warehouse', pattern: /\b(ombor(?:dan)?|warehouse|склад(?:а|е|у)?|со\s+склада)\b/i },
  { source: 'store', pattern: /\b(do'?kon(?:dan)?|dokon(?:dan)?|store|магазин(?:а|е|у)?|из\s+магазина)\b/i },
]

const CATEGORY_PATTERNS = [
  { category: 'elektrod', pattern: /\b(elektrod|electrode|электрод)\b/i },
  { category: 'tosh', pattern: /\b(tosh|stone|камень|плитка)\b/i },
  { category: 'gaz balon', pattern: /\b(gaz\s*balon|gas\s*cylinder|газ(?:овый)?\s*баллон|баллон)\b/i },
  { category: 'metrologiya', pattern: /\b(metrologiya|metr(?:lab)?|meter|метр)\b/i },
]

const SELL_PATTERNS = /\b(sotilsin|sotish|sot|sell|sold|продай|продать|продано)\b/i
const RECEIVE_PATTERNS = /\b(qabul|receive|получи|приходу|поступ|новое\s+(?:поступление|приход))\b/i
const ADD_CLIENT_PATTERNS = /\b((?:yangi|new)\s+(?:mijoz|client)|(?:mijoz|client)\s+(?:qos|add)|qosh|добави|клиент)\b/i
const ADJUST_PATTERNS = /\b(sozla|adjust|korrekiti|udali|olib\s+tash|remove|izini|izyya|pisa)\b/i
const DELETE_PATTERNS = /\b(o'chi|delete|удалить|удали|olib\s+tash)\b/i

const STOP_WORDS = new Set([
  'ombor', 'ombordan', 'warehouse', 'sklad', 'склад', 'склада', 'складе', 'складу',
  "do'kon", 'dokon', "do'kondan", 'dokondan', 'store', 'magazin', 'магазин', 'магазина', 'магазине',
  'sotilsin', 'sotish', 'sot', 'sell', 'sold', 'продай', 'продать', 'продано',
  'narxi', 'narxda', 'price', 'цена', 'dan', 'from', 'for', 'по', 'за',
  'ta', 'dona', 'metr', 'meter', 'm', 'piece', 'pieces', 'pc', 'pcs', 'шт', 'штук',
  'uzs', 'usd', "so'm", 'som', 'sum', 'сум', 'dollar', 'доллар',
  'razmer', 'size', 'размер', 'qalinlik', 'thickness', 'толщина', 'hajm', 'hajmi', 'объем',
  'va', 'and', 'ham', 'bilan', 'i', 'и',
  'elektrod', 'electrode', 'электрод', 'tosh', 'stone', 'камень', 'gaz', 'balon', 'ballon', 'баллон',
  'yangi', 'new', 'qosh', 'add', 'tejish', 'save', 'o\'chi', 'delete', 'удалить',
])

const sanitizeCommand = (value) => (value || '').toString().trim()

const detectSource = (command) => {
  const match = SOURCE_PATTERNS.find(({ pattern }) => pattern.test(command))
  return match?.source || null
}

const detectCategory = (command) => {
  const match = CATEGORY_PATTERNS.find(({ pattern }) => pattern.test(command))
  return match?.category || ''
}

const detectCurrency = (command) => {
  if (/\b(usd|\$|dollar|доллар)\b/i.test(command)) return 'USD'
  if (/\b(uzs|sum|so'?m|som|сум)\b/i.test(command)) return 'UZS'
  return 'UZS'
}

const normalizeUnit = (rawUnit) => {
  const unit = (rawUnit || '').toLowerCase()
  if (/(metr|meter|^m$|метр)/i.test(unit)) return 'metr'
  return 'dona'
}

const detectQuantityAndUnit = (command) => {
  const unitMatch = command.match(/(\d+(?:[.,]\d+)?)\s*(ta|dona|metr|meter|m|piece|pieces|pc|pcs|шт|штук|метр)/i)
  if (unitMatch) {
    return {
      quantity: parseNumber(unitMatch[1]) || 1,
      unit: normalizeUnit(unitMatch[2]),
    }
  }

  const bareMatch = command.match(/(\d+(?:[.,]\d+)?)/)
  return {
    quantity: parseNumber(bareMatch?.[1]) || 1,
    unit: 'dona',
  }
}

const detectPrice = (command) => {
  const priceMatch = command.match(
    /(?:narx(?:i|da)?|price|цена|for|за|по)\s*[:=-]?\s*([0-9\s.,]+)\s*(uzs|usd|sum|so'?m|som|сум|\$|dollar|доллар)?/i,
  )

  if (!priceMatch) {
    return { unitPrice: null, currency: detectCurrency(command) }
  }

  return {
    unitPrice: parseNumber(priceMatch[1]),
    currency: priceMatch[2] ? detectCurrency(priceMatch[2]) : detectCurrency(command),
  }
}

const extractAttribute = (command, pattern) => {
  const match = command.match(pattern)
  return match?.[1] ? match[1].trim() : ''
}

const extractProductName = (command) => {
  const cleaned = command
    .replace(/[\d.,]+/g, ' ')
    .replace(/\b(ta|dona|metr|meter|m|piece|pieces|pc|pcs|шт|штук|метр)\b/gi, ' ')
    .replace(/\b(narx(?:i|da)?|price|цена|dan|from|for|по|за)\b/gi, ' ')
    .replace(/\b(ombor(?:dan)?|warehouse|склад(?:а|е|у)?|со\s+склада|do'?kon(?:dan)?|dokon(?:dan)?|store|магазин(?:а|е|у)?|из\s+магазина)\b/gi, ' ')
    .replace(/\b(sotilsin|sotish|sot|sell|sold|продай|продать|продано)\b/gi, ' ')
    .replace(/\b(uzs|usd|sum|so'?m|som|сум|dollar|доллар)\b/gi, ' ')
    .replace(/\b(razmer|size|размер|qalinlik|thickness|толщина|hajm|hajmi|объем)\b/gi, ' ')
    .replace(/[():-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const tokens = cleaned
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token && !STOP_WORDS.has(token.toLowerCase()))

  return tokens.join(' ').trim()
}

const detectCommandType = (command) => {
  if (SELL_PATTERNS.test(command)) return 'sell_product'
  if (RECEIVE_PATTERNS.test(command)) return 'receive_goods'
  if (ADD_CLIENT_PATTERNS.test(command)) return 'add_client'
  if (DELETE_PATTERNS.test(command) && /\b(mijoz|client|клиент|customer)\b/i.test(command)) return 'delete_client'
  if (/\b(o'zgarti|update|изменить|обновить)\b/i.test(command) && /\b(mijoz|client)\b/i.test(command)) return 'update_client'
  if (ADJUST_PATTERNS.test(command)) return 'adjust_inventory'
  return 'sell_product' // default fallback
}

export const parseAiCommandLocally = (rawCommand) => {
  const command = sanitizeCommand(rawCommand)
  if (!command) throw new Error("Buyruq matni bo'sh.")

  const commandType = detectCommandType(command)

  if (commandType === 'sell_product') {
    if (!SELL_PATTERNS.test(command)) {
      throw new Error('Sotuv buyruqlari uchun "sotilsin", "sot" va shunga o\'xshash so\'zlardan foydalaning.')
    }

    const { quantity, unit } = detectQuantityAndUnit(command)
    const { unitPrice, currency } = detectPrice(command)
    const category = detectCategory(command)
    const source = detectSource(command)
    const electrodeSize = extractAttribute(command, /(\d+(?:[.,]\d+)?)\s*(?:razmer|size|размер)/i)
    const stoneThickness = extractAttribute(command, /(?:qalinlik|толщина|thickness)\s*[:=-]?\s*([0-9xX*.,]+)/i)
    const stoneSize = extractAttribute(command, /(?:hajmi|hajm|объем)\s*[:=-]?\s*([0-9xX*.,]+)/i)
    const productName = extractProductName(command)

    return {
      source: 'local_fallback',
      summary: `${source === 'warehouse' ? 'Ombordan' : source === 'store' ? "Do'kondan" : 'Inventardan'} ${quantity} ${unit} ${productName || 'mahsulot'} sotish tayyorlandi.`,
      actions: [
        {
          type: 'sell_product',
          source,
          quantity,
          unit,
          unit_price: unitPrice,
          currency,
          product_query: {
            name: productName,
            category,
            electrode_size: electrodeSize,
            stone_thickness: stoneThickness,
            stone_size: stoneSize,
          },
        },
      ],
    }
  } else if (commandType === 'receive_goods') {
    const { quantity, unit } = detectQuantityAndUnit(command)
    const { unitPrice, currency } = detectPrice(command)
    const category = detectCategory(command)
    const location = detectSource(command) || 'warehouse'
    const productName = extractProductName(command)

    return {
      source: 'local_fallback',
      summary: `${location === 'warehouse' ? 'Omborga' : "Do'konaga"} ${quantity} ${unit} ${productName || 'mahsulot'} qabul qilindi.`,
      actions: [
        {
          type: 'receive_goods',
          product_name: productName,
          category,
          quantity,
          unit,
          unit_price: unitPrice,
          currency,
          location,
          note: `Lokal fallback orqali qabul qilindi`,
        },
      ],
    }
  } else if (commandType === 'add_client') {
    // Extract name and phone from command
    const phoneMatch = command.match(/(?:\+|00)?\d{3}[-.\s]?\d{2,3}[-.\s]?\d{2,4}[-.\s]?\d{2,4}/)
    const clientPhone = phoneMatch ? phoneMatch[0] : null
    const clientName = extractProductName(command)

    return {
      source: 'local_fallback',
      summary: `Yangi mijoz qo'shildi: ${clientName}${clientPhone ? `, ${clientPhone}` : ''}`,
      actions: [
        {
          type: 'add_client',
          client_name: clientName || 'Noma\'lum mijoz',
          client_phone: clientPhone,
        },
      ],
    }
  } else if (commandType === 'delete_client') {
    const clientName = extractProductName(command)

    return {
      source: 'local_fallback',
      summary: `Mijoz o'chirildi: ${clientName}`,
      actions: [
        {
          type: 'delete_client',
          client_query: clientName,
        },
      ],
    }
  } else if (commandType === 'update_client') {
    // Try to extract client name and what field to update
    const parts = command.split(/[:,]/i)
    const clientName = parts[0].replace(/o'zgarti|update|изменить/gi, '').trim()
    const updateValue = parts[1]?.trim() || ''

    return {
      source: 'local_fallback',
      summary: `Mijoz yangilandi: ${clientName}`,
      actions: [
        {
          type: 'update_client',
          client_query: clientName,
          update_field: /telefon|phone|tel/i.test(command) ? 'phone' : 'name',
          update_value: updateValue,
        },
      ],
    }
  } else if (commandType === 'adjust_inventory') {
    const productName = extractProductName(command)
    const { quantity } = detectQuantityAndUnit(command)
    const location = detectSource(command) || 'warehouse'
    const isRemove = /olib\s+tash|remove|delete|удалить|удал|изъя|писа/i.test(command)

    return {
      source: 'local_fallback',
      summary: `${location === 'warehouse' ? 'Ombor' : "Do'kon"} sozlandi: ${productName} ${isRemove ? 'olib tashlandi' : 'qo\'shildi'} ${quantity}`,
      actions: [
        {
          type: 'adjust_inventory',
          product_query: { name: productName },
          adjustment_qty: quantity,
          adjustment_type: isRemove ? 'remove' : 'add',
          location,
          reason: `Lokal fallback sozlash`,
        },
      ],
    }
  }

  // Fallback: try to parse as sell command
  throw new Error('AI buyruqni tushuna olmadi. "Sotilsin", "qabul", "añli mioz qo\'sh" va boshqa aniq buyruqlarni ishlating.')
}


const tokenize = (value) => (
  (value || '')
    .toString()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
)

const includesLoose = (left, right) => left.includes(right) || right.includes(left)

const scoreProductMatch = (product, query) => {
  let score = 0
  const normalizedProductCategory = normalizeCategory(product.category)
  const normalizedQueryCategory = normalizeCategory(query.category)

  if (normalizedQueryCategory) {
    if (normalizedProductCategory === normalizedQueryCategory) score += 35
    else score -= 40
  }

  const productTokens = tokenize(product.name)
  const queryTokens = tokenize(query.name)
  if (queryTokens.length > 0) {
    const matched = queryTokens.filter((token) => productTokens.some((productToken) => includesLoose(productToken, token))).length
    if (matched === 0) score -= 80
    else {
      score += matched * 18
      if (matched === queryTokens.length) score += 22
    }
  }

  if (query.electrode_size) {
    if ((product.electrode_size || '').toString().trim().toLowerCase() === query.electrode_size.toString().trim().toLowerCase()) score += 18
    else score -= 22
  }

  if (query.stone_thickness) {
    if ((product.stone_thickness || '').toString().trim().toLowerCase() === query.stone_thickness.toString().trim().toLowerCase()) score += 18
    else score -= 18
  }

  if (query.stone_size) {
    if ((product.stone_size || '').toString().trim().toLowerCase() === query.stone_size.toString().trim().toLowerCase()) score += 18
    else score -= 18
  }

  return score
}

const getAvailableQuantity = (product, unit) => {
  if (!product) return 0
  if (!isMeterCategory(product)) return Number(product.qty || 0)
  if (unit === 'metr') return Number(product.meter_qty ?? (Number(product.qty || 0) * Number(product.pack_qty || 0)))

  const packQty = Number(product.pack_qty || 0)
  const meterQty = Number(product.meter_qty ?? (Number(product.qty || 0) * packQty))
  return packQty > 0 ? Math.floor(meterQty / packQty) : Number(product.qty || 0)
}

export const resolveAiDraft = (draft, { warehouse = [], store = [] } = {}) => {
  const actions = Array.isArray(draft?.actions) ? draft.actions : []

  const resolvedActions = actions.map((action, index) => {
    // For actions that don't require product resolution, pass them through as ready
    const nonProductActions = ['add_client', 'update_client', 'delete_client', 'add_product', 'update_product', 'delete_product', 'add_credit', 'delete_credit']
    
    if (nonProductActions.includes(action.type)) {
      return {
        index,
        status: 'ready',
        issue: '',
        action,
        preview: {
          displayName: getActionPreviewName(action),
          type: action.type,
        },
      }
    }

    // For product-related actions that need resolution (sell_product, receive_goods, adjust_inventory)
    if (action.type === 'sell_product' || action.type === 'adjust_inventory') {
      const sources = action.source ? [action.source] : ['warehouse', 'store']

      const candidates = sources
        .flatMap((source) =>
          (source === 'warehouse' ? warehouse : store).map((product) => ({
            source,
            product,
            score: scoreProductMatch(product, action.product_query || {}),
          })),
        )
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score)

      if (candidates.length === 0) {
        return {
          index,
          status: 'missing',
          issue: 'Mos mahsulot topilmadi.',
          action,
        }
      }

      const best = candidates[0]
      const second = candidates[1]
      if (second && best.score - second.score < 8) {
        return {
          index,
          status: 'ambiguous',
          issue: "Bir nechta mahsulot mos keldi. Buyruqni aniqroq yozing.",
          action,
          candidates: candidates.slice(0, 3).map((entry) => ({
            source: entry.source,
            name: formatProductName(entry.product),
          })),
        }
      }

      const resolvedProduct = best.product
      const unit = action.unit || (isMeterCategory(resolvedProduct) ? 'metr' : 'dona')
      const quantity = Number(action.quantity || 0)
      const unitPrice = action.unit_price != null
        ? Number(action.unit_price)
        : Number(unit === 'dona' ? (resolvedProduct.price_piece ?? resolvedProduct.price) : resolvedProduct.price) || 0
      const available = getAvailableQuantity(resolvedProduct, unit)

      let status = 'ready'
      let issue = ''

      if (quantity <= 0) {
        status = 'invalid'
        issue = "Miqdor noto'g'ri."
      } else if (action.type === 'sell_product' && quantity > available) {
        status = 'invalid'
        issue = `Mavjud miqdor yetmaydi. Mavjud: ${available} ${unit}.`
      } else if (unitPrice < 0) {
        status = 'invalid'
        issue = "Narx noto'g'ri."
      }

      return {
        index,
        status,
        issue,
        action: {
          ...action,
          source: best.source,
          quantity,
          unit,
          unit_price: unitPrice,
          currency: action.currency || resolvedProduct.currency || 'UZS',
        },
        resolvedProduct,
        preview: {
          displayName: formatProductName(resolvedProduct),
          source: best.source,
          available,
        },
      }
    }

    if (action.type === 'receive_goods') {
      const quantity = Number(action.quantity || 0)
      const unitPrice = Number(action.unit_price || 0)

      let status = 'ready'
      let issue = ''

      if (quantity <= 0) {
        status = 'invalid'
        issue = "Miqdor noto'g'ri."
      } else if (unitPrice < 0) {
        status = 'invalid'
        issue = "Narx noto'g'ri."
      }

      const location = action.location || 'warehouse'

      return {
        index,
        status,
        issue,
        action: {
          ...action,
          quantity,
          unit_price: unitPrice,
          location,
        },
        preview: {
          displayName: action.product_name,
          location,
          type: 'receive_goods',
        },
      }
    }

    // Default: pass through as ready
    return {
      index,
      status: 'ready',
      issue: '',
      action,
      preview: {
        displayName: getActionPreviewName(action),
        type: action.type,
      },
    }
  })

  const readyActions = resolvedActions.filter((entry) => entry.status === 'ready')
  const issues = resolvedActions.filter((entry) => entry.status !== 'ready')

  return {
    summary: draft?.summary || '',
    source: draft?.source || 'unknown',
    resolvedActions,
    readyActions,
    issues,
    canConfirm: resolvedActions.length > 0 && issues.length === 0,
  }
}

// Helper to get human-readable preview name for non-product actions
const getActionPreviewName = (action) => {
  const typeLabels = {
    add_client: `Mijoz qo'shish: ${action.client_name || 'Noma\'lum'}`,
    update_client: `Mijoz o'zgarish: ${action.client_query || 'Noma\'lum'}`,
    delete_client: `Mijozni o'chirish: ${action.client_query || 'Noma\'lum'}`,
    add_product: `Mahsulot qo'shish: ${action.product_name || 'Noma\'lum'}`,
    update_product: `Mahsulotni o'zgarish: ${action.product_query?.name || 'Noma\'lum'}`,
    delete_product: `Mahsulotni o'chirish: ${action.product_query?.name || 'Noma\'lum'}`,
    add_credit: `Qarz qo'shish: ${action.client_query || 'Noma\'lum'}`,
    delete_credit: `Qarzni o'chirish`,
    receive_goods: `Qabul qilish: ${action.product_name || 'Noma\'lum'}`,
    adjust_inventory: `Sozlash: ${action.product_query?.name || 'Noma\'lum'}`,
  }
  return typeLabels[action.type] || 'Noma\'lum amal'
}
