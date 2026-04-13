import { createClient } from '@supabase/supabase-js'

// Trim env variables to avoid subtle DNS failures caused by copied whitespace/newlines
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim()
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_KEY || '').trim()
const supabaseAuthDomain = (import.meta.env.VITE_SUPABASE_AUTH_DOMAIN || 'app.local').trim()

export const isSupabaseConfigured = () => {
  return !!(supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('placeholder') && !supabaseAnonKey.includes('placeholder'))
}

if (!isSupabaseConfigured()) {
  console.warn('Supabase not configured: check VITE_SUPABASE_URL and VITE_SUPABASE_KEY in .env')
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: true
    },
    global: {
      headers: {
        'X-App-Auth-Domain': supabaseAuthDomain
      }
    }
  }
)

if (isSupabaseConfigured() && import.meta.env.DEV) {
  console.log('Supabase client configured; URL:', supabaseUrl)
}
