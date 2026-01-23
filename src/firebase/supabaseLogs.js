import { supabase } from '/supabase/supabaseClient'

const isSupabaseConfigured = () => {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_KEY
  return url && key && !url.includes('placeholder') && !key.includes('placeholder')
}

export const getLogs = async (user, date = null) => {
  if (!isSupabaseConfigured()) return []
  try {
    let query = supabase.from('logs').select('*').order('created_at', { ascending: false })
    if (date) query = query.eq('date', date)
    const { data, error } = await query
    if (error) throw error
    return data || []
  } catch (err) {
    console.error('getLogs error:', err)
    return []
  }
}

export const insertCreditLog = async (log) => {
  if (!isSupabaseConfigured()) return null
  try {
    // Prefer RPC for credit logs (atomic server-side insert)
    try {
      const rpcPayload = {
        p_user_name: log.user_name || log.user || 'unknown',
        p_action: log.action || 'CREATE_CREDIT',
        p_client_name: log.client_name || log.name || null,
        p_product_name: log.product_name || log.productName || null,
        p_qty: log.qty || null,
        p_price: log.unit_price || log.unitPrice || log.price || null,
        p_amount: log.amount || null,
        p_bosh_toluv: log.bosh_toluv || log.down_payment || null,
        p_currency: log.currency || 'UZS',
        p_detail: log.detail || null
      }
      console.log('Calling RPC log_credit_action ->', rpcPayload)
      const { data: rpcData, error: rpcError } = await supabase.rpc('log_credit_action', rpcPayload)
      if (rpcError) throw rpcError
      // RPC returns void by our definition; return rpc result or null
      return rpcData || null
    } catch (rpcErr) {
      console.warn('RPC log_credit_action failed, falling back to direct insert:', rpcErr)
    }

    // Fallback: direct insert into logs table
    const type = log.credit_type === 'berilgan' ? 'nasia_given' : 'nasia_received'
    const logData = {
      ...log,
      kind: 'credit',
      type,
      product_name: log.product_name || log.productName,
      qty: log.qty,
      unit_price: log.unit_price || log.unitPrice,
      amount: log.amount
    }

    console.log('supabase.insertCreditLog ->', logData)
    const { data, error } = await supabase
      .from('logs')
      .insert(logData)
      .select('*')
      .single()
    if (error) throw error
    console.log('supabase.insertCreditLog success ->', data)
    return data
  } catch (err) {
    console.error('insertCreditLog error:', err)
    const msg = err?.message || err?.error || JSON.stringify(err)
    if (typeof msg === 'string' && msg.includes("Could not find the table 'public.logs'")) {
      console.warn('Supabase logs table not found. Continuing without remote log storage.')
      return null
    }
    console.warn('insertCreditLog failed, continuing without remote log. Details:', msg)
    return null
  }
}

export const insertLog = async (log) => {
  if (!isSupabaseConfigured()) return null
  
  try {
    // Normalize log data for insertion
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

    console.log('[insertLog] Writing to Supabase:', logData)

    const { data, error } = await supabase
      .from('logs')
      .insert([logData])
      .select()
      .single()

    if (error) {
      console.error('[insertLog] Database error:', error)
      throw error
    }

    console.log('[insertLog] Success - inserted:', data)
    return data
  } catch (err) {
    console.error('[insertLog] Failed:', err?.message || err)
    const msg = err?.message || err?.error || JSON.stringify(err)
    
    // Only suppress if table truly doesn't exist
    if (typeof msg === 'string' && msg.includes("Could not find the table 'public.logs'")) {
      console.warn('[insertLog] Table not found - logs table missing in Supabase')
      return null
    }
    
    // For all other errors, throw so parent handler can retry or log
    throw err
  }
}