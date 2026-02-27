import { supabase } from '/supabase/supabaseClient'
import { safeLimit } from '../utils/network'

const isSupabaseConfigured = () => {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_KEY
  return url && key && !url.includes('placeholder') && !key.includes('placeholder')
}

const CREDIT_COLUMNS = [
  'id',
  'name',
  'amount',
  'currency',
  'credit_type',
  'product_id',
  'product_name',
  'qty',
  'unit_price',
  'client_id',
  'bosh_toluv',
  'bosh_toluv_currency',
  'bosh_toluv_original',
  'completed',
  'created_at',
  'created_by',
  'date',
  'note',
  'down_payment_note',
].join(',')

export const getCredits = async (options = {}) => {
  if (!isSupabaseConfigured()) return []
  const limit = typeof options.limit === 'number' ? options.limit : safeLimit(120, 20)
  const offset = options.offset || 0
  const columns = options.columns || CREDIT_COLUMNS

  try {
    const { data, error } = await supabase
      .from('credits')
      .select(columns)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
    if (error) throw error
    return data || []
  } catch (err) {
    console.error('getCredits error:', err)
    return []
  }
}

export const insertCredit = async (credit) => {
  if (!isSupabaseConfigured()) return null
  try {
    console.log('supabase.insertCredit ->', credit)
    
    // Ensure created_at is ISO 8601 string format
    if (typeof credit.created_at === 'number') {
      credit.created_at = new Date(credit.created_at * 1000).toISOString();
    } else if (!credit.created_at) {
      credit.created_at = new Date().toISOString();
    }
    
    const created_by = credit.created_by || credit.user || 'shared'
    const allowedMap = {
      id: 'id',
      name: 'name',
      note: 'note',
      down_payment_note: 'down_payment_note',
      date: 'date',
      amount: 'amount',
      currency: 'currency',
      creditType: 'credit_type',
      type: 'credit_type',
      product_id: 'product_id',
      productId: 'product_id',
      product_name: 'product_name',
      productName: 'product_name',
      qty: 'qty',
      unit_price: 'unit_price',
      price: 'unit_price',
      client_id: 'client_id',
      clientId: 'client_id',
      bosh_toluv: 'bosh_toluv',
      boshToluv: 'bosh_toluv',
      bosh_toluv_currency: 'bosh_toluv_currency',
      boshToluvCurrency: 'bosh_toluv_currency',
      bosh_toluv_original: 'bosh_toluv_original',
      boshToluvOriginal: 'bosh_toluv_original',
      completed: 'completed',
      created_at: 'created_at',
      created_by: 'created_by'
    }

    const payload = { created_at: credit.created_at, created_by }
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
        
        // Validate credit_type field - must be 'product' or 'cash'
        if (mapped === 'credit_type') {
          if (!['product', 'cash'].includes(value)) {
            // Skip invalid credit_type; will be set to default below
            return
          }
        }
        
        payload[mapped] = value
      }
    })
    
    // CRITICAL: Ensure credit_type is set to a valid value
    if (!payload.credit_type) {
      // Determine from form data: if has product details, it's 'product', else 'cash'
      const hasProductDetails = credit.qty || credit.price || credit.product_name
      payload.credit_type = hasProductDetails ? 'product' : 'cash'
    }
    // Ensure amount is provided: compute from qty * unit_price for product credits
    if (payload.amount === undefined || payload.amount === null) {
      const qty = Number(payload.qty || 0)
      const unit = Number(payload.unit_price || payload.price || 0)
      payload.amount = qty && unit ? qty * unit : (payload.amount_uzs || 0)
    }
    
    if (typeof payload.created_at !== 'string') {
        payload.created_at = new Date(payload.created_at).toISOString();
    }

    console.log('supabase.insertCredit payload ->', payload);

    try {
      const { data, error } = await supabase
        .from('credits')
        .insert(payload)
        .select(CREDIT_COLUMNS)
        .single()
      if (error) throw error
      console.log('supabase.insertCredit success ->', data)
      return data
    } catch (err) {
      // If the Supabase schema is missing new down-payment columns (bosh_toluv_*),
      // retry once without them so the app remains usable until the migration is applied.
      const message = (err?.message || err?.details || '').toString()
      const missingDownPaymentColumns =
        /bosh_toluv_currency|bosh_toluv_original/i.test(message) &&
        /schema cache|Could not find/i.test(message)

      if (missingDownPaymentColumns) {
        console.warn('insertCredit: missing down-payment columns in DB schema - retrying without them')
        const { bosh_toluv_currency, bosh_toluv_original, ...safePayload } = payload
        const { data: data2, error: error2 } = await supabase
          .from('credits')
          .insert(safePayload)
          .select(CREDIT_COLUMNS)
          .single()

        if (error2) throw error2
        console.log('supabase.insertCredit success (without bosh_toluv columns) ->', data2)
        return data2
      }

      // If the referenced product_id does not exist in Supabase (FK violation), retry once without product_id
      const fkProductMissing =
        err?.code === '23503' ||
        /foreign key constraint \"credits_product_id_fkey\"/i.test(message) ||
        /credits_product_id_fkey/i.test(err?.hint || '')

      if (fkProductMissing && payload.product_id) {
        console.warn('insertCredit: product_id missing in DB - retrying without product link')
        const { product_id, ...withoutProduct } = payload
        const { data: data3, error: error3 } = await supabase
          .from('credits')
          .insert(withoutProduct)
          .select(CREDIT_COLUMNS)
          .single()

        if (error3) throw error3
        console.log('supabase.insertCredit success (without product_id) ->', data3)
        return data3
      }

      throw err
    }
  } catch (err) {
    console.error('insertCredit error:', err)
    const msg = err?.message || err?.error || JSON.stringify(err)
    throw new Error(`insertCredit failed: ${msg}`)
  }
}

