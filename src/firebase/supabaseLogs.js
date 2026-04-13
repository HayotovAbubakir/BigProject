import { supabase } from '/supabase/supabaseClient'
import { formatMoney, formatInteger } from '../utils/format'
import { safeLimit, isSlowConnection } from '../utils/network'

const isSupabaseConfigured = () => {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_KEY
  return url && key && !url.includes('placeholder') && !key.includes('placeholder')
}

const LOG_COLUMNS = [
  'id',
  'date',
  'time',
  'action',
  'kind',
  'user_name',
  'product_name',
  'product_id',
  'qty',
  'unit_price',
  'amount',
  'currency',
  'total_uzs',
  'detail',
  'created_at',
].join(',')

export const getLogs = async (user, date = null, options = {}) => {
  if (!isSupabaseConfigured()) return []
  const limit = typeof options.limit === 'number' ? options.limit : safeLimit(80, 20)
  const offset = options.offset || 0
  const columns = options.columns || LOG_COLUMNS
  const liteMode = isSlowConnection()

  try {
    let query = supabase
      .from('logs')
      .select(columns)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
    if (date) query = query.eq('date', date)

    const { data, error } = await query
    if (error) throw error
    const logs = data || []

    // Fetch user profiles to enrich logs with full names (acts like a JOIN)
    const usernames = liteMode ? [] : Array.from(new Set(logs
      .map(l => (l.user_name || l.user || l.created_by || '').toString().toLowerCase())
      .filter(Boolean)))

    let profileMap = {}
    if (usernames.length > 0) {
      try {
        let { data: profiles, error: profileErr } = await supabase
          .from('user_profiles')
          .select('username, full_name')
          .in('username', usernames)

        if (profileErr) {
          const msg = (profileErr?.message || profileErr?.details || '').toString()
          const missingFullName = /full_name/i.test(msg) || /column .*full_name does not exist/i.test(msg)
          if (missingFullName) {
            console.warn('[getLogs] user_profiles.full_name missing - retrying without it')
            const { data: basicProfiles, error: basicErr } = await supabase
              .from('user_profiles')
              .select('username')
              .in('username', usernames)
            if (basicErr) throw basicErr
            profiles = (basicProfiles || []).map(p => ({ ...p, full_name: null }))
          } else {
            throw profileErr
          }
        }

        profileMap = (profiles || []).reduce((acc, p) => {
          acc[(p.username || '').toLowerCase()] = p
          return acc
        }, {})
      } catch (profileErr) {
        console.warn('[getLogs] profile lookup failed (fallback to raw usernames):', profileErr?.message || profileErr)
      }
    }

    const enriched = logs.map(l => {
      const uname = (l.user_name || l.user || l.created_by || '').toString().toLowerCase()
      const profile = profileMap[uname]
      const user_full_name = profile?.full_name || null
      const user_username = profile?.username || l.user_name || l.user || null
      const user_display = user_full_name || user_username || "Noma'lum"
      // Add formatted numeric fields for display
      const qty_formatted = l.qty != null ? formatInteger(l.qty) : null
      const unit_price_formatted = l.unit_price != null ? formatMoney(l.unit_price) : null
      const amount_formatted = l.amount != null ? formatMoney(l.amount) : null
      const total_uzs_formatted = l.total_uzs != null ? formatInteger(l.total_uzs) : null

      // Create a display-friendly 'detail_formatted' by replacing long numeric sequences with formatted versions
      const formatNumbersInText = (txt) => {
        if (!txt || typeof txt !== 'string') return txt
        // Replace sequences of digits (4+ digits) optionally with decimals, that are not already formatted with commas
        return txt.replace(/(?<![,\d])(\d{4,}(?:\.\d+)?)(?![,\d])/g, (m) => formatMoney(m))
      }

      const detail_formatted = formatNumbersInText(l.detail)

      return { ...l, user_full_name, user_username, user_display, qty_formatted, unit_price_formatted, amount_formatted, total_uzs_formatted, detail_formatted }
    })

    return enriched
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
      .select(LOG_COLUMNS)
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
      .select(LOG_COLUMNS)
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

// Delete all logs for a given YYYY-MM-DD date
export const deleteLogsForDate = async (date) => {
  if (!isSupabaseConfigured()) return { deleted: 0 }
  const targetDate = (date || '').toString().slice(0, 10)
  if (!targetDate) return { deleted: 0 }
  try {
    const { data, error, count } = await supabase
      .from('logs')
      .delete({ count: 'exact' })
      .eq('date', targetDate)
    if (error) throw error
    return { deleted: count || (data ? data.length : 0) }
  } catch (err) {
    console.error('[deleteLogsForDate] Failed:', err?.message || err)
    throw err
  }
}
