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
      .select()
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
    // Use RPC when possible for credit-related logs
    if (log && log.kind === 'credit') {
      try {
        const rpcPayload = {
          p_user_name: log.user_name || log.user || 'unknown',
          p_action: log.action || 'ACTION',
          p_client_name: log.client_name || null,
          p_product_name: log.product_name || null,
          p_qty: log.qty || null,
          p_price: log.unit_price || null,
          p_amount: log.amount || null,
          p_bosh_toluv: log.bosh_toluv || null,
          p_currency: log.currency || 'UZS',
          p_detail: log.detail || null
        }
        console.log('Calling RPC log_credit_action from insertLog ->', rpcPayload)
        const { data: rpcData, error: rpcError } = await supabase.rpc('log_credit_action', rpcPayload)
        if (rpcError) throw rpcError
        return rpcData || null
      } catch (rpcErr) {
        console.warn('RPC log_credit_action failed in insertLog, falling back:', rpcErr)
      }
    }

    console.log('supabase.insertLog ->', log)
    const { data, error } = await supabase
      .from('logs')
      .insert(log)
      .select()
      .single()
    if (error) throw error
    console.log('supabase.insertLog success ->', data)
    return data
  } catch (err) {
    // If the logs table doesn't exist in the connected Supabase project,
    // return null and log a clear warning rather than throwing — this
    // prevents the whole UI action (e.g. adding a product) from failing.
    console.error('insertLog error:', err)
    const msg = err?.message || err?.error || JSON.stringify(err)
    if (typeof msg === 'string' && msg.includes("Could not find the table 'public.logs'")) {
      console.warn('Supabase logs table not found. Continuing without remote log storage.')
      return null
    }
    // For other errors, return null but log details so developers can inspect.
    console.warn('insertLog failed, continuing without remote log. Details:', msg)
    return null
  }
}