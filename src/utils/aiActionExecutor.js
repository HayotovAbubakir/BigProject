import { v4 as uuidv4 } from 'uuid'
import { getProducts, insertProduct, updateProduct, deleteProduct } from '../firebase/supabaseInventory'
import { insertLog } from '../firebase/supabaseLogs'
import { updateAccountBalance, updateDailySales } from '../firebase/supabaseAccounts'
import { getClients, insertClient, updateClient, deleteClient } from '../firebase/supabaseClients'
import { getCredits, insertCredit, deleteCredit } from '../firebase/supabaseCredits'
import { formatProductName } from './productDisplay'
import { isMeterCategory } from './productCategories'

const toClock = (date = new Date()) => date.toLocaleTimeString('en-GB', { hour12: false })

// Helper: Find client by fuzzy name match
const findClientByName = async (clientQuery) => {
  try {
    const clients = await getClients({ limit: 500 })
    const query = (clientQuery || '').toString().toLowerCase().trim()
    if (!query) return null

    const scored = clients.map(c => ({
      client: c,
      score: c.name.toLowerCase().includes(query) ? 100 : 0,
    }))
    scored.sort((a, b) => b.score - a.score)
    return scored[0]?.score > 0 ? scored[0].client : null
  } catch (err) {
    console.error('findClientByName error:', err)
    throw new Error(`Mijoz qidiruvda xato: ${err.message}`)
  }
}

// Helper: Find product by fuzzy name match
const findProductByName = async (productQuery, location = null) => {
  try {
    const products = await getProducts(location, { limit: 500 })
    const query = (productQuery?.name || productQuery || '').toString().toLowerCase().trim()
    if (!query) return null

    const scored = products.map(p => ({
      product: p,
      score: p.name.toLowerCase().includes(query) ? 100 : 0,
    }))
    scored.sort((a, b) => b.score - a.score)
    return scored[0]?.score > 0 ? scored[0].product : null
  } catch (err) {
    console.error('findProductByName error:', err)
    throw new Error(`Mahsulot qidiruvda xato: ${err.message}`)
  }
}

// Execute sell_product action
const executeSellProduct = async ({
  action,
  username,
  exchangeRate,
}) => {
  // Get products for resolution
  const warehouse = await getProducts('warehouse', { limit: 500 })
  const store = await getProducts('store', { limit: 500 })
  
  const sources = action.source ? [action.source] : ['warehouse', 'store']
  let product = null
  let selectedSource = null

  for (const source of sources) {
    const products = source === 'warehouse' ? warehouse : store
    const found = products.find(p => p.name.toLowerCase().includes((action.product_query?.name || '').toLowerCase()))
    if (found) {
      product = found
      selectedSource = source
      break
    }
  }

  if (!product) throw new Error(`Mahsulot topilmadi: ${action.product_query?.name}`)

  const isMeter = isMeterCategory(product)
  const saleUnit = action.unit || (isMeter ? 'metr' : 'dona')
  const qty = Number(action.quantity || 0)
  const packQty = Number(product.pack_qty || 0)
  const meterSold = isMeter ? (saleUnit === 'dona' ? qty * packQty : qty) : 0
  const amount = qty * Number(action.unit_price || 0)
  const saleCurrency = action.currency || product.currency || 'UZS'
  const displayName = formatProductName(product)
  const totalUzs = saleCurrency === 'USD' && exchangeRate ? Math.round(amount * Number(exchangeRate)) : Math.round(amount)
  const totalUsd = saleCurrency === 'USD' ? amount : 0

  const unitLabel = isMeter ? `, Birlik: ${saleUnit}` : ''
  const meterLabel = isMeter ? `, Metr: ${meterSold} m` : ''
  const log = {
    id: uuidv4(),
    date: new Date().toISOString().slice(0, 10),
    time: toClock(),
    user_name: username || 'Admin',
    action: selectedSource === 'warehouse' ? "AI orqali ombordan mahsulot sotildi" : "AI orqali do'kondan mahsulot sotildi",
    kind: 'SELL',
    product_name: displayName,
    product_id: product.id,
    qty: isMeter ? meterSold : qty,
    unit_price: Number(action.unit_price || 0),
    amount,
    currency: saleCurrency,
    total_uzs: totalUzs,
    detail: `AI buyruq: ${displayName}, Soni: ${qty}${unitLabel}${meterLabel}, Narx: ${Number(action.unit_price || 0)} ${saleCurrency}`,
    source: selectedSource,
  }

  await insertLog(log)

  if (isMeter) {
    const baseMeter = Number(product.meter_qty ?? (Number(product.qty || 0) * packQty))
    const newMeter = Math.max(0, baseMeter - meterSold)
    const newQty = packQty > 0 ? Math.ceil(newMeter / Math.max(1, packQty)) : Math.max(0, Number(product.qty || 0) - (saleUnit === 'dona' ? qty : 0))
    await updateProduct(product.id, { qty: newQty, meter_qty: newMeter })
  } else {
    const newQty = Math.max(0, Number(product.qty || 0) - qty)
    await updateProduct(product.id, { qty: newQty })
  }

  await updateAccountBalance(username, totalUzs, totalUsd)
  await updateDailySales(username, totalUzs, totalUsd)

  return { totalUzs, totalUsd, log }
}

