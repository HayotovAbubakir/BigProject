export async function loadAppState(username) {
  try {
    // Try per-user key first
    if (username) {
      const key = `shop_state_user_${username}`
      const raw = localStorage.getItem(key)
      if (raw) return JSON.parse(raw)
    }
    // Fallback to the global backup key
    const backup = localStorage.getItem('shop_state_backup_v1')
    if (backup) return JSON.parse(backup)
    return null
  } catch (err) {
    console.warn('loadAppState: failed to parse stored state', err)
    return null
  }
}

export async function saveAppState(state, username) {
  try {
    const userKey = username ? `shop_state_user_${username}` : null
    const payload = JSON.stringify(state)
    // Always write per-user key when username available
    if (userKey) localStorage.setItem(userKey, payload)
    // Also keep a global backup copy
    localStorage.setItem('shop_state_backup_v1', payload)
    return true
  } catch (err) {
    console.error('saveAppState: failed to write state', err)
    return false
  }
}
