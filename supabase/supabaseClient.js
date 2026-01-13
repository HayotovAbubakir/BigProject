import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_KEY

export const isSupabaseConfigured = () => {
  return !!(supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('placeholder') && !supabaseAnonKey.includes('placeholder'))
}

if (!isSupabaseConfigured()) {
  console.warn('Supabase not configured: check VITE_SUPABASE_URL and VITE_SUPABASE_KEY in .env')
}

export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder-key')

if (isSupabaseConfigured() && import.meta.env.DEV) {
  console.log('Supabase client configured; URL:', supabaseUrl)
}