// Execute receive_goods action
const executeReceiveGoods = async ({
  action,
  username,
}) => {
  const {
    product_name,
    category,
    quantity,
    unit_price,
    currency,
    location,
    electrode_size,
    stone_thickness,
    stone_size,
    note,
  } = action

  const newProduct = {
    name: product_name,
    category,
    qty: quantity,
    price: unit_price,
    currency,
    location,
    electrode_size: electrode_size || null,
    stone_thickness: stone_thickness || null,
    stone_size: stone_size || null,
    note: note || `AI orqali qabul qilingan: ${new Date().toLocaleString('uz-UZ')}`,
    date: new Date().toISOString().slice(0, 10),
  }

  const product = await insertProduct(newProduct)
  
  const log = {
    id: uuidv4(),
    date: new Date().toISOString().slice(0, 10),
    time: toClock(),
    user_name: username || 'Admin',
    action: `AI orqali ${location} mahsulot qabul qilindi`,
    kind: 'RECEIVE',
    product_name,
    product_id: product.id,
    qty: quantity,
    unit_price,
    amount: quantity * unit_price,
    currency,
    detail: `AI qabul: ${product_name}, Soni: ${quantity}, Narx: ${unit_price} ${currency}`,
    source: location,
  }

  await insertLog(log)
  return { product, log }
}

// Execute adjust_inventory action
const executeAdjustInventory = async ({
  action,
  username,
}) => {
  const { product_query, adjustment_qty, adjustment_type, location, reason } = action

  const product = await findProductByName(product_query, location)
  if (!product) throw new Error(`Mahsulot topilmadi: ${product_query?.name || product_query}`)

  const currentQty = Number(product.qty || 0)
  const newQty = adjustment_type === 'add' ? currentQty + adjustment_qty : Math.max(0, currentQty - adjustment_qty)

  await updateProduct(product.id, { qty: newQty })

  const log = {
    id: uuidv4(),
    date: new Date().toISOString().slice(0, 10),
    time: toClock(),
    user_name: username || 'Admin',
    action: `AI orqali inventar ${adjustment_type === 'add' ? 'qo\'shildi' : 'olib tashlandi'}`,
    kind: adjustment_type === 'add' ? 'ADJUST_ADD' : 'ADJUST_REMOVE',
    product_name: product.name,
    product_id: product.id,
    qty: adjustment_qty,
    detail: `AI sozlash: ${product.name}, ${adjustment_type}: ${adjustment_qty}, Sabab: ${reason}`,
    source: location,
  }

  await insertLog(log)
  return { product, log }
}

// Execute add_client action
const executeAddClient = async ({
  action,
  username,
}) => {
  const { client_name, client_phone } = action

  const client = await insertClient({
    name: client_name,
    phone: client_phone || null,
  })

  const log = {
    id: uuidv4(),
    date: new Date().toISOString().slice(0, 10),
    time: toClock(),
    user_name: username || 'Admin',
    action: `AI orqali yangi mijoz qo'shildi`,
    kind: 'CLIENT_ADD',
    detail: `Mijoz: ${client_name}${client_phone ? `, Tel: ${client_phone}` : ''}`,
  }

  return { client, log }
}

