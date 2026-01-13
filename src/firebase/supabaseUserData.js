import { supabase } from '/supabase/supabaseClient'
import { getClients } from './supabaseClients'
import { getLogs } from './supabaseLogs'
import { getCredits } from './supabaseCredits'

const isSupabaseConfigured = () => {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_KEY
  return url && key && !url.includes('placeholder') && !key.includes('placeholder')
}

export const fetchUserData = async (user) => {
  if (!isSupabaseConfigured()) return { clients: [], logs: [], credits: [] }
  try {
    // Fetch clients
    const clients = await getClients(user)

    // Fetch logs
    const logs = await getLogs(user)

    // Fetch credits
    const credits = await getCredits(user)

    console.log('Clients:', clients)
    console.log('Logs:', logs)
    console.log('Credits:', credits)

    return { clients, logs, credits }
  } catch (error) {
    console.error('Error fetching user data:', error)
    return { clients: [], logs: [], credits: [] }
  }
}