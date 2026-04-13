import { supabase } from '/supabase/supabaseClient'
import { safeLimit } from '../utils/network'

const isSupabaseConfigured = () => {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_KEY
  return url && key && !url.includes('placeholder') && !key.includes('placeholder')
}

// Some Supabase schemas don't have an `updated_at` column for clients.
// Avoid requesting it directly to prevent PostgREST errors when the column is missing.
const CLIENT_COLUMNS = 'id,name,phone,created_at'

export const getClients = async (options = {}) => {
  if (!isSupabaseConfigured()) return []
  const limit = typeof options.limit === 'number' ? options.limit : safeLimit(120, 20)
  const offset = options.offset || 0
  const columns = options.columns || CLIENT_COLUMNS

  try {
    const { data, error } = await supabase
      .from('clients')
      .select(columns)
      // Order by created_at if updated_at is not available in the schema
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
    if (error) throw error
    return data || []
  } catch (err) {
    console.error('getClients error:', err)
    return []
  }
}

export const insertClient = async (client) => {
  if (!isSupabaseConfigured()) return null
  try {
    console.log('supabase.insertClient ->', client)
    const { data, error } = await supabase
      .from('clients')
      .insert({ ...client })
      .select(CLIENT_COLUMNS)
      .single()
    if (error) throw error
    console.log('supabase.insertClient success ->', data)
    return data
  } catch (err) {
    console.error('insertClient error:', err)
    const msg = err?.message || err?.error || JSON.stringify(err)
    throw new Error(`insertClient failed: ${msg}`)
  }
}

export const updateClient = async (id, updates) => {
  if (!isSupabaseConfigured()) return null
  try {
    // Remove 'id' from updates to avoid trying to update the primary key
    const { id: _, ...safeUpdatesRaw } = updates
    const safeUpdates = {}
    const allowedMap = {
      name: 'name',
      phone: 'phone',
    }
    Object.keys(safeUpdatesRaw || {}).forEach(k => {
      const mapped = allowedMap[k]
      if (mapped) safeUpdates[mapped] = safeUpdatesRaw[k]
    })
    console.log('supabase.updateClient ->', id, safeUpdates)
    const { data, error } = await supabase
      .from('clients')
      .update(safeUpdates)
      .eq('id', id)
      .select(CLIENT_COLUMNS)
      .single()
    if (error) throw error
    console.log('supabase.updateClient success ->', data)
    return data
  } catch (err) {
    console.error('updateClient error:', err)
    const msg = err?.message || err?.error || JSON.stringify(err)
    throw new Error(`updateClient failed: ${msg}`)
  }
}

export const deleteClient = async (id) => {
  if (!isSupabaseConfigured()) return false
  try {
    console.log('supabase.deleteClient ->', id)
    
    // First, delete all credits for this client
    const { error: deleteCreditsError } = await supabase
      .from('credits')
      .delete()
      .eq('client_id', id)
    
    if (deleteCreditsError) throw deleteCreditsError
    
    // Now delete the client
    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', id)
    if (error) throw error
    console.log('supabase.deleteClient success ->', id)
    return true
  } catch (err) {
    console.error('deleteClient error:', err)
    const msg = err?.message || err?.error || JSON.stringify(err)
    throw new Error(`deleteClient failed: ${msg}`)
  }
}