// Execute update_client action
const executeUpdateClient = async ({
  action,
  username,
}) => {
  const { client_query, update_field, update_value } = action

  const client = await findClientByName(client_query)
  if (!client) throw new Error(`Mijoz topilmadi: ${client_query}`)

  const updated = await updateClient(client.id, {
    [update_field]: update_value,
  })

  const log = {
    id: uuidv4(),
    date: new Date().toISOString().slice(0, 10),
    time: toClock(),
    user_name: username || 'Admin',
    action: `AI orqali mijoz o'zgartirildi`,
    kind: 'CLIENT_UPDATE',
    detail: `Mijoz: ${client.name}, ${update_field}: ${update_value}`,
  }

  return { client: updated, log }
}

// Execute delete_client action
const executeDeleteClient = async ({
  action,
  username,
}) => {
  const { client_query } = action

  const client = await findClientByName(client_query)
  if (!client) throw new Error(`Mijoz topilmadi: ${client_query}`)

  const deleted = await deleteClient(client.id)

  const log = {
    id: uuidv4(),
    date: new Date().toISOString().slice(0, 10),
    time: toClock(),
    user_name: username || 'Admin',
    action: `AI orqali mijoz o'chirildi`,
    kind: 'CLIENT_DELETE',
    detail: `O'chirilgan mijoz: ${client.name}`,
  }

  return { deleted, log }
}

// Execute add_product action
const executeAddProduct = async ({
  action,
  username,
}) => {
  const {
    product_name,
    category,
    quantity,
    unit_price,
    currency,
    location,
    electrode_size,
    stone_thickness,
    stone_size,
    pack_qty,
  } = action

  const newProduct = await insertProduct({
    name: product_name,
    category,
    qty: quantity,
    price: unit_price,
    currency,
    location,
    electrode_size: electrode_size || null,
    stone_thickness: stone_thickness || null,
    stone_size: stone_size || null,
    pack_qty: pack_qty || null,
    date: new Date().toISOString().slice(0, 10),
  })

  const log = {
    id: uuidv4(),
    date: new Date().toISOString().slice(0, 10),
    time: toClock(),
    user_name: username || 'Admin',
    action: `AI orqali yangi mahsulot qo'shildi`,
    kind: 'PRODUCT_ADD',
    product_name,
    product_id: newProduct.id,
    detail: `Mahsulot: ${product_name}, Kategoriya: ${category}, Soni: ${quantity}, Narx: ${unit_price} ${currency}`,
  }

  return { product: newProduct, log }
}

// Execute update_product action
const executeUpdateProduct = async ({
  action,
  username,
}) => {
  const { product_query, update_field, update_value } = action

  const product = await findProductByName(product_query)
  if (!product) throw new Error(`Mahsulot topilmadi: ${product_query?.name}`)

  const updated = await updateProduct(product.id, {
    [update_field]: update_value,
  })

  const log = {
    id: uuidv4(),
    date: new Date().toISOString().slice(0, 10),
    time: toClock(),
    user_name: username || 'Admin',
    action: `AI orqali mahsulot o'zgartirildi`,
    kind: 'PRODUCT_UPDATE',
    product_name: product.name,
    product_id: product.id,
    detail: `Mahsulot: ${product.name}, ${update_field}: ${update_value}`,
  }

  return { product: updated, log }
}

// Execute delete_product action
const executeDeleteProduct = async ({
  action,
  username,
}) => {
  const { product_query } = action

  const product = await findProductByName(product_query)
  if (!product) throw new Error(`Mahsulot topilmadi: ${product_query?.name}`)

  await deleteProduct(product.id)

  const log = {
    id: uuidv4(),
    date: new Date().toISOString().slice(0, 10),
    time: toClock(),
    user_name: username || 'Admin',
    action: `AI orqali mahsulot o'chirildi`,
    kind: 'PRODUCT_DELETE',
    product_name: product.name,
    product_id: product.id,
    detail: `O'chirilgan mahsulot: ${product.name}`,
  }

  return { log }
}

