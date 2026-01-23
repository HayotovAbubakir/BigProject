import { supabase } from '/supabase/supabaseClient'

const isSupabaseConfigured = () => {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_KEY
  return url && key && !url.includes('placeholder') && !key.includes('placeholder')
}

/**
 * Update user account balance in Supabase
 * @param {string} username - Username to update
 * @param {number} deltaUzs - Amount in UZS to add (can be negative)
 * @param {number} deltaUsd - Amount in USD to add (default 0)
 * @returns {Promise<object>} Updated account object
 */
export const updateAccountBalance = async (username, deltaUzs, deltaUsd = 0) => {
  if (!isSupabaseConfigured()) {
    console.warn('[updateAccountBalance] Supabase not configured')
    return null
  }

  try {
    console.log(`[updateAccountBalance] Updating ${username}: +${deltaUzs} UZS, +${deltaUsd} USD`)

    // Try RPC function first
    try {
      const { data, error } = await supabase.rpc('update_user_balance', {
        p_username: username.toLowerCase(),
        p_delta_uzs: Number(deltaUzs),
        p_delta_usd: Number(deltaUsd)
      })

      if (error && error.message && error.message.includes('Could not find the function')) {
        console.warn('[updateAccountBalance] RPC function not found, skipping balance update')
        return null
      }

      if (error) throw error
      console.log('[updateAccountBalance] Success via RPC:', data)
      return data
    } catch (rpcErr) {
      console.warn('[updateAccountBalance] RPC failed:', rpcErr?.message)
      console.warn('[updateAccountBalance] This is OK if migration hasnt been run yet')
      return null
    }
  } catch (err) {
    console.error('[updateAccountBalance] Failed:', err?.message || err)
    return null
  }
}

/**
 * Update daily sales record for a user
 * Atomically increments or creates daily sales total
 * @param {string} username - Username
 * @param {number} salesUzs - Sales amount in UZS
 * @param {number} salesUsd - Sales amount in USD (default 0)
 * @param {string} date - Date (default today)
 * @returns {Promise<object>} Updated daily_sales record
 */
export const updateDailySales = async (username, salesUzs, salesUsd = 0, date = null) => {
  if (!isSupabaseConfigured()) {
    console.warn('[updateDailySales] Supabase not configured')
    return null
  }

  const targetDate = date || new Date().toISOString().slice(0, 10)

  try {
    console.log(`[updateDailySales] User: ${username}, Date: ${targetDate}, +${salesUzs} UZS, +${salesUsd} USD`)

    // Try RPC function first
    try {
      const { data, error } = await supabase.rpc('update_daily_sales', {
        p_user_name: username.toLowerCase(),
        p_date: targetDate,
        p_total_uzs: Number(salesUzs),
        p_total_usd: Number(salesUsd)
      })

      if (error && error.message && error.message.includes('Could not find the function')) {
        console.warn('[updateDailySales] RPC function not found, skipping daily sales update')
        return null
      }

      if (error) throw error
      console.log('[updateDailySales] Success via RPC:', data)
      return data
    } catch (rpcErr) {
      console.warn('[updateDailySales] RPC failed:', rpcErr?.message)
      console.warn('[updateDailySales] This is OK if migration hasnt been run yet')
      return null
    }
  } catch (err) {
    console.error('[updateDailySales] Failed:', err?.message || err)
    return null
  }
}

/**
 * Get user account balance from Supabase
 * @param {string} username - Username
 * @returns {Promise<object>} Account balance object {balance_uzs, balance_usd}
 */
export const getAccountBalance = async (username) => {
  if (!isSupabaseConfigured()) {
    console.warn('[getAccountBalance] Supabase not configured')
    return { balance_uzs: 0, balance_usd: 0 }
  }

  try {
    const { data, error } = await supabase
      .from('user_credentials')
      .select('balance_uzs, balance_usd')
      .eq('username', username.toLowerCase())
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('[getAccountBalance] Query error:', error)
      throw error
    }

    const result = data || { balance_uzs: 0, balance_usd: 0 }
    console.log(`[getAccountBalance] ${username}:`, result)
    return result
  } catch (err) {
    console.error('[getAccountBalance] Failed:', err?.message || err)
    return { balance_uzs: 0, balance_usd: 0 }
  }
}

/**
 * Get daily sales for a user
 * @param {string} username - Username
 * @param {string} date - Date (default today)
 * @returns {Promise<object>} Daily sales record or null if not found
 */
export const getDailySalesRecord = async (username, date = null) => {
  if (!isSupabaseConfigured()) {
    console.warn('[getDailySalesRecord] Supabase not configured')
    return null
  }

  const targetDate = date || new Date().toISOString().slice(0, 10)

  try {
    const { data, error } = await supabase
      .from('daily_sales')
      .select('*')
      .eq('user_name', username.toLowerCase())
      .eq('date', targetDate)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('[getDailySalesRecord] Query error:', error)
      throw error
    }

    console.log(`[getDailySalesRecord] ${username} on ${targetDate}:`, data)
    return data || null
  } catch (err) {
    console.error('[getDailySalesRecord] Failed:', err?.message || err)
    return null
  }
}

/**
 * Get today's sales summary for all users (account_by_sales)
 * @returns {Promise<array>} Array of daily sales records
 */
export const getTodaysSalesSummary = async () => {
  if (!isSupabaseConfigured()) {
    console.warn('[getTodaysSalesSummary] Supabase not configured')
    return []
  }

  const today = new Date().toISOString().slice(0, 10)

  try {
    const { data, error } = await supabase
      .from('daily_sales')
      .select('*')
      .eq('date', today)

    if (error) {
      console.error('[getTodaysSalesSummary] Query error:', error)
      throw error
    }

    console.log('[getTodaysSalesSummary] Results:', data)
    return data || []
  } catch (err) {
    console.error('[getTodaysSalesSummary] Failed:', err?.message || err)
    return []
  }
}

/**
 * Get all user credentials with balances
 * @returns {Promise<array>} Array of user accounts with balance info
 */
export const getAllUserBalances = async () => {
  if (!isSupabaseConfigured()) {
    console.warn('[getAllUserBalances] Supabase not configured')
    return []
  }

  try {
    // Try to get balance columns if they exist
    let { data, error } = await supabase
      .from('user_credentials')
      .select('username, balance_uzs, balance_usd, role, permissions')

    // If columns don't exist, try basic query
    if (error && error.message && error.message.includes('column')) {
      console.warn('[getAllUserBalances] Balance columns not found, using basic query')
      const { data: basicData, error: basicError } = await supabase
        .from('user_credentials')
        .select('username, role, permissions')
      
      if (basicError) throw basicError
      
      // Add default balances if columns missing
      data = (basicData || []).map(u => ({
        ...u,
        balance_uzs: 0,
        balance_usd: 0
      }))
    } else if (error) {
      throw error
    }

    console.log('[getAllUserBalances] Results:', data)
    return data || []
  } catch (err) {
    console.error('[getAllUserBalances] Failed:', err?.message || err)
    console.warn('[getAllUserBalances] Returning empty array (columns may not exist in Supabase)')
    return []
  }
}