export const updateCredit = async (id, updates) => {
  if (!isSupabaseConfigured()) return null
  try {
    // Remove 'id' from updates to avoid trying to update the primary key
    const { id: _, ...safeUpdatesRaw } = updates
    const safeUpdates = {}
    const allowedMap = {
      name: 'name',
      date: 'date',
      amount: 'amount',
      currency: 'currency',
      creditType: 'credit_type',
      type: 'credit_type',
      product_id: 'product_id',
      productId: 'product_id',
      product_name: 'product_name',
      productName: 'product_name',
      qty: 'qty',
      price: 'unit_price',
      unit_price: 'unit_price',
      client_id: 'client_id',
      clientId: 'client_id',
      bosh_toluv: 'bosh_toluv',
      boshToluv: 'bosh_toluv',
      bosh_toluv_currency: 'bosh_toluv_currency',
      boshToluvCurrency: 'bosh_toluv_currency',
      bosh_toluv_original: 'bosh_toluv_original',
      boshToluvOriginal: 'bosh_toluv_original',
      completed: 'completed',
      completed_at: 'completed_at',
      completed_by: 'completed_by',
      note: 'note',
      down_payment_note: 'down_payment_note',
      // Do NOT allow direct updates to `remaining` here - remaining is computed
      // in the DB schema (generated) and cannot be set directly. Updates that
      // affect remaining should update source columns (amount, bosh_toluv, etc.).
      created_by: 'created_by'
    }
    Object.keys(safeUpdatesRaw || {}).forEach(k => {
      const mapped = allowedMap[k]
      if (mapped) {
        let value = safeUpdatesRaw[k]
        // Ensure date is in YYYY-MM-DD format
        if (mapped === 'date') {
          if (!value) {
            value = new Date().toISOString().slice(0, 10)
          } else if (typeof value === 'string' && !value.match(/^\d{4}-\d{2}-\d{2}$/)) {
            try {
              const dateObj = new Date(value)
              if (!isNaN(dateObj.getTime())) {
                value = dateObj.toISOString().slice(0, 10)
              }
            } catch {
              value = new Date().toISOString().slice(0, 10)
            }
          }
        }
        safeUpdates[mapped] = value
      }
    })
    console.log('supabase.updateCredit ->', id, safeUpdates)
    try {
      const { data, error } = await supabase
        .from('credits')
        .update(safeUpdates)
        .eq('id', id)
        .select(CREDIT_COLUMNS)
        .single()
      if (error) throw error
      console.log('supabase.updateCredit success ->', data)
      return data
    } catch (err) {
      // Handle partially-migrated schemas that lack bosh_toluv columns.
      const message = (err?.message || err?.details || '').toString()
      const missingDownPaymentColumns =
        /bosh_toluv_currency|bosh_toluv_original/i.test(message) &&
        /schema cache|Could not find/i.test(message)

      if (missingDownPaymentColumns) {
        console.warn('updateCredit: missing down-payment columns in DB schema - retrying without them')
        const { bosh_toluv_currency, bosh_toluv_original, ...safeWithoutDownPayment } = safeUpdates
        const { data: data2, error: error2 } = await supabase
          .from('credits')
          .update(safeWithoutDownPayment)
          .eq('id', id)
          .select(CREDIT_COLUMNS)
          .single()

        if (error2) throw error2
        console.log('supabase.updateCredit success (without bosh_toluv columns) ->', data2)
        return data2
      }

      throw err
    }
  } catch (err) {
    console.error('updateCredit error:', err)
    const msg = err?.message || err?.error || JSON.stringify(err)
    throw new Error(`updateCredit failed: ${msg}`)
  }
}

export const deleteCredit = async (id) => {
  if (!isSupabaseConfigured()) return false
  try {
    console.log('supabase.deleteCredit ->', id)
    const { data, error } = await supabase
      .from('credits')
      .delete()
      .eq('id', id)
      .select(CREDIT_COLUMNS)
      .single()
    if (error) throw error
    console.log('supabase.deleteCredit success ->', data)
    return data
  } catch (err) {
    console.error('deleteCredit error:', err)
    const msg = err?.message || err?.error || JSON.stringify(err)
    throw new Error(`deleteCredit failed: ${msg}`)
  }
}