// Execute add_credit action
const executeAddCredit = async ({
  action,
  username,
}) => {
  const { credit_type, client_query, amount, currency, product_query, quantity, note } = action

  const client = await findClientByName(client_query)
  if (!client) throw new Error(`Mijoz topilmadi: ${client_query}`)

  let product = null
  if (credit_type === 'product' && product_query) {
    product = await findProductByName(product_query)
    if (!product) throw new Error(`Mahsulot topilmadi: ${product_query?.name}`)
  }

  const credit = await insertCredit({
    name: client.name,
    client_id: client.id,
    credit_type,
    amount: credit_type === 'cash' ? amount : null,
    currency: credit_type === 'cash' ? currency : null,
    product_id: product?.id || null,
    product_name: product?.name || null,
    qty: product && quantity ? quantity : null,
    unit_price: product?.price || null,
    created_by: username || 'Admin',
    date: new Date().toISOString().slice(0, 10),
    note: note || `AI orqali qo'shilgan qarz`,
  })

  const log = {
    id: uuidv4(),
    date: new Date().toISOString().slice(0, 10),
    time: toClock(),
    user_name: username || 'Admin',
    action: `AI orqali qarz qo'shildi`,
    kind: 'CREDIT_ADD',
    detail: credit_type === 'cash'
      ? `Mijoz: ${client.name}, Summa: ${amount} ${currency}`
      : `Mijoz: ${client.name}, Mahsulot: ${product?.name}, Soni: ${quantity}`,
  }

  return { credit, log }
}

// Execute delete_credit action
const executeDeleteCredit = async ({
  action,
  username,
}) => {
  const { credit_id } = action

  // Get credit first to log details
  const credits = await getCredits({ limit: 500 })
  const credit = credits.find(c => c.id === credit_id)
  if (!credit) throw new Error(`Qarz topilmadi: ${credit_id}`)

  await deleteCredit(credit_id)

  const log = {
    id: uuidv4(),
    date: new Date().toISOString().slice(0, 10),
    time: toClock(),
    user_name: username || 'Admin',
    action: `AI orqali qarz o'chirildi`,
    kind: 'CREDIT_DELETE',
    detail: `O'chirilgan qarz: ${credit.name}`,
  }

  return { log }
}

// Main executor function
export const executeAiActions = async ({
  actions,
  username,
  exchangeRate,
  dispatch,
}) => {
  if (!Array.isArray(actions) || actions.length === 0) {
    throw new Error("Tasdiqlash uchun tayyor amal topilmadi.")
  }

  const results = []
  let totalUzsAll = 0
  let totalUsdAll = 0

  for (const action of actions) {
    try {
      let result = null

      switch (action.type) {
        case 'sell_product':
          result = await executeSellProduct({ action, username, exchangeRate, dispatch })
          totalUzsAll += result.totalUzs || 0
          totalUsdAll += result.totalUsd || 0
          break

        case 'receive_goods':
          result = await executeReceiveGoods({ action, username, dispatch })
          break

        case 'adjust_inventory':
          result = await executeAdjustInventory({ action, username, dispatch })
          break

        case 'add_client':
          result = await executeAddClient({ action, username })
          break

        case 'update_client':
          result = await executeUpdateClient({ action, username })
          break

        case 'delete_client':
          result = await executeDeleteClient({ action, username })
          break

        case 'add_product':
          result = await executeAddProduct({ action, username })
          break

        case 'update_product':
          result = await executeUpdateProduct({ action, username })
          break

        case 'delete_product':
          result = await executeDeleteProduct({ action, username })
          break

        case 'add_credit':
          result = await executeAddCredit({ action, username })
          break

        case 'delete_credit':
          result = await executeDeleteCredit({ action, username })
          break

        default:
          throw new Error(`Noma'lum amal turi: ${action.type}`)
      }

      if (result?.log) {
        await insertLog(result.log)
      }

      results.push({ action: action.type, success: true, result })
    } catch (err) {
      results.push({
        action: action.type,
        success: false,
        error: err.message || 'Noma\'lum xato',
      })
    }
  }

  // Reload products
  if (dispatch) {
    try {
      const [warehouse, store] = await Promise.all([
        getProducts('warehouse', { limit: 500 }),
        getProducts('store', { limit: 500 }),
      ])
      dispatch({ type: 'SET_WAREHOUSE', payload: Array.isArray(warehouse) ? warehouse : warehouse?.data || [] })
      dispatch({ type: 'SET_STORE', payload: Array.isArray(store) ? store : store?.data || [] })
    } catch (err) {
      console.error('Error reloading products:', err)
    }
  }

  return {
    totalUzs: totalUzsAll,
    totalUsd: totalUsdAll,
    count: actions.length,
    results,
  }
}

// Backwards compatibility wrapper for existing code
export const executeAiSellActions = async ({
  actions,
  username,
  exchangeRate,
  dispatch,
}) => {
  return executeAiActions({
    actions,
    username,
    exchangeRate,
    dispatch,
    actionType: 'sell',
  })
}
