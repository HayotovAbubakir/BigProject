import { supabase } from '/supabase/supabaseClient'

const isSupabaseConfigured = () => {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_KEY
  return url && key && !url.includes('placeholder') && !key.includes('placeholder')
}

export const getCredits = async () => {
  if (!isSupabaseConfigured()) return []
  try {
    const { data, error } = await supabase
      .from('credits')
      .select('*')
      .order('created_at', { ascending: false })
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
    // Ensure created_at (epoch seconds) and created_by are present
    // Build a sanitized payload mapping common frontend keys to DB columns
    const created_at = credit.created_at || Math.floor(Date.now() / 1000)
    const created_by = credit.created_by || credit.user || 'shared'
    const allowedMap = {
      id: 'id',
      name: 'name',
      date: 'date',
      amount: 'amount',
      amount_uzs: 'amount_uzs',
      currency: 'currency',
      type: 'type',
      creditType: 'type',
      credit_type: 'type',
      product_id: 'product_id',
      productId: 'product_id',
      product_name: 'product_name',
      productName: 'product_name',
      qty: 'qty',
      price: 'price',
      unit_price: 'price',
      price_uzs: 'price_uzs',
      priceUzs: 'price_uzs',
      client_id: 'client_id',
      clientId: 'client_id',
      bosh_toluv: 'bosh_toluv',
      boshToluv: 'bosh_toluv',
      bosh_toluv_note: 'bosh_toluv_note',
      boshToluvNote: 'bosh_toluv_note',
      stored: 'stored',
      given: 'given',
      location: 'location',
      note: 'note',
      completed: 'completed',
      completed_at: 'completed_at',
      completed_by: 'completed_by',
      created_at: 'created_at',
      created_by: 'created_by'
    }

    const payload = { created_at, created_by }
    Object.keys(credit || {}).forEach(k => {
      const mapped = allowedMap[k]
      if (mapped) payload[mapped] = credit[k]
    })

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

export const updateCredit = async (id, updates) => {
  if (!isSupabaseConfigured()) return null
  try {
    // Remove 'id' from updates to avoid trying to update the primary key
    const { id: _, ...safeUpdatesRaw } = updates
    const safeUpdates = {}
    const allowedMap = {
      name: 'name', date: 'date', amount: 'amount', amount_uzs: 'amount_uzs', currency: 'currency', type: 'type', creditType: 'type', credit_type: 'type', product_id: 'product_id', productId: 'product_id', product_name: 'product_name', productName: 'product_name', qty: 'qty', price: 'price', unit_price: 'price', price_uzs: 'price_uzs', priceUzs: 'price_uzs', client_id: 'client_id', clientId: 'client_id', bosh_toluv: 'bosh_toluv', boshToluv: 'bosh_toluv', bosh_toluv_note: 'bosh_toluv_note', boshToluvNote: 'bosh_toluv_note', stored: 'stored', given: 'given', location: 'location', note: 'note', completed: 'completed', completed_at: 'completed_at', completed_by: 'completed_by', created_at: 'created_at', created_by: 'created_by'
    }
    Object.keys(safeUpdatesRaw || {}).forEach(k => {
      const mapped = allowedMap[k]
      if (mapped) safeUpdates[mapped] = safeUpdatesRaw[k]
    })
    console.log('supabase.updateCredit ->', id, safeUpdates)
    const { data, error } = await supabase
      .from('credits')
      .update(safeUpdates)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    console.log('supabase.updateCredit success ->', data)
    return data
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
    const { error } = await supabase
      .from('credits')
      .delete()
      .eq('id', id)
    if (error) throw error
    console.log('supabase.deleteCredit success ->', id)
    return true
  } catch (err) {
    console.error('deleteCredit error:', err)
    const msg = err?.message || err?.error || JSON.stringify(err)
    throw new Error(`deleteCredit failed: ${msg}`)
  }
}