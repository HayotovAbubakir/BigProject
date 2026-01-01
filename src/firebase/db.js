// Supabase-backed database helpers
import { supabase } from '/supabase/supabaseClient'

export default null

const isSupabaseConfigured = () => {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_KEY
  return url && key && !url.includes('placeholder') && !key.includes('placeholder')
}

export async function loadAppState(username) {
  if (!isSupabaseConfigured()) {
    console.warn('Supabase not configured, cannot load remote state')
    return null
  }
  try {
    // Check if user is authenticated via sessionStorage (custom auth)
    const stored = sessionStorage.getItem('app_auth_v1')
    if (!stored) {
      console.warn('User not authenticated, cannot load remote state')
      return null
    }

    const { data, error } = await supabase
      .from('app_states')
      .select('state_json')
      .eq('username', username || 'shared')
      .single()

    if (error) {
      if (error.code === 'PGRST116') { // Not found
        console.log('No saved state found for user:', username || 'shared')
        return null
      }
      console.error('loadAppState: Supabase error:', error.message)
      return null
    }

    if (data && data.state_json) {
      return JSON.parse(data.state_json)
    }

    // Fallback to shared state if user-specific not found
    if (username) {
      const { data: sharedData, error: sharedError } = await supabase
        .from('app_states')
        .select('state_json')
        .eq('username', 'shared')
        .single()

      if (sharedError && sharedError.code !== 'PGRST116') {
        console.error('loadAppState: shared fallback error:', sharedError.message)
        return null
      }

      if (sharedData && sharedData.state_json) {
        return JSON.parse(sharedData.state_json)
      }
    }

    return null
  } catch (err) {
    console.error('loadAppState: unexpected error:', err.message)
    return null
  }
}

export async function saveAppState(state, username) {
  if (!isSupabaseConfigured()) {
    console.warn('Supabase not configured, cannot save remote state')
    return false
  }
  try {
    // Check if user is authenticated via sessionStorage (custom auth)
    const stored = sessionStorage.getItem('app_auth_v1')
    if (!stored) {
      console.warn('User not authenticated, cannot save remote state')
      return false
    }

    const payload = JSON.stringify(state)
    const { error } = await supabase
      .from('app_states')
      .upsert({
        username: username || 'shared',
        state_json: payload,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'username'
      })

    if (error) {
      console.error('saveAppState: Supabase error:', error.message)
      return false
    }

    console.log('App state saved successfully for user:', username || 'shared')
    return true
  } catch (err) {
    console.error('saveAppState: unexpected error:', err.message)
    return false
  }
}

export async function clearAppState(username) {
  if (!isSupabaseConfigured()) {
    console.warn('Supabase not configured, cannot clear remote state')
    return false
  }
  try {
    // Check if user is authenticated via sessionStorage (custom auth)
    const stored = sessionStorage.getItem('app_auth_v1')
    if (!stored) {
      console.warn('User not authenticated, cannot clear remote state')
      return false
    }

    const { error } = await supabase
      .from('app_states')
      .delete()
      .eq('username', username || 'shared')

    if (error) {
      console.error('clearAppState: Supabase error:', error.message)
      return false
    }

    console.log('App state cleared for user:', username || 'shared')
    return true
  } catch (err) {
    console.error('clearAppState: unexpected error:', err.message)
    return false
  }
}
