import { supabase } from '/supabase/supabaseClient'

const isSupabaseConfigured = () => {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_KEY
  return url && key && !url.includes('placeholder') && !key.includes('placeholder')
}

export const getClients = async () => {
  if (!isSupabaseConfigured()) return []
  try {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
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
      .insert({ ...client, owner: 'shared' })
      .select()
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
    const { id: _, ...safeUpdates } = updates
    console.log('supabase.updateClient ->', id, safeUpdates)
    const { data, error } = await supabase
      .from('clients')
      .update(safeUpdates)
      .eq('id', id)
      .select()
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