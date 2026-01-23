// Supabase-backed database helpers
import { supabase } from '../../supabase/supabaseClient'

export default null

const isSupabaseConfigured = () => {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_KEY
  return url && key && !url.includes('placeholder') && !key.includes('placeholder')
}
