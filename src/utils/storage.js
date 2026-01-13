import { loadAppState as loadFromSupabase, saveAppState as saveToSupabase, clearAppState as clearFromSupabase } from '../firebase/db'

export async function loadAppState(username) {
  try {
    return await loadFromSupabase(username)
  } catch (err) {
    console.warn('loadAppState (utils) failed', err)
    return null
  }
}

export async function saveAppState(state, username) {
  try {
    return await saveToSupabase(state, username)
  } catch (err) {
    console.error('saveAppState (utils) failed', err)
    return false
  }
}

export async function clearAppState(username) {
  try {
    return await clearFromSupabase(username)
  } catch (err) {
    console.warn('clearAppState (utils) failed', err)
    return false
  }
}
