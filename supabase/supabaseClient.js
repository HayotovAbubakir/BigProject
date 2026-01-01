import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase environment variables not set. Please check your .env file.')
}

export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseKey || 'placeholder-key')
